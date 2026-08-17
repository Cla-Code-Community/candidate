package cronjob

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/keywords"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/pipeline"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
)

type Config struct {
	Interval       time.Duration
	ScrapeTimeout  time.Duration
	SearchLocation string
	JobTypes       string
	TimeFilter     string
	RemoteOnly     bool
	MaxConcurrency int
}

func DefaultConfig() Config {
	return Config{
		Interval:       3 * time.Hour,
		ScrapeTimeout:  40 * time.Minute,
		SearchLocation: "Brasil",
		JobTypes:       "C,F",
		TimeFilter:     "r604800",
		RemoteOnly:     false,
		MaxConcurrency: 40,
	}
}

type Scheduler struct {
	cfg         Config
	kwStore     *keywords.Store
	jobStore    *jobstore.Store
	adapterList []ports.JobSource
	rdb         *redis.Client
	OnComplete  func(keywords []string, scraped, saved int, duration time.Duration)
	mu          sync.Mutex
	running     bool
	lastRunAt   time.Time
	lastJobs    int
	stop        chan struct{}
}

func New(cfg Config, kwStore *keywords.Store, jobStore *jobstore.Store, adapterList []ports.JobSource, rdb *redis.Client) *Scheduler {
	return &Scheduler{
		cfg:         cfg,
		kwStore:     kwStore,
		jobStore:    jobStore,
		adapterList: adapterList,
		rdb:         rdb,
		OnComplete:  nil,
		stop:        make(chan struct{}),
	}
}

func (s *Scheduler) Start(ctx context.Context) {
	slog.Info("cronjob: scheduler iniciado", "interval", s.cfg.Interval)

	go func() {
		s.run(ctx)

		ticker := time.NewTicker(s.cfg.Interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				s.run(ctx)
			case <-s.stop:
				slog.Info("cronjob: scheduler encerrado")
				return
			case <-ctx.Done():
				slog.Info("cronjob: contexto cancelado, encerrando scheduler")
				return
			}
		}
	}()
}

func (s *Scheduler) Stop() {
	close(s.stop)
}

func (s *Scheduler) RunNow(ctx context.Context) error {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return ErrAlreadyRunning
	}
	s.mu.Unlock()

	go s.run(ctx)
	return nil
}

func (s *Scheduler) IsRunning() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.running
}

func (s *Scheduler) Snapshot() (running bool, lastRunAt time.Time, jobsCollected int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.running, s.lastRunAt, s.lastJobs
}

func (s *Scheduler) run(ctx context.Context) {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		slog.Warn("cronjob: execução ignorada, já há uma em andamento")
		return
	}
	s.running = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.running = false
		s.mu.Unlock()
	}()

	start := time.Now()
	slog.Info("cronjob: iniciando execução")

	scrapeCtx, cancel := context.WithTimeout(ctx, s.cfg.ScrapeTimeout)
	defer cancel()

	kws, err := s.kwStore.Load(scrapeCtx)
	if err != nil || len(kws) == 0 {
		slog.Error("cronjob: falha ao carregar keywords", "error", err)
		return
	}

	config := pipeline.SearchConfig{
		Keywords:       kws,
		SearchLocation: s.cfg.SearchLocation,
		JobTypes:       s.cfg.JobTypes,
		TimeFilter:     s.cfg.TimeFilter,
		RemoteOnly:     s.cfg.RemoteOnly,
		MaxConcurrency: s.cfg.MaxConcurrency,
	}

	jobs, err := pipeline.ScrapeAllSources(scrapeCtx, config, s.adapterList, s.rdb)
	if err != nil {
		slog.Error("cronjob: scrape falhou", "error", err)
		return
	}

	// Salva apenas vagas novas
	saved, err := s.jobStore.SaveBatch(scrapeCtx, jobs)
	if err != nil {
		slog.Error("cronjob: erro ao salvar vagas", "error", err)
		return
	}

	// ✅ Constrói o índice invertido para buscas por keyword
	pipeline.IndexJobsInValkey(scrapeCtx, s.rdb, jobs, kws)

	s.mu.Lock()
	s.lastRunAt = time.Now()
	s.lastJobs = len(jobs)
	s.mu.Unlock()

	slog.Info("cronjob: execução concluída",
		"duration", time.Since(start).Round(time.Second),
		"scraped", len(jobs),
		"new_saved", saved,
		"skipped", len(jobs)-saved,
		"next_run", time.Now().Add(s.cfg.Interval).Format(time.Kitchen),
	)

	if s.OnComplete != nil {
		s.OnComplete(kws, len(jobs), saved, time.Since(start))
	}
}

type alreadyRunningError struct{}

func (e alreadyRunningError) Error() string {
	return "cronjob: scraper já está em execução"
}

var ErrAlreadyRunning error = alreadyRunningError{}
