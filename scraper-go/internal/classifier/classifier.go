package classifier

import (
	"log/slog"
	"math"
	"sort"
	"strconv"
	"strings"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
)

type familyScore struct {
	family string
	score  int
}

type sourceClassificationStats struct {
	source                   string
	input                    int
	approved                 int
	rejected                 int
	rejectedWithDescription  int
	rejectedWithKeywords     int
	rejectedWithTechnologies int
	rejectionReasons         map[string]int
	rejectedFamilies         map[string]int
	rejectedTechnologies     map[string]int
	rejectedTitles           map[string]int
	rejectedCompanies        map[string]int
}

func Classify(job domain.Job) domain.Classification {
	text := normalizeText(strings.Join([]string{
		job.Title,
		job.Company,
		job.Location,
		job.Modality,
		job.Description,
	}, " "))

	scores := scoreFamilies(text)
	technologies := detectTechnologies(text)
	seniority := detectSeniority(text)

	if blocked, reason := blockedOpeningReason(job); blocked {
		return domain.Classification{
			PrimaryFamily: "other",
			Technologies:  technologies,
			Seniority:     seniority,
			InScope:       false,
			Confidence:    0,
			Reasons:       []string{reason},
		}
	}

	if len(scores) == 0 {
		return domain.Classification{
			PrimaryFamily: "other",
			Technologies:  technologies,
			Seniority:     seniority,
			InScope:       false,
			Confidence:    0,
			Reasons:       []string{"nenhuma familia reconhecida"},
		}
	}

	sort.Slice(scores, func(i, j int) bool {
		if scores[i].score == scores[j].score {
			return scores[i].family < scores[j].family
		}
		return scores[i].score > scores[j].score
	})

	primary := scores[0]
	related := make([]string, 0, len(scores)-1)
	for _, candidate := range scores[1:] {
		if candidate.score >= 3 {
			related = append(related, candidate.family)
		}
	}
	if primary.family == "mobile" && containsString(technologies, "react-native") {
		related = append(related, "frontend")
	}

	confidence := math.Min(0.99, 0.35+(float64(primary.score)*0.08))

	reason := "classificacao local por titulo descricao tecnologias"
	if primary.score < 2 {
		reason = "score abaixo do minimo"
	}

	return domain.Classification{
		PrimaryFamily:   primary.family,
		RelatedFamilies: unique(related),
		Technologies:    technologies,
		Seniority:       seniority,
		InScope:         primary.score >= 2,
		Confidence:      math.Round(confidence*100) / 100,
		Reasons:         []string{reason},
	}
}

