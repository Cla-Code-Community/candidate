package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/cache"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/cronjob"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/keywords"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/redis/go-redis/v9"
)

func run(adapterList []adapters.Adapter) {
	addr := os.Getenv("GO_SCRAPER_ADDR")
	if addr == "" {
		addr = ":8081"
	}

	c, err := cache.NewCache()
	if err != nil {
		slog.Error("falha ao conectar ao Valkey", "error", err)
		os.Exit(1)
	}
	slog.Info("cache inicializado", "provider", c.Status().Provider)

	rdb, err := newRedisClient()
	if err != nil {
		slog.Error("falha ao conectar cliente Redis/Valkey", "error", err)
		os.Exit(1)
	}

	// ── Módulos ──
	kwStore := keywords.NewStore(c)
	jobStore := jobstore.New(rdb)

	// ── Scheduler (cronjob) ──
	schedulerCfg := cronjob.DefaultConfig()
	scheduler := cronjob.New(schedulerCfg, kwStore, jobStore, rdb)

	scheduler.OnComplete = func(kws []string, scraped, saved int, duration time.Duration) {
		printSummary(len(adapterList), kws, scraped, duration)
	}

	// ── Rotas ──
	mux := http.NewServeMux()

	// Públicas
	mux.Handle("POST /scrape", handleScrape(adapterList, kwStore, c, rdb))
	mux.Handle("GET /health", handleHealth(c))
	mux.Handle("GET /metrics", promhttp.Handler())
	mux.Handle("GET /api/keywords", handleGetKeywords(kwStore))
	mux.Handle("POST /api/keywords", handleSaveKeywords(kwStore))

	// Administrativas
	mux.Handle("POST /admin/scrape", handleTriggerScrape(scheduler))
	mux.Handle("GET /admin/scrape/status", handleScraperStatus(scheduler))
	mux.Handle("GET /admin/jobs", handleGetJobs(jobStore))
	mux.Handle("GET /admin/jobs/count", handleJobsCount(jobStore))

	srv := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 20 * time.Minute,
		IdleTimeout:  60 * time.Second,
	}

	// ── Background: inicia o scheduler ──
	bgCtx, bgCancel := context.WithCancel(context.Background())
	defer bgCancel()
	scheduler.Start(bgCtx)

	// ── Graceful shutdown ──
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGTERM, syscall.SIGINT)

	go func() {
		slog.Info("go-scraper em execução", "addr", addr)
		if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
			slog.Error("falha crítica no servidor", "error", err)
			os.Exit(1)
		}
	}()

	<-stop
	slog.Info("sinal de interrupção recebido, desligando...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	scheduler.Stop()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("erro durante o shutdown", "error", err)
	}

	slog.Info("servidor encerrado com sucesso")
}

func newRedisClient() (*redis.Client, error) {
	url := os.Getenv("VALKEY_URL")
	if url == "" {
		url = "redis://localhost:6379"
	}

	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}

	rdb := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		_ = rdb.Close()
		return nil, err
	}

	return rdb, nil
}
