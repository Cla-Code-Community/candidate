package pipeline

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"
	"unicode"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/dedup"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/metrics"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/models"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/redis/go-redis/v9"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

const defaultMaxConcurrency = 150

type result struct {
	jobs []models.Job
	err  error
}

func Run(ctx context.Context, adapterList []adapters.Adapter, req models.ScrapeRequest) []models.Job {
	pipelineStart := time.Now()

	maxConcurrency := req.MaxConcurrency
	if maxConcurrency <= 0 {
		maxConcurrency = defaultMaxConcurrency
	}

	type task struct {
		adapter adapters.Adapter
		keyword string
	}

	tasks := make([]task, 0, len(adapterList)*len(req.Keywords))
	for _, a := range adapterList {
		for _, kw := range req.Keywords {
			tasks = append(tasks, task{adapter: a, keyword: kw})
		}
	}

	sem := make(chan struct{}, maxConcurrency)
	results := make(chan result, len(tasks))
	var wg sync.WaitGroup

	for _, t := range tasks {
		wg.Add(1)
		sem <- struct{}{}

		go func(t task) {
			defer wg.Done()
			defer func() { <-sem }()

			source := t.adapter.SourceName()

			timer := prometheus.NewTimer(metrics.ScrapeDurationSeconds.WithLabelValues(source))
			jobs, err := t.adapter.Search(ctx, t.keyword, req)
			timer.ObserveDuration()

			metrics.ScrapeRunsTotal.WithLabelValues(source).Inc()

			results <- result{jobs: jobs, err: err}

			if err != nil {
				metrics.ScrapeErrorsTotal.WithLabelValues(source).Inc()
				slog.Warn("adapter falhou",
					"source", source,
					"keyword", t.keyword,
					"error", err,
				)
				return
			}

			metrics.JobsFoundTotal.WithLabelValues(source).Add(float64(len(jobs)))

			slog.Info("adapter concluído",
				"source", source,
				"keyword", t.keyword,
				"count", len(jobs),
			)
		}(t)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	var allJobs []models.Job
	for r := range results {
		if r.err == nil {
			allJobs = append(allJobs, r.jobs...)
		}
	}

	deduped := dedup.DedupeJobs(allJobs)

	metrics.PipelineRunDuration.Observe(time.Since(pipelineStart).Seconds())
	metrics.PipelineJobsTotal.Observe(float64(len(deduped)))

	return deduped
}

func IndexJobsInValkey(ctx context.Context, rdb *redis.Client, jobs []models.Job, keywords []string) {
	if rdb == nil || len(jobs) == 0 {
		return
	}

	const (
		globalIndexKey = "scraper:jobs:index"
		// 9 dias: cobre o intervalo semanal com margem
		// As vagas individuais (scraper:job:<id>) também têm 9 dias,
		// então index e dados expiram na mesma janela
		indexTTL = 9 * 24 * time.Hour
	)

	// Monta os novos índices em chaves temporárias (sufixo :next)
	// e só depois faz RENAME atômico — sem janela de vazio durante reindexação
	type tempEntry struct {
		tempKey  string
		finalKey string
		ids      []string
	}

	kwIndex := make(map[string][]string) // finalKey → []id

	for _, job := range jobs {
		id := jobstore.StableID(&job)
		if id == "" {
			continue
		}

		// Índice global: permanente, sem TTL
		rdb.SAdd(ctx, globalIndexKey, id)

		searchText := keywordSearchText(job)

		for _, kw := range keywords {
			sanitizedKw := strings.ToLower(strings.TrimSpace(kw))
			if sanitizedKw == "" {
				continue
			}

			if keywordMatches(searchText, sanitizedKw) {
				for _, alias := range keywordIndexAliases(sanitizedKw) {
					fullKey := fmt.Sprintf("scraper:jobs:keyword:%s", alias)
					kwIndex[fullKey] = append(kwIndex[fullKey], id)
				}
			}

			for _, term := range keywordSubTerms(sanitizedKw) {
				if term == "" {
					continue
				}
				if containsTokenOrPhrase(searchText, term) {
					termKey := fmt.Sprintf("scraper:jobs:keyword:%s", term)
					kwIndex[termKey] = append(kwIndex[termKey], id)
				}
			}
		}

		for _, key := range structuredIndexKeys(job) {
			kwIndex[key] = append(kwIndex[key], id)
		}
	}

	// Publica os índices de keyword com RENAME atômico
	// Fluxo: escreve em :next → RENAME :next → final → Expire no final
	for finalKey, ids := range kwIndex {
		tempKey := finalKey + ":next"

		pipe := rdb.Pipeline()
		pipe.Del(ctx, tempKey) // limpa eventual :next anterior
		for _, id := range ids {
			pipe.SAdd(ctx, tempKey, id)
		}
		pipe.Expire(ctx, tempKey, indexTTL)
		if _, err := pipe.Exec(ctx); err != nil {
			slog.Warn("IndexJobsInValkey: erro ao preparar chave temporária",
				"key", tempKey, "error", err)
			continue
		}

		// RENAME é atômico: clientes nunca veem chave vazia
		if err := rdb.Rename(ctx, tempKey, finalKey).Err(); err != nil {
			slog.Warn("IndexJobsInValkey: erro no RENAME",
				"from", tempKey, "to", finalKey, "error", err)
		}
	}

	slog.Info("Valkey índice invertido atualizado",
		"keywords_indexadas", len(kwIndex),
		"total_vagas", len(jobs),
	)
}

func structuredIndexKeys(job models.Job) []string {
	values := map[string]string{
		"level":    inferLevel(job),
		"model":    inferWorkModel(job),
		"contract": inferContract(job),
	}

	for key, value := range inferLocation(job.Location) {
		values[key] = value
	}

	keys := make([]string, 0, len(values))
	for kind, value := range values {
		normalized := normalizeIndexValue(value)
		if normalized == "" || normalized == "todos" || normalized == "all" {
			continue
		}
		keys = append(keys, fmt.Sprintf("scraper:jobs:%s:%s", kind, normalized))
	}

	return keys
}

func normalizeIndexValue(value string) string {
	t := transform.Chain(norm.NFD, transform.RemoveFunc(func(r rune) bool {
		return unicode.Is(unicode.Mn, r)
	}), norm.NFC)

	result, _, _ := transform.String(t, value)
	result = strings.ReplaceAll(result, "/", " ")

	var b strings.Builder
	for _, r := range strings.ToLower(result) {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			b.WriteRune(r)
		} else {
			b.WriteRune(' ')
		}
	}

	return strings.Join(strings.Fields(b.String()), " ")
}

