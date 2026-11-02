package cronjob

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/metrics"

	"github.com/redis/go-redis/v9"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/config"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/keywords"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/pipeline"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/runlock"
)

type Config struct {
	ProviderWindows              []config.ProviderWindow
	GreenhouseBatchSize          int
	Interval                     time.Duration
	ScrapeTimeout                time.Duration
	SearchLocation               string
	JobTypes                     string
	TimeFilter                   string
	RemoteOnly                   bool
	MaxConcurrency               int
	ProviderMaxConcurrency       int
	ProviderConcurrencyOverrides map[ports.ProviderID]int
	ClassificationBatchSize      int
	PersistBatchSize             int
	IndexBatchSize               int
}

func DefaultConfig() Config {
	return Config{
		GreenhouseBatchSize:          1000,
		Interval:                     3 * time.Hour,
		ScrapeTimeout:                config.DefaultScrapeTimeout,
		SearchLocation:               "Brasil",
		JobTypes:                     "C,F",
		TimeFilter:                   "r604800",
		RemoteOnly:                   false,
		MaxConcurrency:               config.DefaultMaxConcurrency,
		ProviderMaxConcurrency:       config.DefaultProviderMaxConcurrency,
		ProviderConcurrencyOverrides: make(map[ports.ProviderID]int),
		ClassificationBatchSize:      config.DefaultClassificationBatchSize,
		PersistBatchSize:             config.DefaultPersistBatchSize,
		IndexBatchSize:               config.DefaultIndexBatchSize,
	}
}

type Scheduler struct {
	failedAdmissions map[string]string
	lastSummary      *RunSummary
	cfg              Config
	kwStore          *keywords.Store
	jobStore         *jobstore.Store
	adapterList      []ports.JobSource
	rdb              *redis.Client
	runLock          *runlock.Manager
	BeforeRun        func(context.Context) error
	OnComplete       func(keywords []string, scraped, saved int, duration time.Duration)
	mu               sync.Mutex
	running          bool
	stopped          bool
	lastRunAt        time.Time
	lastJobs         int
	stop             chan struct{}
	stopOnce         sync.Once
	active           sync.WaitGroup
}

func New(
	cfg Config,
	kwStore *keywords.Store,
	jobStore *jobstore.Store,
	adapterList []ports.JobSource,
	rdb *redis.Client,
	runLock *runlock.Manager,
) *Scheduler {
	return &Scheduler{
		cfg:         cfg,
		kwStore:     kwStore,
		jobStore:    jobStore,
		adapterList: adapterList,
		rdb:         rdb,
		runLock:     runLock,
		OnComplete:  nil,
		stop:        make(chan struct{}),
	}
}

