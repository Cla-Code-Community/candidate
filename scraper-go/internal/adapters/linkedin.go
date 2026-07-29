package adapters

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/dedup"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/models"
	"github.com/PuerkitoBio/goquery"
)

const linkedinSearchURL = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
const linkedinPageStep = 25

type LinkedInAdapter struct {
	client    *http.Client
	semaphore chan struct{}
}

func NewLinkedIn() *LinkedInAdapter {
	return &LinkedInAdapter{
		client:    &http.Client{Timeout: 1 * time.Minute},
		semaphore: make(chan struct{}, 5),
	}
}

func (a *LinkedInAdapter) SourceName() string { return "linkedin" }

func buildLinkedInURL(keyword string, req models.ScrapeRequest, start int) string {
	u, _ := url.Parse(linkedinSearchURL)
	q := u.Query()
	q.Set("keywords", keyword)
	if req.SearchLocation != "" {
		q.Set("location", req.SearchLocation)
	}
	if req.SearchGeoID != "" {
		q.Set("geoId", req.SearchGeoID)
	}
	if req.SearchLanguage != "" {
		q.Set("lang", req.SearchLanguage)
	}
	if req.RemoteOnly {
		q.Set("f_WT", "2")
	}
	if req.JobTypes != "" {
		q.Set("f_JT", req.JobTypes)
	}
	if req.TimeFilter != "" {
		q.Set("f_TPR", req.TimeFilter)
	}
	q.Set("start", fmt.Sprintf("%d", start))
	u.RawQuery = q.Encode()
	return u.String()
}

func (a *LinkedInAdapter) fetchJobsChunk(ctx context.Context, keyword string, req models.ScrapeRequest, start int) ([]models.Job, error) {
	pageTimeout := time.Duration(req.PageTimeoutMs) * time.Millisecond
	if pageTimeout <= 0 {
		pageTimeout = 15 * time.Second
	}

	endpoint := buildLinkedInURL(keyword, req, start)

	pageCtx, cancel := context.WithTimeout(ctx, pageTimeout)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(pageCtx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}

	httpReq.Header.Set("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
	httpReq.Header.Set("accept-language", "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7")

	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		return nil, fmt.Errorf("status 429")
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}

	doc, err := goquery.NewDocumentFromReader(resp.Body)
	if err != nil {
		return nil, err
	}

	var jobs []models.Job
	doc.Find(".base-card, .job-search-card").Each(func(_ int, card *goquery.Selection) {
		titulo := strings.TrimSpace(card.Find(".base-search-card__title").Text())
		if titulo == "" {
			titulo = strings.TrimSpace(card.Find("h3").First().Text())
		}
		empresa := strings.TrimSpace(card.Find(".base-search-card__subtitle").Text())
		if empresa == "" {
			empresa = strings.TrimSpace(card.Find("h4").First().Text())
		}
		local := strings.TrimSpace(card.Find(".job-search-card__location").Text())
		link, _ := card.Find("a.base-card__full-link").Attr("href")
		if link == "" {
			link, _ = card.Find("a[href*='/jobs/view/']").Attr("href")
		}
		jobs = append(jobs, models.Job{
			Title:    titulo,
			Company:  empresa,
			Location: local,
			URL:      link,
		})
	})

	return jobs, nil
}

func normalizeLinkedInLocation(location string, req models.ScrapeRequest) string {
	location = strings.TrimSpace(location)
	searchLocation := strings.TrimSpace(req.SearchLocation)
	if searchLocation == "" {
		return location
	}

	normalizedLocation := strings.ToLower(location)
	normalizedSearchLocation := strings.ToLower(searchLocation)
	if normalizedLocation == "" {
		return searchLocation
	}
	if strings.Contains(normalizedLocation, normalizedSearchLocation) {
		return location
	}
	if linkedInLocationHasKnownCountry(location) {
		return location
	}

	return location + ", " + searchLocation
}