func keywordSearchText(job models.Job) string {
	return normalizeIndexValue(strings.Join([]string{
		job.Title,
		job.Company,
		job.Location,
		job.Modality,
		job.Description,
	}, " "))
}

func searchableJobText(job models.Job) string {
	return normalizeIndexValue(strings.Join([]string{
		job.Title,
		job.Company,
		job.Location,
		job.Modality,
		job.Description,
	}, " "))
}

func keywordSubTerms(keyword string) []string {
	terms := strings.Fields(normalizeIndexValue(keyword))
	if len(terms) >= 2 && terms[0] == "node" && terms[1] == "js" {
		terms = append(terms, "nodejs")
	}
	return uniqueStrings(terms)
}

func keywordIndexAliases(keyword string) []string {
	sanitized := strings.Join(strings.Fields(strings.ReplaceAll(strings.ToLower(keyword), "/", " ")), " ")
	normalized := normalizeIndexValue(keyword)

	aliases := []string{sanitized, normalized}
	if strings.Contains(normalized, "node js") {
		aliases = append(aliases, strings.ReplaceAll(normalized, "node js", "nodejs"), "nodejs", "node")
	}

	return uniqueStrings(aliases)
}

func keywordMatches(searchText, keyword string) bool {
	terms := strings.Fields(normalizeIndexValue(keyword))
	if len(terms) == 0 {
		return false
	}

	for i := 0; i < len(terms); i++ {
		term := terms[i]
		if term == "node" && i+1 < len(terms) && terms[i+1] == "js" {
			if !containsTokenOrPhrase(searchText, "node js") && !containsTokenOrPhrase(searchText, "nodejs") {
				return false
			}
			i++
			continue
		}
		if !containsTokenOrPhrase(searchText, term) {
			return false
		}
	}

	return true
}

func uniqueStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func inferLevel(job models.Job) string {
	text := searchableJobText(job)

	if containsAny(text, "estagio", "intern", "trainee") {
		return "estagio"
	}
	if containsAny(text, "senior", "sr", "especialista", "lead", "principal", "staff") {
		return "senior"
	}
	if containsAny(text, "junior", "jr", "entry level", "assistente") {
		return "junior"
	}

	return "pleno"
}

func inferWorkModel(job models.Job) string {
	text := searchableJobText(job)

	if containsAny(text, "hibrido", "hybrid") {
		return "hibrido"
	}
	if containsAny(text,
		"remoto",
		"remote",
		"home office",
		"teletrabalho",
		"anywhere",
		"worldwide",
		"global",
	) {
		return "remoto"
	}
	if containsAny(text,
		"presencial",
		"onsite",
		"on site",
		"on-site",
		"in office",
		"escritorio",
	) {
		return "presencial"
	}

	return "presencial"
}

