package pipeline

import (
	"encoding/json"
	"fmt"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/keywords"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/taxonomy"
	"github.com/stretchr/testify/require"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
	"math/rand"
	"os"
	"reflect"
	"sort"
	"strings"
	"sync"
	"testing"
	"unicode"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/stretchr/testify/assert"
)

func TestNormalizeCollectedJobTrimsWithoutChangingTitleCase(t *testing.T) {
	got := normalizeCollectedJob(domain.Job{
		Title:    "  Engenheiro Go  ",
		Company:  " Acme ",
		Location: " Brasil ",
		Source:   " Gupy ",
		Keyword:  " go ",
		URL:      " HTTPS://Jobs.Example.com/go?utm=1#x ",
		ID:       " ext-1 ",
	})

	assert.Equal(t, "Engenheiro Go", got.Title)
	assert.Equal(t, "Acme", got.Company)
	assert.Equal(t, "Brasil", got.Location)
	assert.Equal(t, "Gupy", got.Source)
	assert.Equal(t, []string{"Gupy"}, got.Sources)
	assert.Equal(t, "go", got.Keyword)
	assert.Equal(t, "ext-1", got.ID)
	assert.Equal(t, "https://jobs.example.com/go", got.URL)
}

func TestJobIsInvalidWithoutStableIdentity(t *testing.T) {
	assert.True(t, jobIsInvalid(domain.Job{Title: "Só título"}))
	assert.False(t, jobIsInvalid(domain.Job{Title: "Dev Go", Company: "Acme", Location: "Brasil"}))
}

// Frozen projection from 5a80b8c. Test-only oracle; never calls the optimized matcher.
func referenceInvertedIndexKeys(job domain.Job, keywords []string) []string {
	keys := make([]string, 0)
	searchText := referenceKeywordSearchText(job)
	for _, kw := range keywords {
		sanitizedKw := strings.ToLower(strings.TrimSpace(kw))
		if sanitizedKw == "" {
			continue
		}
		if referenceKeywordMatches(searchText, sanitizedKw) {
			for _, alias := range referenceKeywordIndexAliases(sanitizedKw) {
				keys = append(keys, fmt.Sprintf("scraper:jobs:keyword:%s", alias))
			}
		}
		for _, term := range referenceKeywordSubTerms(sanitizedKw) {
			if term == "" {
				continue
			}
			if referenceContainsTokenOrPhrase(searchText, term) {
				keys = append(keys, fmt.Sprintf("scraper:jobs:keyword:%s", term))
			}
		}
	}
	keys = append(keys, referenceStructuredIndexKeys(job)...)
	keys = append(keys, referenceClassificationIndexKeys(job)...)
	return referenceUniqueIndexMembers(keys)
}

