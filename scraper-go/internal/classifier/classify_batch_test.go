package classifier

import (
	"fmt"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/metrics"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/taxonomy"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
	"math"
	"math/rand"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"
	"unicode"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClassifyJobsMatchesIndividualClassify(t *testing.T) {
	jobs := []domain.Job{
		{Title: "Backend Engineer", Company: "Acme", Description: "Golang APIs microservices"},
		{Title: "Front-end Software Developer", Company: "Acme", Description: "React TypeScript"},
		{Title: "Graphic Designer", Company: "Acme", Description: "Branding"},
		{Title: "DevOps Engineer", Company: "Acme", Description: "Kubernetes terraform aws"},
	}

	batched := ClassifyJobs(jobs)
	require.Len(t, batched, 3)

	var individual []domain.Job
	for _, job := range jobs {
		classification := Classify(job)
		if !classification.InScope {
			continue
		}
		job.Classification = &classification
		individual = append(individual, job)
	}

	require.Len(t, individual, len(batched))
	for i := range batched {
		require.NotNil(t, batched[i].Classification)
		require.NotNil(t, individual[i].Classification)
		assert.Equal(t, individual[i].Classification.PrimaryFamily, batched[i].Classification.PrimaryFamily)
		assert.Equal(t, individual[i].Classification.InScope, batched[i].Classification.InScope)
		assert.Equal(t, individual[i].Classification.Confidence, batched[i].Classification.Confidence)
		assert.Equal(t, individual[i].Classification.Seniority, batched[i].Classification.Seniority)
		assert.Equal(t, individual[i].Classification.Technologies, batched[i].Classification.Technologies)
		assert.Equal(t, individual[i].Classification.RelatedFamilies, batched[i].Classification.RelatedFamilies)
	}
}

func TestCurrentFamiliesPreservedAndProductFamiliesAdded(t *testing.T) {
	got := make([]string, 0, len(familyRules))
	for _, rule := range familyRules {
		got = append(got, rule.Family)
	}

	assert.Equal(t, []string{
		"backend",
		"frontend",
		"mobile",
		"fullstack",
		"platform",
		"devops",
		"data",
		"qa",
		"security",
		"leadership",
		"software",
		"product",
		"product_design",
	}, got)
}

// Frozen classifier from 7f3ac75, kept only as a differential test oracle.
func referenceClassify(job domain.Job) (classification domain.Classification) {
	started := time.Now()
	defer func() { metrics.Classification(job, classification, started) }()
	text := referenceNormalizeText(strings.Join([]string{
		job.Title,
		job.Company,
		job.Location,
		job.Modality,
		job.Description,
	}, " "))

	title := referenceNormalizeText(job.Title)
	scores, exclusions := referenceScoreFamilies(text, title)
	titleScores, _ := referenceScoreFamilies(title, title)
	// Title-supported technical candidates survive conflicting description evidence.
	for _, ts := range titleScores {
		if ts.evidence == "" {
			continue
		}
		found := false
		for i := range scores {
			if ts.family != scores[i].family {
				continue
			}
			found = true
			scores[i].titlePriority = ts.titlePriority
			if ts.titlePriority <= titlePriorityLeadership {
				scores[i].score = ts.score
			}
			scores[i].evidence = ts.evidence
			break
		}
		if !found {
			scores = append(scores, ts)
		}
	}
	technologies := referenceDetectTechnologies(text)
	seniority := referenceDetectSeniority(text)

	if blocked, reason := referenceBlockedOpeningReason(job); blocked {
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
			Reasons:       append([]string{"nenhuma familia reconhecida"}, exclusions...),
		}
	}

	sort.Slice(scores, func(i, j int) bool {
		if scores[i].titlePriority != scores[j].titlePriority {
			return scores[i].titlePriority > scores[j].titlePriority
		}
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
	if primary.family == "mobile" && referenceContainsString(technologies, "react-native") {
		related = append(related, "frontend")
	}

	if primary.family == "fullstack" {
		related = append(related, "backend", "frontend")
	}
	confidence := math.Min(0.99, 0.35+(float64(primary.score)*0.08))

	reason := "classificacao local por titulo descricao tecnologias"
	if primary.evidence != "" {
		reason = "titulo: " + primary.evidence
	}
	if primary.score < 2 {
		reason = "score abaixo do minimo"
	}

	return domain.Classification{
		PrimaryFamily:   primary.family,
		RelatedFamilies: taxonomy.Related(primary.family, related),
		Technologies:    technologies,
		Seniority:       seniority,
		InScope:         primary.score >= 2,
		Confidence:      math.Round(confidence*100) / 100,
		Reasons:         append([]string{reason}, exclusions...),
	}
}

func referenceBlockedOpeningReason(job domain.Job) (bool, string) {
	title := referenceNormalizeText(job.Title)
	if title == "" {
		return false, ""
	}

	nonConcreteTerms := []string{
		"banco de talentos",
		"talent pool",
		"cadastro reserva",
	}
	for _, term := range nonConcreteTerms {
		if referenceContainsTokenOrPhrase(title, term) {
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
		if referenceContainsTokenOrPhrase(title, term) {
			return true, "vaga administrativa: " + term
		}
	}

	return false, ""
}

func referenceContainsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func referenceScoreFamilies(text, title string) ([]familyScore, []string) {
	scores := make([]familyScore, 0, len(familyRules))
	var exclusions []string

	for _, rule := range familyRules {
		score := 0
		evidence := ""
		strongText := text
		if rule.TitleRequired {
			strongText = title
			blocked := false
			for _, term := range rule.NegativeTerms {
				if referenceContainsWholePhrase(title, term) {
					if referenceHasTitleFamilyContext(title, rule.Family) {
						exclusions = append(exclusions, "exclusao "+rule.Family+": "+term)
					}
					blocked = true
					break
				}
			}
			if blocked {
				continue
			}
		}

		for _, term := range rule.StrongTerms {
			var matches bool
			if rule.TitleRequired {
				matches = referenceContainsWholePhrase(strongText, term)
			} else {
				matches = referenceContainsTokenOrPhrase(strongText, term)
			}
			if matches {
				score += 4
				if rule.TitleRequired && evidence == "" {
					evidence = term
				}
			}
		}
		priority := rule.TitlePriority
		if rule.TitleRequired {
			priority += titlePriorityProductOffset
		}
		if !rule.TitleRequired {
			for _, term := range rule.StrongTerms {
				if referenceContainsTokenOrPhrase(title, term) {
					evidence = term
					priority = titlePriorityTechnical
					break
				}
			}
			if evidence != "" && rule.Family == "leadership" {
				priority = titlePriorityLeadership
			}
		}
		if rule.TitleRequired && evidence == "" {
			continue
		}
		complementary := 0
		for _, term := range rule.TechnologyTerms {
			if referenceContainsTokenOrPhrase(text, term) {
				complementary++
			}
		}
		if rule.TitleRequired {
			complementary = min(complementary, 3)
		}
		score += complementary
		if !rule.TitleRequired {
			for _, term := range rule.NegativeTerms {
				if referenceContainsTokenOrPhrase(text, term) {
					score -= 3
				}
			}
		}

		if score > 0 {
			scores = append(scores, familyScore{family: rule.Family, score: score, titlePriority: priority, evidence: evidence})
		}
	}

	return scores, exclusions
}

func referenceContainsWholePhrase(text, term string) bool {
	return strings.Contains(" "+text+" ", " "+referenceNormalizeText(term)+" ")
}

func referenceHasTitleFamilyContext(title, family string) bool {
	if family == "product" {
		return referenceContainsAny(title, "product", "produto", "produtos", "production", "producao")
	}
	return referenceContainsAny(title, "designer", "design", "ux", "ui")
}

func referenceDetectTechnologies(text string) []string {
	technologies := make([]string, 0)

	for technology, aliases := range technologyAliases {
		for _, alias := range aliases {
			if referenceContainsTokenOrPhrase(text, alias) {
				technologies = append(technologies, technology)
				break
			}
		}
	}

	technologies = referenceUnique(technologies)
	sort.Strings(technologies)
	return technologies
}

func referenceDetectSeniority(text string) string {
	if referenceContainsAny(text, "estagio", "estagiario", "intern", "internship", "trainee") {
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

func referenceContainsAny(text string, needles ...string) bool {
	for _, needle := range needles {
		if referenceContainsTokenOrPhrase(text, needle) {
			return true
		}
	}
	return false
}

func referenceNormalizeText(value string) string {
	t := transform.Chain(norm.NFD, transform.RemoveFunc(func(r rune) bool {
		return unicode.Is(unicode.Mn, r)
	}), norm.NFC)

	result, _, _ := transform.String(t, value)

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

func referenceContainsTokenOrPhrase(text, needle string) bool {
	needle = referenceNormalizeText(needle)
	if needle == "" {
		return false
	}
	if strings.Contains(needle, " ") {
		return strings.Contains(text, needle)
	}
	return strings.Contains(" "+text+" ", " "+needle+" ")
}

func referenceUnique(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))

	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}

	return result
}

func classifierBenchJobs(size int) []domain.Job {
	titles := []string{"Backend Engineer", "Back-end Developer", "Front-end Developer", "Full-stack Engineer", "Platform Engineer", "DevOps Engineer", "Data Scientist", "QA Engineer", "Security Engineer", "Engineering Manager", "Software Engineer", "Product Manager", "Product Designer", "UX Researcher", "Graphic Designer", "Motorista", "Banco de Talentos"}
	paragraph := "Responsibilities: build distributed systems, APIs and microservices using Go, Node.js, C#, .NET, Java and PostgreSQL. Work with React, TypeScript, Kubernetes, AWS, Kafka and Redis. Collaborate with product managers and UX researchers on roadmap, discovery, usability and design systems. Senior remote role; junior applicants and internship experience welcome. Comunicação e operações de produto. "
	text := strings.Repeat(paragraph, size/len(paragraph)+1)[:size]
	jobs := make([]domain.Job, 100)
	for i := range jobs {
		jobs[i] = domain.Job{Title: titles[i%len(titles)], Company: fmt.Sprintf("Acme %d", i), Location: "São Paulo, Brasil", Modality: "Remote", Description: text, Source: "greenhouse"}
	}
	return jobs
}

func TestClassifyEquivalentToCommittedClassifier(t *testing.T) {
	jobs := classifierBenchJobs(4096)
	jobs = append(jobs, classifierBenchJobs(16384)...)
	for _, text := range []string{"", "back end", "back-end", "front end", "front-end", "full stack", "full-stack", "C# .NET Node.js", "anode json", "Product Manager", "Product Management", "Product Designer", "Product Design Manager", "Production Manager", "Graphic Designer", "UX/UI Designer", "Talent Pool", "Assistente Financeiro", "Senior", "Júnior", "Estágio", "BACK-END ENGINEER", "operações de produto", "operações de produto", "Backend\tEngineer\nGo", "DevOps Platform Engineer", "Engineering Manager Backend", "Product Security Engineer"} {
		jobs = append(jobs, domain.Job{Title: text, Description: text, Company: "Acme", Location: "Brasil"})
	}
	rng := rand.New(rand.NewSource(178))
	words := []string{"back-end", "back end", "front-end", "full-stack", "go", "gopher", "node.js", "C#", ".NET", "product manager", "product designer", "production", "graphic designer", "senior", "estágio", "remote", "marketing", "engineer", "platform", "devops", "software", "react native", "data scientist", "banco de talentos", "operações"}
	for i := 0; i < 150; i++ {
		parts := make([]string, 10)
		for n := range parts {
			parts[n] = words[rng.Intn(len(words))]
		}
		jobs = append(jobs, domain.Job{Title: strings.Join(parts[:3], " "), Company: parts[3], Location: parts[4], Modality: parts[5], Description: strings.Join(parts, " / ")})
	}
	for i, job := range jobs {
		t.Run(fmt.Sprint(i), func(t *testing.T) { require.Equal(t, referenceClassify(job), Classify(job)) })
	}
}

func TestScoringRetainsEquivalentTermContributions(t *testing.T) {
	for _, title := range []string{"back end", "front end", "full stack", "backend product designer", "platform devops engineer", "product manager marketing", "graphic designer"} {
		normalized := referenceNormalizeText(title)
		want, exclusions := referenceScoreFamilies(normalized, normalized)
		got, actualExclusions := scoreFamilies(normalized, normalized)
		require.Equal(t, want, got)
		require.Equal(t, exclusions, actualExclusions)
	}
	scores, _ := scoreFamilies("back end", "back end")
	for _, score := range scores {
		if score.family == "backend" {
			require.Equal(t, 8, score.score)
			return
		}
	}
	t.Fatal("backend score missing")
}

func TestClassifierMatchingBoundariesEquivalent(t *testing.T) {
	for _, text := range []string{"", " ", "go", "gopher go", "go-go", "go\tgo", "anode json", "product manager", "aproduct managerx", "c net", "a  b", "é go é"} {
		for _, term := range []string{"", "go", "node js", "product manager", "C#", ".NET", "---", "a b", "é"} {
			require.Equal(t, referenceContainsTokenOrPhrase(text, term), containsTokenOrPhrase(text, term), "%q / %q", text, term)
			require.Equal(t, referenceContainsWholePhrase(text, term), containsWholePhrase(text, term), "whole %q / %q", text, term)
		}
	}
}

func TestClassifierPreparedRulesAreSafeForConcurrentUse(t *testing.T) {
	job := classifierBenchJobs(4096)[0]
	want := referenceClassify(job)
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for n := 0; n < 10; n++ {
				assert.Equal(t, want, Classify(job))
			}
		}()
	}
	wg.Wait()
}

func BenchmarkClassifyBatch(b *testing.B) {
	for _, size := range []int{4096, 16384} {
		jobs := classifierBenchJobs(size)
		for _, job := range jobs {
			require.Equal(b, referenceClassify(job), Classify(job))
		}
		b.Run(fmt.Sprintf("%dKiB", size/1024), func(b *testing.B) {
			b.ReportAllocs()
			b.ResetTimer()
			for n := 0; n < b.N; n++ {
				for _, job := range jobs {
					Classify(job)
				}
			}
		})
	}
}
