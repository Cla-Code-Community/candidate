package dedup

import (
	"net/url"
	"strings"
	"unicode"

	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
)

func DedupeJobs(jobs []domain.Job) []domain.Job {
	unique := make(map[string]*domain.Job, len(jobs))

	for i := range jobs {
		job := jobs[i]
		key := buildKey(&job)

		if existing, ok := unique[key]; ok {
			merged := merge(existing, &job)
			unique[key] = merged
			continue
		}

		if len(job.Sources) == 0 {
			job.Sources = []string{job.Source}
		}
		if len(job.Keywords) == 0 && strings.TrimSpace(job.Keyword) != "" {
			job.Keywords = []string{job.Keyword}
		}

		unique[key] = &job
	}

	result := make([]domain.Job, 0, len(unique))
	for _, j := range unique {
		result = append(result, *j)
	}

	return result
}

func buildKey(j *domain.Job) string {
	title := normalizeText(j.Title)
	company := normalizeText(j.Company)
	location := normalizeText(j.Location)

	if title != "" && company != "" && location != "" {
		return "identity:" + title + "|" + company + "|" + location
	}

	if title != "" && company != "" {
		loc := location
		if loc == "" {
			loc = "sem-local"
		}
		return "identity:" + title + "|" + company + "|" + loc
	}

	if link := normalizeURL(j.URL); link != "" {
		return "url:" + link
	}

	return "fallback:" + title + "|" + company + "|" + location + "|" + normalizeText(j.Source)
}

func merge(existing, incoming *domain.Job) *domain.Job {
	merged := *existing

	merged.Sources = uniqueStrings(append(existing.Sources, incoming.Sources...))
	merged.Source = strings.Join(merged.Sources, ", ")

	merged.Keywords = uniqueStrings(append(existing.Keywords, incoming.Keywords...))
	if len(merged.Keywords) > 0 {
		merged.Keyword = merged.Keywords[0]
	}

	merged.Title = longest(existing.Title, incoming.Title)
	merged.Company = longest(existing.Company, incoming.Company)
	merged.Location = longest(existing.Location, incoming.Location)
	merged.URL = longest(existing.URL, incoming.URL)

	return &merged
}

func normalizeText(s string) string {
	t := transform.Chain(norm.NFD, transform.RemoveFunc(func(r rune) bool {
		return unicode.Is(unicode.Mn, r)
	}), norm.NFC)

	result, _, _ := transform.String(t, s)

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

func normalizeURL(raw string) string {
	if raw == "" {
		return ""
	}

	u, err := url.Parse(raw)
	if err != nil {
		if idx := strings.IndexAny(raw, "?#"); idx != -1 {
			raw = raw[:idx]
		}
		return strings.TrimRight(raw, "/")
	}

	u.RawQuery = ""
	u.Fragment = ""

	return strings.TrimRight(u.String(), "/")
}

func coalesce(values ...string) string {
	for _, v := range values {
		if v = strings.TrimSpace(v); v != "" {
			return v
		}
	}
	return ""
}

func longest(a, b string) string {
	if len(b) > len(a) {
		return b
	}
	return a
}

func uniqueStrings(input []string) []string {
	seen := make(map[string]struct{}, len(input))
	out := make([]string, 0, len(input))

	for _, s := range input {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		if _, ok := seen[s]; !ok {
			seen[s] = struct{}{}
			out = append(out, s)
		}
	}

	return out
}
