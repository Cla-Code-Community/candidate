package pipeline

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/dedup"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/metrics"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/models"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/redis/go-redis/v9"
)

const defaultMaxConcurrency = 150

type result struct {
	jobs []models.Job
	err  error
}

// func Run(ctx context.Context, adapterList []adapters.Adapter, req models.ScrapeRequest) []models.Job {
// 	maxConcurrency := req.MaxConcurrency
// 	if maxConcurrency <= 0 {
// 		maxConcurrency = defaultMaxConcurrency
// 	}

// 	type task struct {
// 		adapter adapters.Adapter
// 		keyword string
// 	}

// 	tasks := make([]task, 0, len(adapterList)*len(req.Keywords))
// 	for _, a := range adapterList {
// 		for _, kw := range req.Keywords {
// 			tasks = append(tasks, task{adapter: a, keyword: kw})
// 		}
// 	}

// 	sem := make(chan struct{}, maxConcurrency)
// 	results := make(chan result, len(tasks))
// 	var wg sync.WaitGroup

// 	for _, t := range tasks {
// 		wg.Add(1)
// 		sem <- struct{}{}

// 		go func(t task) {
// 			defer wg.Done()
// 			defer func() { <-sem }()

// 			jobs, err := t.adapter.Search(ctx, t.keyword, req)
// 			results <- result{jobs: jobs, err: err}

// 			if err != nil {
// 				slog.Warn("adapter falhou",
// 					"source", t.adapter.SourceName(),
// 					"keyword", t.keyword,
// 					"error", err,
// 				)
// 				return
// 			}

// 			slog.Info("adapter concluído",
// 				"source", t.adapter.SourceName(),
// 				"keyword", t.keyword,
// 				"count", len(jobs),
// 			)
// 		}(t)
// 	}

// 	go func() {
// 		wg.Wait()
// 		close(results)
// 	}()

// 	var allJobs []models.Job
// 	for r := range results {
// 		if r.err == nil {
// 			allJobs = append(allJobs, r.jobs...)
// 		}
// 	}

// 	return dedup.DedupeJobs(allJobs)
// }

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

		titleLower := strings.ToLower(job.Title)
		descLower := strings.ToLower(job.Description)

		for _, kw := range keywords {
			sanitizedKw := strings.ToLower(strings.TrimSpace(kw))
			if sanitizedKw == "" {
				continue
			}

			normalizedKw := strings.ReplaceAll(sanitizedKw, "/", " ")
			subTerms := strings.Fields(normalizedKw)

			// Keyword composta: todos os sub-termos precisam aparecer
			matchAll := true
			for _, term := range subTerms {
				if !strings.Contains(titleLower, term) && !strings.Contains(descLower, term) {
					matchAll = false
					break
				}
			}

			if matchAll {
				fullKey := fmt.Sprintf("scraper:jobs:keyword:%s", strings.Join(subTerms, " "))
				kwIndex[fullKey] = append(kwIndex[fullKey], id)
			}

			// Sub-termos individuais
			for _, term := range subTerms {
				if term == "" {
					continue
				}
				if strings.Contains(titleLower, term) || strings.Contains(descLower, term) {
					termKey := fmt.Sprintf("scraper:jobs:keyword:%s", term)
					kwIndex[termKey] = append(kwIndex[termKey], id)
				}
			}
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