func blockedOpeningReason(job domain.Job) (bool, string) {
	title := normalizeText(job.Title)
	if title == "" {
		return false, ""
	}

	nonConcreteTerms := []string{
		"banco de talentos",
		"talent pool",
		"cadastro reserva",
	}
	for _, term := range nonConcreteTerms {
		if containsTokenOrPhrase(title, term) {
			return true, "vaga nao concreta: " + term
		}
	}

	administrativeTerms := []string{
		"assistente central de reservas",
		"central de reservas",
		"assistente de negocios",
		"central de relacionamento",
		"assistente contabil",
		"assistente financeiro",
		"assistente de autorizacao",
		"motorista",
		"motorista de van",
		"atendente",
		"analista qualidade",
		"analista de qualidade",
	}
	for _, term := range administrativeTerms {
		if containsTokenOrPhrase(title, term) {
			return true, "vaga administrativa: " + term
		}
	}

	return false, ""
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func ClassifyJobs(jobs []domain.Job) []domain.Job {
	classified := make([]domain.Job, 0, len(jobs))
	statsBySource := make(map[string]*sourceClassificationStats)

	for _, job := range jobs {
		stats := classificationStatsForSource(statsBySource, jobSource(job))
		stats.input++

		classification := Classify(job)
		if !classification.InScope {
			stats.rejected++
			if strings.TrimSpace(job.Description) != "" {
				stats.rejectedWithDescription++
			}
			if len(job.Keywords) > 0 || strings.TrimSpace(job.Keyword) != "" {
				stats.rejectedWithKeywords++
			}
			if len(classification.Technologies) > 0 {
				stats.rejectedWithTechnologies++
			}
			stats.rejectionReasons[classificationReason(classification)]++
			if classification.PrimaryFamily != "" {
				stats.rejectedFamilies[classification.PrimaryFamily]++
			}
			for _, technology := range classification.Technologies {
				if technology = strings.TrimSpace(technology); technology != "" {
					stats.rejectedTechnologies[technology]++
				}
			}
			stats.rejectedTitles[compactStatLabel(job.Title, "<sem titulo>")]++
			stats.rejectedCompanies[compactStatLabel(job.Company, "<sem empresa>")]++
			continue
		}

		stats.approved++
		job.Classification = &classification
		classified = append(classified, job)
	}

	logClassificationStats(statsBySource)

	return classified
}

func classificationStatsForSource(statsBySource map[string]*sourceClassificationStats, source string) *sourceClassificationStats {
	stats, ok := statsBySource[source]
	if ok {
		return stats
	}

	stats = &sourceClassificationStats{
		source:               source,
		rejectionReasons:     make(map[string]int),
		rejectedFamilies:     make(map[string]int),
		rejectedTechnologies: make(map[string]int),
		rejectedTitles:       make(map[string]int),
		rejectedCompanies:    make(map[string]int),
	}
	statsBySource[source] = stats
	return stats
}

func jobSource(job domain.Job) string {
	if source := strings.TrimSpace(job.Source); source != "" {
		return source
	}
	for _, source := range job.Sources {
		if source = strings.TrimSpace(source); source != "" {
			return source
		}
	}
	return "unknown"
}

func classificationReason(classification domain.Classification) string {
	for _, reason := range classification.Reasons {
		if reason = strings.TrimSpace(reason); reason != "" {
			return reason
		}
	}
	if classification.PrimaryFamily != "" && !classification.InScope {
		return "fora do escopo: " + classification.PrimaryFamily
	}
	return "fora do escopo"
}

func compactStatLabel(value, fallback string) string {
	value = strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
	if value == "" {
		return fallback
	}

	runes := []rune(value)
	if len(runes) > 90 {
		return string(runes[:90]) + "..."
	}

	return value
}

func logClassificationStats(statsBySource map[string]*sourceClassificationStats) {
	if len(statsBySource) == 0 {
		return
	}

	sources := make([]string, 0, len(statsBySource))
	for source := range statsBySource {
		sources = append(sources, source)
	}
	sort.Strings(sources)

	for _, source := range sources {
		stats := statsBySource[source]
		if stats.input == 0 {
			continue
		}

		slog.Info("classifier: funil por source",
			"source", stats.source,
			"input", stats.input,
			"approved", stats.approved,
			"rejected", stats.rejected,
			"rejected_with_description", stats.rejectedWithDescription,
			"rejected_with_keywords", stats.rejectedWithKeywords,
			"rejected_with_technologies", stats.rejectedWithTechnologies,
			"rejection_reasons", topCountLabels(stats.rejectionReasons, 5),
			"rejected_families", topCountLabels(stats.rejectedFamilies, 8),
			"rejected_technologies", topCountLabels(stats.rejectedTechnologies, 15),
			"top_rejected_titles", topCountLabels(stats.rejectedTitles, 12),
			"top_rejected_companies", topCountLabels(stats.rejectedCompanies, 12),
		)
	}
}

func topCountLabels(values map[string]int, limit int) []string {
	if len(values) == 0 || limit <= 0 {
		return nil
	}

	type countLabel struct {
		label string
		count int
	}

	items := make([]countLabel, 0, len(values))
	for label, count := range values {
		items = append(items, countLabel{label: label, count: count})
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].count == items[j].count {
			return items[i].label < items[j].label
		}
		return items[i].count > items[j].count
	})

	if len(items) > limit {
		items = items[:limit]
	}

	out := make([]string, 0, len(items))
	for _, item := range items {
		out = append(out, item.label+"="+strconv.Itoa(item.count))
	}

	return out
}

func scoreFamilies(text string) []familyScore {
	scores := make([]familyScore, 0, len(familyRules))

	for _, rule := range familyRules {
		score := 0

		for _, term := range rule.StrongTerms {
			if containsTokenOrPhrase(text, term) {
				score += 4
			}
		}
		for _, term := range rule.TechnologyTerms {
			if containsTokenOrPhrase(text, term) {
				score++
			}
		}
		for _, term := range rule.NegativeTerms {
			if containsTokenOrPhrase(text, term) {
				score -= 3
			}
		}

		if score > 0 {
			scores = append(scores, familyScore{family: rule.Family, score: score})
		}
	}

	return scores
}

func detectTechnologies(text string) []string {
	technologies := make([]string, 0)

	for technology, aliases := range technologyAliases {
		for _, alias := range aliases {
			if containsTokenOrPhrase(text, alias) {
				technologies = append(technologies, technology)
				break
			}
		}
	}

	technologies = unique(technologies)
	sort.Strings(technologies)
	return technologies
}

func detectSeniority(text string) string {
	if containsAny(text, "estagio", "estagiario", "intern", "internship", "trainee") {
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

func containsAny(text string, needles ...string) bool {
	for _, needle := range needles {
		if containsTokenOrPhrase(text, needle) {
			return true
		}
	}
	return false
}
