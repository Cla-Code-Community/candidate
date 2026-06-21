package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	ScrapeRunsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "scraper_runs_total",
			Help: "Total de execuções por adapter/keyword",
		},
		[]string{"adapter"},
	)

	ScrapeDurationSeconds = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "scraper_duration_seconds",
			Help:    "Tempo gasto em cada execução de adapter",
			Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30, 60, 120},
		},
		[]string{"adapter"},
	)

	JobsFoundTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "scraper_jobs_found_total",
			Help: "Total de vagas encontradas por adapter",
		},
		[]string{"adapter"},
	)

	ScrapeErrorsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "scraper_errors_total",
			Help: "Total de erros por adapter",
		},
		[]string{"adapter"},
	)

	// Métricas de pipeline (rodada completa de scrape, não por adapter)
	PipelineRunDuration = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "scraper_pipeline_duration_seconds",
			Help:    "Duração total de uma rodada completa do pipeline (todos os adapters)",
			Buckets: []float64{1, 5, 10, 30, 60, 120, 300, 600},
		},
	)

	PipelineJobsTotal = promauto.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "scraper_pipeline_jobs_total",
			Help:    "Total de vagas (após dedup) por rodada de pipeline",
			Buckets: []float64{0, 10, 50, 100, 500, 1000, 5000},
		},
	)

	IndexedKeywordsTotal = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "scraper_indexed_keywords",
			Help: "Quantidade de chaves de keyword indexadas no Valkey na última rodada",
		},
	)
)