func linkedInLocationHasKnownCountry(location string) bool {
	normalized := normalizeLinkedInComparable(location)
	knownMarkers := []string{
		"estados unidos",
		"united states",
		"usa",
		"eua",
		"florida",
		"miami",
		"new york",
		"california",
		"texas",
		"boston",
		"seattle",
		"chicago",
		"atlanta",
		"denver",
		"portugal",
		"lisboa",
		"porto",
		"canada",
		"toronto",
		"vancouver",
		"reino unido",
		"united kingdom",
		"london",
		"france",
		"paris",
		"germany",
		"berlin",
	}

	for _, marker := range knownMarkers {
		if strings.Contains(normalized, marker) {
			return true
		}
	}

	return false
}

func normalizeLinkedInComparable(value string) string {
	replacer := strings.NewReplacer(
		"á", "a", "à", "a", "ã", "a", "â", "a",
		"é", "e", "ê", "e",
		"í", "i",
		"ó", "o", "ô", "o", "õ", "o",
		"ú", "u",
		"ç", "c",
	)
	return replacer.Replace(strings.ToLower(strings.TrimSpace(value)))
}

func normalizeLinkedInJob(keyword string, req models.ScrapeRequest, job models.Job) models.Job {
	u := dedup.NormalizeURL(strings.TrimSpace(job.URL))

	normalized := models.Job{
		Title:    strings.TrimSpace(job.Title),
		Company:  strings.TrimSpace(job.Company),
		Location: normalizeLinkedInLocation(job.Location, req),
		URL:      u,
		Source:   "LinkedIn",
		Sources:  []string{"LinkedIn"},
		Keyword:  keyword,
		Keywords: []string{keyword},
	}

	// ID estável derivado de título+empresa+local — consistente entre execuções
	normalized.ID = jobstore.StableID(&normalized)

	return normalized
}

func dedupeLinkedIn(jobs []models.Job) []models.Job {
	unique := make(map[string]models.Job, len(jobs))
	order := make([]string, 0, len(jobs))
	for _, job := range jobs {
		key := job.URL
		if key == "" {
			key = job.Title + "-" + job.Company + "-" + job.Location
		}
		if key == "" {
			continue
		}
		if _, exists := unique[key]; !exists {
			unique[key] = job
			order = append(order, key)
		}
	}
	result := make([]models.Job, 0, len(order))
	for _, key := range order {
		result = append(result, unique[key])
	}
	return result
}

func (a *LinkedInAdapter) Search(ctx context.Context, keyword string, req models.ScrapeRequest) ([]models.Job, error) {
	// Semáforo: no máximo 2 keywords rodando ao mesmo tempo no LinkedIn
	a.semaphore <- struct{}{}
	defer func() { <-a.semaphore }()

	maxPages := req.MaxPagesPerKeyword
	if maxPages <= 0 {
		maxPages = 5
	}

	waitBetween := time.Duration(req.WaitBetweenSearchesMs) * time.Millisecond
	if waitBetween <= 0 {
		waitBetween = 3000 * time.Millisecond
	}

	var allJobs []models.Job

	for pageIndex := 0; pageIndex < maxPages; pageIndex++ {
		start := pageIndex * linkedinPageStep

		jobs, err := a.fetchJobsChunk(ctx, keyword, req, start)
		if err != nil {
			// 429 → back-off e tenta a mesma página uma vez
			if strings.Contains(err.Error(), "429") {
				backoff := 15 * time.Second
				select {
				case <-ctx.Done():
					return dedupeLinkedIn(allJobs), nil
				case <-time.After(backoff):
				}
				jobs, err = a.fetchJobsChunk(ctx, keyword, req, start)
				if err != nil {
					// Segunda falha: aborta essa keyword mas não o scraper inteiro
					return dedupeLinkedIn(allJobs), fmt.Errorf("linkedin: 429 persistente para %q (start=%d): %w", keyword, start, err)
				}
			} else {
				if pageIndex == 0 {
					return allJobs, fmt.Errorf("linkedin: falha HTTP na busca para %q (start=%d): %w", keyword, start, err)
				}
				break
			}
		}

		if len(jobs) == 0 {
			break
		}

		for _, job := range jobs {
			allJobs = append(allJobs, normalizeLinkedInJob(keyword, req, job))
		}

		if pageIndex < maxPages-1 {
			select {
			case <-ctx.Done():
				return dedupeLinkedIn(allJobs), nil
			case <-time.After(waitBetween):
			}
		}
	}

	return dedupeLinkedIn(allJobs), nil
}