func (s *Scheduler) Start(ctx context.Context) {
	if len(s.cfg.ProviderWindows) > 0 {
		metrics.CronInterval.Set((24 * time.Hour).Seconds())
		go s.startProviderWindows(ctx)
		return
	}
	metrics.CronInterval.Set(s.cfg.Interval.Seconds())
	slog.Info("cronjob: scheduler iniciado", "interval", s.cfg.Interval)

	go func() {
		s.runCron(ctx)
		metrics.SetNextRun(time.Now().Add(s.cfg.Interval))

		ticker := time.NewTicker(s.cfg.Interval)
		defer ticker.Stop()
		defer metrics.SetNextRun(time.Time{})

		for {
			select {
			case <-ticker.C:
				metrics.SetNextRun(time.Now().Add(s.cfg.Interval))
				s.runCron(ctx)
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
	s.stopOnce.Do(func() {
		s.mu.Lock()
		s.stopped = true
		s.mu.Unlock()
		close(s.stop)
	})
}

// Shutdown impede novos disparos e aguarda as execuções ativas liberarem o lock.
func (s *Scheduler) Shutdown(ctx context.Context) error {
	s.Stop()

	done := make(chan struct{})
	go func() {
		s.active.Wait()
		close(done)
	}()

	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return fmt.Errorf("cronjob: shutdown: %w", ctx.Err())
	}
}

func (s *Scheduler) RunNow(ctx context.Context) error {
	return s.RunProvidersNow(ctx, nil)
}

func (s *Scheduler) RunProvidersNow(ctx context.Context, sources []string) error {
	if _, err := pipeline.SelectProviders(s.adapterList, sources); err != nil {
		return err
	}
	sources = append([]string(nil), sources...)
	if err := s.checkProviderDelay(ctx, sources); err != nil {
		return err
	}
	lease, err := s.acquire(ctx, "admin_manual")
	if err != nil {
		return err
	}

	// Contabiliza a execução antes do yield da goroutine para o Shutdown não
	// retornar enquanto o lease ainda estiver ativo.
	go func() {
		defer s.active.Done()
		if runErr := s.runSelectedWithLease(lease, sources, s.cfg.ScrapeTimeout); runErr != nil {
			slog.Error("cronjob: execução manual falhou",
				"source", "admin_manual",
				"error", runErr,
			)
		}
	}()
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

func (s *Scheduler) runCron(ctx context.Context) {
	lease, err := s.acquire(ctx, "cron")
	if errors.Is(err, runlock.ErrAlreadyHeld) {
		slog.Info("scraper execution skipped",
			"source", "cron",
			"reason", "run_lock_already_held",
			"attempted_at", time.Now().UTC(),
		)
		return
	}
	if err != nil {
		slog.Error("cronjob: falha ao adquirir lock distribuído",
			"source", "cron",
			"attempted_at", time.Now().UTC(),
			"error", err,
		)
		return
	}

	defer s.active.Done()
	if err := s.runWithLease(lease); err != nil {
		slog.Error("cronjob: execução falhou", "source", "cron", "error", err)
	}
}

func (s *Scheduler) acquire(ctx context.Context, source string) (*runlock.Lease, error) {
	s.mu.Lock()
	stopped := s.stopped
	if !stopped {
		s.active.Add(1)
	}
	s.mu.Unlock()
	if stopped {
		return nil, fmt.Errorf("%w: scheduler is shutting down", runlock.ErrUnavailable)
	}
	if s.runLock == nil {
		s.active.Done()
		return nil, fmt.Errorf("%w: lock service is not configured", runlock.ErrUnavailable)
	}
	lease, err := s.runLock.Acquire(ctx, source)
	if err != nil {
		s.active.Done()
	}
	return lease, err
}

func (s *Scheduler) runWithLease(lease *runlock.Lease) (runErr error) {
	return s.runSelectedWithLease(lease, nil, s.cfg.ScrapeTimeout)
}

func (s *Scheduler) runSelectedWithLease(lease *runlock.Lease, sources []string, timeout time.Duration) (runErr error) {
	return s.runSelectedWindowWithLease(lease, sources, timeout, nil)
}

func (s *Scheduler) runSelectedWindowWithLease(lease *runlock.Lease, sources []string, timeout time.Duration, window *config.ProviderWindow) (runErr error) {
	var stats pipeline.ProcessStats
	defer func() {
		s.recordResult(lease.RunID(), stats, runErr, sources)
		metrics.FinishRun(runErr, lease.RunID())
	}()
	s.mu.Lock()
	s.running = true
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		s.running = false
		s.mu.Unlock()
	}()

	defer func() {
		releaseCtx, cancelRelease := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancelRelease()
		if err := lease.Release(releaseCtx); err != nil && runErr == nil {
			runErr = err
		}
	}()

	start := time.Now()
	if err := s.checkProviderDelay(lease.Context(), sources); err != nil {
		return err
	}
	collectionDeadline := lease.CollectionDeadline(timeout)
	scrapeCtx, cancel := context.WithDeadline(lease.Context(), collectionDeadline)
	defer cancel()

	if s.BeforeRun != nil {
		if err := s.BeforeRun(scrapeCtx); err != nil {
			return fmt.Errorf("cronjob: catalog maintenance: %w", err)
		}
	}

	kws, err := s.kwStore.Load(scrapeCtx)
	if err != nil {
		slog.Error("cronjob: falha ao carregar keywords", "error", err)
		return fmt.Errorf("cronjob: load keywords: %w", err)
	}
	if len(kws) == 0 {
		err = errors.New("no keywords configured")
		slog.Error("cronjob: falha ao carregar keywords", "error", err)
		return fmt.Errorf("cronjob: load keywords: %w", err)
	}

	config := s.searchConfig(kws, lease.RunID())
	config.Sources = sources
	config.CollectionTimeout = timeout
	config.CollectionDeadline = collectionDeadline
	if window != nil {
		config.FullKeywordCoverage = window.FullKeywordCoverage
		config.WindowID = window.WindowID()
	}
	var adapters []ports.JobSource
	var checkpoint func(*runlock.Lease) error
	if window != nil && window.GreenhouseFixedGroup {
		if len(sources) != 1 || sources[0] != string(ports.ProviderGreenhouse) || window.Provider != ports.ProviderGreenhouse {
			return fmt.Errorf("fixed greenhouse group requires exclusive greenhouse selection")
		}
		adapters, err = s.greenhouseFixedBatch(scrapeCtx, lease, window.WindowID())
	} else {
		adapters, checkpoint, err = s.providerBatch(scrapeCtx, sources)
	}
	if err != nil {
		slog.Error("cronjob: adapter selection failed", "run_id", lease.RunID(), "sources", sources, "error", err)
		return err
	}
	slog.Info("scraper execução iniciada",
		"source", lease.State().Source,
		"run_id", lease.RunID(),
		"max_concurrency_configured", s.cfg.MaxConcurrency,
		"max_concurrency_effective", config.MaxConcurrency,
		"provider_max_concurrency", config.ProviderMaxConcurrency,
		"keywords", len(kws),
		"adapters", len(adapters),
		"sources", sources,
	)

	jobs, stats, err := pipeline.ScrapeAllSources(lease.Context(), config, adapters, s.rdb)
	if retryErr := s.rememberRetryAfter(lease, sources, stats.CollectionError); retryErr != nil {
		err = errors.Join(err, retryErr)
	}
	if err != nil {
		slog.Error("cronjob: scrape falhou", "error", err)
		return fmt.Errorf("cronjob: scrape: %w", err)
	}
	if err := executionError(lease.Context()); err != nil {
		return err
	}
	if checkpoint != nil {
		if err := checkpoint(lease); err != nil {
			return err
		}
	}

	scraped := stats.Received
	saved := stats.Saved()
	s.mu.Lock()
	s.lastRunAt = time.Now()
	s.lastJobs = saved
	s.mu.Unlock()

	slog.Info("cronjob: execução concluída",
		"duration", time.Since(start).Round(time.Second),
		"scraped", scraped,
		"saved", saved,
		"returned", len(jobs),
		"inserted", stats.Inserted,
		"updated", stats.Updated,
		"duplicates", stats.Duplicates,
		"failed", stats.Failed,
		"run_id", lease.RunID(),
		"next_run", time.Now().Add(s.cfg.Interval).Format(time.Kitchen),
	)

	if s.OnComplete != nil {
		s.OnComplete(kws, scraped, saved, time.Since(start))
	}
	return nil
}

type RunSummary struct {
	Providers   []string  `json:"providers"`
	RunID       string    `json:"runId"`
	Status      string    `json:"status"`
	FinishedAt  time.Time `json:"finishedAt"`
	JobsSaved   int       `json:"jobsSaved"`
	JobsIndexed int       `json:"jobsIndexed"`
	ErrorType   string    `json:"errorType"`
}

func (s *Scheduler) recordResult(runID string, stats pipeline.ProcessStats, err error, sources []string) {
	status := metrics.Status(err)
	if err != nil && stats.Saved() > 0 {
		status = "partial"
	}
	now := time.Now().UTC()
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastRunAt, s.lastJobs = now, stats.Saved()
	s.lastSummary = &RunSummary{Providers: append([]string(nil), sources...), RunID: runID, Status: status, FinishedAt: now, JobsSaved: stats.Saved(), JobsIndexed: stats.Indexed, ErrorType: metrics.ErrorType(err)}
}

func (s *Scheduler) LastRun() *RunSummary {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.lastSummary == nil {
		return nil
	}
	copy := *s.lastSummary
	copy.Providers = append([]string(nil), s.lastSummary.Providers...)
	return &copy
}

func (s *Scheduler) searchConfig(kws []string, runID string) pipeline.SearchConfig {
	return pipeline.SearchConfig{
		CollectionTimeout:            s.cfg.ScrapeTimeout,
		Store:                        s.jobStore,
		Keywords:                     kws,
		SearchLocation:               s.cfg.SearchLocation,
		JobTypes:                     s.cfg.JobTypes,
		TimeFilter:                   s.cfg.TimeFilter,
		RemoteOnly:                   s.cfg.RemoteOnly,
		MaxConcurrency:               s.cfg.MaxConcurrency,
		ProviderMaxConcurrency:       s.cfg.ProviderMaxConcurrency,
		ProviderConcurrencyOverrides: s.cfg.ProviderConcurrencyOverrides,
		RunID:                        runID,
		ClassificationBatchSize:      s.cfg.ClassificationBatchSize,
		PersistBatchSize:             s.cfg.PersistBatchSize,
		IndexBatchSize:               s.cfg.IndexBatchSize,
	}
}

func executionError(ctx context.Context) error {
	if cause := context.Cause(ctx); cause != nil {
		return cause
	}
	return ctx.Err()
}

var (
	ErrAlreadyRunning  = runlock.ErrAlreadyHeld
	ErrLockUnavailable = runlock.ErrUnavailable
	ErrLockLost        = runlock.ErrLost
)