func referenceUniqueIndexMembers(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func referenceClassificationIndexKeys(job domain.Job) []string {
	if job.Classification == nil {
		return nil
	}

	classification := job.Classification
	if !classification.InScope {
		return nil
	}

	values := make([]string, 0, 1+len(classification.RelatedFamilies)+len(classification.Technologies))

	primary := classification.PrimaryFamily
	if taxonomy.IsPublic(primary) {
		values = append(values, "scraper:jobs:family:"+primary, "scraper:jobs:family:primary:"+primary, "scraper:jobs:keyword:"+referenceNormalizeIndexValue(primary))
	}
	for _, family := range taxonomy.Related(primary, classification.RelatedFamilies) {
		values = append(values, "scraper:jobs:family:"+family, "scraper:jobs:family:related:"+family, "scraper:jobs:keyword:"+referenceNormalizeIndexValue(family))
	}
	for _, technology := range classification.Technologies {
		normalized := referenceNormalizeIndexValue(technology)
		if normalized != "" {
			values = append(values,
				fmt.Sprintf("scraper:jobs:technology:%s", normalized),
				fmt.Sprintf("scraper:jobs:keyword:%s", normalized),
			)
		}
	}
	if classification.Seniority != "" {
		normalized := referenceNormalizeIndexValue(classification.Seniority)
		if normalized != "" {
			values = append(values, fmt.Sprintf("scraper:jobs:seniority:%s", normalized))
		}
	}

	return referenceUniqueStrings(values)
}

func referenceStructuredIndexKeys(job domain.Job) []string {
	values := map[string]string{
		"level":    referenceInferLevel(job),
		"model":    referenceInferWorkModel(job),
		"contract": referenceInferContract(job),
	}

	for key, value := range referenceInferLocation(job.Location) {
		values[key] = value
	}

	keys := make([]string, 0, len(values))
	for kind, value := range values {
		normalized := referenceNormalizeIndexValue(value)
		if normalized == "" || normalized == "todos" || normalized == "all" {
			continue
		}
		keys = append(keys, fmt.Sprintf("scraper:jobs:%s:%s", kind, normalized))
	}

	return keys
}

func referenceNormalizeIndexValue(value string) string {
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

func referenceKeywordSearchText(job domain.Job) string {
	return referenceNormalizeIndexValue(strings.Join([]string{
		job.Title,
		job.Company,
		job.Location,
		job.Modality,
		job.Description,
	}, " "))
}

func referenceSearchableJobText(job domain.Job) string {
	return referenceNormalizeIndexValue(strings.Join([]string{
		job.Title,
		job.Company,
		job.Location,
		job.Modality,
		job.Description,
	}, " "))
}

func referenceKeywordSubTerms(keyword string) []string {
	terms := strings.Fields(referenceNormalizeIndexValue(keyword))
	if len(terms) >= 2 && terms[0] == "node" && terms[1] == "js" {
		terms = append(terms, "nodejs")
	}
	return referenceUniqueStrings(terms)
}

func referenceKeywordIndexAliases(keyword string) []string {
	sanitized := strings.Join(strings.Fields(strings.ReplaceAll(strings.ToLower(keyword), "/", " ")), " ")
	normalized := referenceNormalizeIndexValue(keyword)

	aliases := []string{sanitized, normalized}
	if strings.Contains(normalized, "node js") {
		aliases = append(aliases, strings.ReplaceAll(normalized, "node js", "nodejs"), "nodejs", "node")
	}

	return referenceUniqueStrings(aliases)
}

func referenceKeywordMatches(searchText, keyword string) bool {
	terms := strings.Fields(referenceNormalizeIndexValue(keyword))
	if len(terms) == 0 {
		return false
	}

	for i := 0; i < len(terms); i++ {
		term := terms[i]
		if term == "node" && i+1 < len(terms) && terms[i+1] == "js" {
			if !referenceContainsTokenOrPhrase(searchText, "node js") && !referenceContainsTokenOrPhrase(searchText, "nodejs") {
				return false
			}
			i++
			continue
		}
		if !referenceContainsTokenOrPhrase(searchText, term) {
			return false
		}
	}

	return true
}

func referenceUniqueStrings(values []string) []string {
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

func referenceInferLevel(job domain.Job) string {
	text := referenceSearchableJobText(job)

	if referenceContainsAny(text, "estagio", "intern", "trainee") {
		return "estagio"
	}
	if referenceContainsAny(text, "senior", "sr", "especialista", "lead", "principal", "staff") {
		return "senior"
	}
	if referenceContainsAny(text, "junior", "jr", "entry level", "assistente") {
		return "junior"
	}

	return "pleno"
}

func referenceInferWorkModel(job domain.Job) string {
	text := referenceSearchableJobText(job)

	if referenceContainsAny(text, "hibrido", "hybrid") {
		return "hibrido"
	}
	if referenceContainsAny(text,
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
	if referenceContainsAny(text,
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

func referenceInferContract(job domain.Job) string {
	text := referenceSearchableJobText(job)

	if referenceContainsAny(text, "cooperado", "cooperativa") {
		return "cooperado"
	}
	if referenceContainsAny(text, "pj", "pessoa juridica", "contractor", "freelance", "freela") {
		return "pj"
	}
	if referenceContainsAny(text, "clt", "full time", "full-time", "efetivo", "permanent") {
		return "clt"
	}

	return ""
}

func referenceInferLocation(location string) map[string]string {
	text := referenceNormalizeIndexValue(location)
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
			if referenceContainsTokenOrPhrase(text, referenceNormalizeIndexValue(alias)) {
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

	if values["continent"] == "" && referenceContainsAny(text, "remote", "remoto", "global", "worldwide") {
		values["continent"] = "Global / Remoto"
		values["location"] = "Global / Remoto"
	}

	if state := referenceInferBrazilianState(text); state != "" {
		values["state"] = state
		if values["country"] == "" {
			values["country"] = "Brasil"
			values["location"] = "Brasil"
			values["continent"] = "América do Sul"
		}
	}
	if city := referenceInferKnownCity(text); city != "" {
		values["city"] = city
	}

	return values
}

func referenceInferBrazilianState(text string) string {
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
			if referenceContainsTokenOrPhrase(text, referenceNormalizeIndexValue(alias)) {
				return state
			}
		}
	}

	return ""
}

func referenceInferKnownCity(text string) string {
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
		if referenceContainsTokenOrPhrase(text, city) {
			return city
		}
	}

	return ""
}

func referenceContainsAny(text string, needles ...string) bool {
	for _, needle := range needles {
		if referenceContainsTokenOrPhrase(text, referenceNormalizeIndexValue(needle)) {
			return true
		}
	}
	return false
}

func referenceContainsTokenOrPhrase(text string, needle string) bool {
	if needle == "" {
		return false
	}
	if strings.Contains(needle, " ") {
		return strings.Contains(text, needle)
	}

	return strings.Contains(" "+text+" ", " "+needle+" ")
}

func realIndexKeywords(t testing.TB) []string {
	t.Helper()
	raw, err := os.ReadFile("../keywords/keywords.json")
	require.NoError(t, err)
	var seed struct {
		Keywords []string `json:"KEYWORDS"`
	}
	require.NoError(t, json.Unmarshal(raw, &seed))
	result := keywords.GenerateSearchKeywords(seed.Keywords)
	require.Len(t, result, 445)
	return result
}

func sortedIndexKeys(keys []string) []string {
	sort.Strings(keys)
	return keys
}

func requireIndexEquivalence(t *testing.T, job domain.Job, keywords []string) {
	t.Helper()
	want := sortedIndexKeys(referenceInvertedIndexKeys(job, keywords))
	require.Equal(t, want, sortedIndexKeys(IndexKeys(job, keywords)))
	require.Equal(t, want, sortedIndexKeys(prepareIndexKeywords(keywords).keys(job)))
}

func TestIndexKeysEquivalentToCommittedProjection(t *testing.T) {
	queries := []string{"go", "Go", "backend engineer", "engineer backend", "node.js", "node js engineer", "engineer node js", "nodejs", "C#", ".NET", "UX/UI", "operações de produto", "", "  ", "---", "react", "React", "a/b", "a  b", "entry level"}
	texts := []string{
		"", "go", "golang", "django gopher ongoing", "go backend distant engineer",
		"ENGINEER GO BACKEND", "Node.js backend engineer", "nodejs engineer",
		"anode json engineer", "node distant js engineer", "engineer nodejs",
		"C# .NET React", "UX/UI designer", "OPERAÇÕES DE PRODUTO", "operações de produto",
		"go\tbackend\nengineer", "go   backend   engineer", "go-react/node.js",
		"Senior remote full-time", "Júnior híbrido PJ", "Estágio presencial CLT",
		"Staff hybrid contractor", "Intern home office cooperativa", "entry level on-site",
		strings.Repeat("Golang go APIs backend engineer React Node.js C# .NET Brasil. ", 300),
	}
	for i, text := range texts {
		t.Run(fmt.Sprint(i), func(t *testing.T) {
			job := domain.Job{Title: text, Company: "Acme", Location: "São Paulo, SP, Brasil", Description: text, Modality: text,
				Classification: &domain.Classification{InScope: true, PrimaryFamily: "backend", RelatedFamilies: []string{"platform", "backend", "platform"}, Technologies: []string{"Go", "C#", ".NET", "Node.js"}, Seniority: "sênior"}}
			requireIndexEquivalence(t, job, queries)
			requireIndexEquivalence(t, job, realIndexKeywords(t))
			job.Classification = nil
			requireIndexEquivalence(t, job, nil)
			job.Classification = &domain.Classification{InScope: false, PrimaryFamily: "other"}
			requireIndexEquivalence(t, job, queries)
		})
	}
	for _, location := range []string{"", "Remote worldwide", "Lisboa Portugal", "London UK", "Toronto Canada", "Rio de Janeiro RJ", "Curitiba PR", "Belo Horizonte MG", "New York USA", "Sydney Australia"} {
		requireIndexEquivalence(t, domain.Job{Title: "Backend Engineer", Location: location}, queries)
	}
}

func TestContainsTokenOrPhraseMatchesCommittedBoundaries(t *testing.T) {
	texts := []string{"", "go", "gopher go", "go gopher", "go-go", "go\tgo", "go\ngo", " gopher ", "node js", "anode json", "égo", "é go é", "go go go", "  go  "}
	needles := []string{"", "go", "gopher", "node js", "on site", "go go", "go\tgo", "é", "verylongneedle"}
	for _, text := range texts {
		for _, needle := range needles {
			require.Equal(t, referenceContainsTokenOrPhrase(text, needle), containsTokenOrPhrase(text, needle), "%q / %q", text, needle)
		}
	}
}

func TestIndexKeysGeneratedEquivalenceAndImmutableReuse(t *testing.T) {
	rng := rand.New(rand.NewSource(178))
	words := []string{"go", "Golang", "node", "js", "nodejs", "C#", ".NET", "sênior", "remote", "backend", "engineer", "React", "a/b", "operações", "UX/UI", "python", "gopher"}
	queries := realIndexKeywords(t)
	prepared := prepareIndexKeywords(queries)
	saved := append([]string(nil), queries...)
	for i := 0; i < 150; i++ {
		parts := make([]string, 12)
		for j := range parts {
			parts[j] = words[rng.Intn(len(words))]
		}
		job := domain.Job{Title: parts[0], Company: parts[1], Description: strings.Join(parts, " "), Location: "Lisboa Portugal"}
		want := sortedIndexKeys(referenceInvertedIndexKeys(job, queries))
		require.Equal(t, want, sortedIndexKeys(prepared.keys(job)))
		require.Equal(t, want, sortedIndexKeys(IndexKeys(job, queries)))
		arbitrary := make([]string, 12)
		for n := range arbitrary {
			arbitrary[n] = words[rng.Intn(len(words))] + " / " + words[rng.Intn(len(words))]
		}
		requireIndexEquivalence(t, job, arbitrary)
	}
	require.Equal(t, saved, queries)
	// The compiled snapshot must survive changes to the caller's slice.
	job := domain.Job{Title: "Backend engineer Go", Location: "Brasil"}
	want := sortedIndexKeys(prepared.keys(job))
	queries[0] = "mutated keyword"
	require.Equal(t, want, sortedIndexKeys(prepared.keys(job)))
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for n := 0; n < 20; n++ {
				if !reflect.DeepEqual(want, sortedIndexKeys(prepared.keys(job))) {
					t.Error("shared matcher changed")
				}
			}
		}()
	}
	wg.Wait()
}

func FuzzContainsTokenOrPhraseEquivalent(f *testing.F) {
	for _, pair := range [][2]string{{"go gopher", "go"}, {"anode json", "node js"}, {" go\tgo ", "go"}, {"é Go", "Go"}, {"", ""}} {
		f.Add(pair[0], pair[1])
	}
	f.Fuzz(func(t *testing.T, text, needle string) {
		if containsTokenOrPhrase(text, needle) != referenceContainsTokenOrPhrase(text, needle) {
			t.Fatalf("boundary mismatch: %q / %q", text, needle)
		}
	})
}