func inferContract(job models.Job) string {
	text := searchableJobText(job)

	if containsAny(text, "cooperado", "cooperativa") {
		return "cooperado"
	}
	if containsAny(text, "pj", "pessoa juridica", "contractor", "freelance", "freela") {
		return "pj"
	}
	if containsAny(text, "clt", "full time", "full-time", "efetivo", "permanent") {
		return "clt"
	}

	return ""
}

func inferLocation(location string) map[string]string {
	text := normalizeIndexValue(location)
	values := make(map[string]string)
	if text == "" {
		return values
	}

	type countryRule struct {
		country   string
		continent string
		aliases   []string
	}

	rules := []countryRule{
		{"Brasil", "América do Sul", []string{"brasil", "brazil", "br"}},
		{"Estados Unidos", "América do Norte", []string{"estados unidos", "united states", "usa", "us", "eua"}},
		{"Canadá", "América do Norte", []string{"canada", "canadá"}},
		{"México", "América do Norte", []string{"mexico", "méxico"}},
		{"Argentina", "América do Sul", []string{"argentina"}},
		{"Chile", "América do Sul", []string{"chile"}},
		{"Colômbia", "América do Sul", []string{"colombia", "colômbia"}},
		{"Portugal", "Europa", []string{"portugal"}},
		{"Espanha", "Europa", []string{"spain", "espanha", "espana", "españa"}},
		{"Reino Unido", "Europa", []string{"reino unido", "united kingdom", "uk", "england", "london"}},
		{"França", "Europa", []string{"france", "frança", "franca"}},
		{"Alemanha", "Europa", []string{"germany", "alemanha", "deutschland"}},
		{"Países Baixos", "Europa", []string{"netherlands", "paises baixos", "holanda"}},
		{"Índia", "Ásia", []string{"india", "índia"}},
		{"Singapura", "Ásia", []string{"singapore", "singapura"}},
		{"Austrália", "Oceania", []string{"australia", "austrália"}},
		{"Nova Zelândia", "Oceania", []string{"new zealand", "nova zelandia", "nova zelândia"}},
		{"África do Sul", "África", []string{"south africa", "africa do sul", "áfrica do sul"}},
	}

	for _, rule := range rules {
		for _, alias := range rule.aliases {
			if containsTokenOrPhrase(text, normalizeIndexValue(alias)) {
				values["country"] = rule.country
				values["location"] = rule.country
				values["continent"] = rule.continent
				break
			}
		}
		if values["country"] != "" {
			break
		}
	}

	if values["continent"] == "" && containsAny(text, "remote", "remoto", "global", "worldwide") {
		values["continent"] = "Global / Remoto"
		values["location"] = "Global / Remoto"
	}

	if state := inferBrazilianState(text); state != "" {
		values["state"] = state
		if values["country"] == "" {
			values["country"] = "Brasil"
			values["location"] = "Brasil"
			values["continent"] = "América do Sul"
		}
	}
	if city := inferKnownCity(text); city != "" {
		values["city"] = city
	}

	return values
}

func inferBrazilianState(text string) string {
	states := map[string][]string{
		"SP": {"sp", "sao paulo"},
		"RJ": {"rj", "rio de janeiro"},
		"MG": {"mg", "minas gerais", "belo horizonte"},
		"PR": {"pr", "parana", "curitiba"},
		"SC": {"sc", "santa catarina", "florianopolis"},
		"RS": {"rs", "rio grande do sul", "porto alegre"},
		"BA": {"ba", "bahia", "salvador"},
		"PE": {"pe", "pernambuco", "recife"},
		"CE": {"ce", "ceara", "fortaleza"},
		"DF": {"df", "distrito federal", "brasilia"},
	}

	for state, aliases := range states {
		for _, alias := range aliases {
			if containsTokenOrPhrase(text, normalizeIndexValue(alias)) {
				return state
			}
		}
	}

	return ""
}

func inferKnownCity(text string) string {
	cities := []string{
		"sao paulo",
		"rio de janeiro",
		"belo horizonte",
		"curitiba",
		"joinville",
		"florianopolis",
		"porto alegre",
		"salvador",
		"recife",
		"fortaleza",
		"brasilia",
		"lisboa",
		"porto",
		"madrid",
		"barcelona",
		"london",
		"paris",
		"berlin",
		"amsterdam",
		"toronto",
		"vancouver",
		"new york",
		"san francisco",
		"singapore",
		"sydney",
	}

	for _, city := range cities {
		if containsTokenOrPhrase(text, city) {
			return city
		}
	}

	return ""
}

func containsAny(text string, needles ...string) bool {
	for _, needle := range needles {
		if containsTokenOrPhrase(text, normalizeIndexValue(needle)) {
			return true
		}
	}
	return false
}

func containsTokenOrPhrase(text string, needle string) bool {
	if needle == "" {
		return false
	}
	if strings.Contains(needle, " ") {
		return strings.Contains(text, needle)
	}

	return strings.Contains(" "+text+" ", " "+needle+" ")
}
