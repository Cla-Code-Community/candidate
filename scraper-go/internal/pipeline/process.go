package pipeline

import (
	"context"
	"log/slog"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/classifier"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/config"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/dedup"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/redis/go-redis/v9"
)

type persistBatchFn func(ctx context.Context, jobs []domain.Job) (jobstore.SaveResult, error)
type indexBatchFn func(ctx context.Context, jobs []domain.Job) error

type processConfig struct {
	RunID                   string
	Keywords                []string
	ClassificationBatchSize int
	PersistBatchSize        int
	IndexBatchSize          int
	Store                   *jobstore.Store
	RDB                     *redis.Client
	Persist                 persistBatchFn
	Index                   indexBatchFn
	IndexSession            *indexSession
}

type ProcessStats struct {
	Received   int
	Valid      int
	Invalid    int
	Duplicates int
	Classified int
	Approved   int
	Rejected   int
	Inserted   int
	Updated    int
	Indexed    int
	Failed     int
}

func (s ProcessStats) Saved() int {
	return s.Inserted + s.Updated
}

func defaultProcessConfig() processConfig {
	return processConfig{
		ClassificationBatchSize: config.DefaultClassificationBatchSize,
		PersistBatchSize:        config.DefaultPersistBatchSize,
		IndexBatchSize:          config.DefaultIndexBatchSize,
	}
}

func processIncomingJobs(
	ctx context.Context,
	incoming <-chan domain.Job,
	cfg processConfig,
) ([]domain.Job, ProcessStats, error) {
	if cfg.ClassificationBatchSize <= 0 {
		cfg.ClassificationBatchSize = config.DefaultClassificationBatchSize
	}
	if cfg.PersistBatchSize <= 0 {
		cfg.PersistBatchSize = config.DefaultPersistBatchSize
	}
	if cfg.IndexBatchSize <= 0 {
		cfg.IndexBatchSize = config.DefaultIndexBatchSize
	}
	if cfg.Index == nil && cfg.RDB != nil && cfg.IndexSession == nil {
		cfg.IndexSession = newIndexSession(cfg.RunID)
	}

	// seen holds only the current classification window. flushed maps identity
	// keys to persisted IDs so cross-batch duplicates can merge with the
	// document already written in this run.
	seen := make(map[string]*domain.Job)
	flushed := make(map[string]string)
	persistedByID := make(map[string]domain.Job)
	pending := make([]*domain.Job, 0, cfg.ClassificationBatchSize)
	indexBuf := make([]domain.Job, 0, cfg.IndexBatchSize)
	approved := make([]domain.Job, 0)
	stats := ProcessStats{}
	batchNo := 0
	windowDuplicates := 0
	var terminalErr error

	discardIndexes := func() {
		if cfg.IndexSession == nil || cfg.RDB == nil {
			return
		}
		_ = cfg.IndexSession.Discard(context.WithoutCancel(ctx), cfg.RDB)
	}

	flushIndexBuffer := func(force bool) error {
		if !canIndex(cfg) {
			return nil
		}
		for len(indexBuf) > 0 {
			if !force && len(indexBuf) < cfg.IndexBatchSize {
				return nil
			}
			if cause := context.Cause(ctx); cause != nil {
				return cause
			}
			n := min(cfg.IndexBatchSize, len(indexBuf))
			chunk := append([]domain.Job(nil), indexBuf[:n]...)
			indexBuf = append([]domain.Job(nil), indexBuf[n:]...)
			if err := indexPersistedChunk(ctx, cfg, batchNo, chunk, &stats); err != nil {
				return err
			}
		}
		return nil
	}

	enqueuePersisted := func(persisted []domain.Job) error {
		if len(persisted) == 0 || !canIndex(cfg) {
			return nil
		}
		for _, job := range persisted {
			if job.ID == "" {
				if cfg.Index == nil {
					continue
				}
				indexBuf = append(indexBuf, job)
				continue
			}
			replaced := false
			for i := range indexBuf {
				if indexBuf[i].ID == job.ID {
					indexBuf[i] = job
					replaced = true
					break
				}
			}
			if !replaced {
				indexBuf = append(indexBuf, job)
			}
		}
		return flushIndexBuffer(false)
	}

	rememberPersisted := func(jobs []domain.Job) {
		for _, job := range jobs {
			if job.ID == "" {
				job.ID = jobstore.StableID(&job)
			}
			if job.ID == "" {
				continue
			}
			if _, exists := persistedByID[job.ID]; !exists {
				approved = append(approved, job)
			} else {
				for i := range approved {
					if approved[i].ID == job.ID {
						approved[i] = job
						break
					}
				}
			}
			persistedByID[job.ID] = job
			for _, key := range dedup.Keys(&job) {
				flushed[key] = job.ID
			}
		}
	}

	flushPending := func(force bool) error {
		if len(pending) == 0 {
			return nil
		}
		if !force && len(pending) < cfg.ClassificationBatchSize {
			return nil
		}
		if cause := context.Cause(ctx); cause != nil {
			return cause
		}
		batchNo++
		jobs := make([]domain.Job, 0, len(pending))
		for _, job := range pending {
			if job == nil {
				continue
			}
			jobs = append(jobs, *job)
		}
		pending = pending[:0]
		batchDuplicates := windowDuplicates
		windowDuplicates = 0
		persisted, err := processStageBatch(ctx, cfg, batchNo, jobs, &stats, batchDuplicates)
		if len(persisted) > 0 {
			rememberPersisted(persisted)
			if indexErr := enqueuePersisted(persisted); indexErr != nil {
				if err == nil {
					err = indexErr
				} else {
					slog.Error("scraper index leftover after persist failure",
						"run_id", cfg.RunID,
						"stage", "index",
						"batch", batchNo,
						"error", indexErr,
					)
				}
			}
		}
		return err
	}

	mergeFlushed := func(incoming domain.Job, id string) error {
		existing, ok := persistedByID[id]
		if !ok && cfg.Store != nil {
			found, err := cfg.Store.GetByIDs(ctx, []string{id})
			if err != nil {
				return err
			}
			if len(found) > 0 {
				existing = found[0]
				ok = true
			}
		}
		if !ok {
			slog.Warn("scraper late duplicate has no persisted document",
				"run_id", cfg.RunID,
				"id", id,
			)
			return nil
		}

		merged := dedup.Merge(&existing, &incoming)
		classification := classifier.Classify(*merged)
		merged.Classification = &classification
		if !classification.InScope && existing.Classification != nil {
			merged.Classification = existing.Classification
		}

		persisted := []domain.Job{*merged}
		if cfg.Persist != nil || cfg.Store != nil {
			result, inserted, updated, err := persistJobs(ctx, cfg, batchNo, []domain.Job{*merged}, &stats)
			if err != nil {
				return err
			}
			stats.Inserted += inserted
			stats.Updated += updated
			if len(result) > 0 {
				persisted = result
			}
		}
		rememberPersisted(persisted)
		return enqueuePersisted(persisted)
	}

	for {
		job, ok := <-incoming
		if !ok {
			if terminalErr == nil {
				if err := flushPending(true); err != nil {
					terminalErr = err
				}
			}
			if len(indexBuf) > 0 && canIndex(cfg) && context.Cause(ctx) == nil {
				if err := flushIndexBuffer(true); err != nil {
					if terminalErr == nil {
						terminalErr = err
					} else {
						slog.Error("scraper leftover index failed",
							"run_id", cfg.RunID,
							"stage", "index",
							"error", err,
						)
					}
				}
			}
			if terminalErr != nil {
				discardIndexes()
				return approved, stats, terminalErr
			}
			if cfg.IndexSession != nil && cfg.RDB != nil {
				if err := cfg.IndexSession.Publish(ctx, cfg.RDB); err != nil {
					discardIndexes()
					return approved, stats, err
				}
			}
			slog.Info("scraper process complete",
				"run_id", cfg.RunID,
				"received", stats.Received,
				"valid", stats.Valid,
				"invalid", stats.Invalid,
				"duplicates", stats.Duplicates,
				"classified", stats.Classified,
				"approved", stats.Approved,
				"rejected", stats.Rejected,
				"inserted", stats.Inserted,
				"updated", stats.Updated,
				"saved", stats.Saved(),
				"indexed", stats.Indexed,
				"failed", stats.Failed,
			)
			return approved, stats, nil
		}

		if terminalErr != nil {
			continue
		}
		if cause := context.Cause(ctx); cause != nil {
			terminalErr = cause
			continue
		}

		stats.Received++
		job = normalizeCollectedJob(job)
		keys := dedup.Keys(&job)
		if id, found := flushedID(flushed, keys); found {
			stats.Duplicates++
			if err := mergeFlushed(job, id); err != nil {
				terminalErr = err
			}
			continue
		}
		if existing := findSeen(seen, keys); existing != nil {
			stats.Duplicates++
			windowDuplicates++
			merged := dedup.Merge(existing, &job)
			*existing = *merged
			indexSeen(seen, existing)
			continue
		}

		jobCopy := job
		ptr := &jobCopy
		indexSeen(seen, ptr)
		pending = append(pending, ptr)
		if err := flushPending(false); err != nil {
			terminalErr = err
		}
	}
}

func canIndex(cfg processConfig) bool {
	if cfg.Index != nil {
		return true
	}
	return cfg.RDB != nil && (cfg.Store != nil || cfg.Persist != nil)
}

func flushedID(index map[string]string, keys []string) (string, bool) {
	for _, key := range keys {
		if id, ok := index[key]; ok && id != "" {
			return id, true
		}
	}
	return "", false
}

func findSeen(seen map[string]*domain.Job, keys []string) *domain.Job {
	for _, key := range keys {
		if job, ok := seen[key]; ok {
			return job
		}
	}
	return nil
}

func indexSeen(seen map[string]*domain.Job, job *domain.Job) {
	for key, existing := range seen {
		if existing == job {
			delete(seen, key)
		}
	}
	for _, key := range dedup.Keys(job) {
		seen[key] = job
	}
}

func processStageBatch(
	ctx context.Context,
	cfg processConfig,
	batchNo int,
	jobs []domain.Job,
	stats *ProcessStats,
	duplicates int,
) ([]domain.Job, error) {
	started := time.Now()
	valid := make([]domain.Job, 0, len(jobs))
	invalid := 0
	for _, job := range jobs {
		if jobIsInvalid(job) {
			invalid++
			stats.Invalid++
			continue
		}
		stats.Valid++
		valid = append(valid, job)
	}

	approved := make([]domain.Job, 0, len(valid))
	rejected := 0
	for _, job := range valid {
		classification := classifier.Classify(job)
		stats.Classified++
		if !classification.InScope {
			rejected++
			stats.Rejected++
			continue
		}
		job.Classification = &classification
		approved = append(approved, job)
		stats.Approved++
	}

	persisted := approved
	batchInserted := 0
	batchUpdated := 0
	var persistErr error
	if cfg.Persist != nil || cfg.Store != nil {
		var written []domain.Job
		written, batchInserted, batchUpdated, persistErr = persistJobs(ctx, cfg, batchNo, approved, stats)
		stats.Inserted += batchInserted
		stats.Updated += batchUpdated
		persisted = written
	} else {
		for i := range persisted {
			if persisted[i].ID == "" {
				persisted[i].ID = jobstore.StableID(&persisted[i])
			}
		}
	}

	slog.Info("scraper stage batch",
		"run_id", cfg.RunID,
		"stage", "classify_persist",
		"batch", batchNo,
		"received", len(jobs),
		"valid", len(valid),
		"invalid", invalid,
		"duplicates", duplicates,
		"classified", len(valid),
		"approved", len(approved),
		"rejected", rejected,
		"inserted", batchInserted,
		"updated", batchUpdated,
		"duration", time.Since(started).Round(time.Millisecond),
	)
	return persisted, persistErr
}

func persistJobs(
	ctx context.Context,
	cfg processConfig,
	batchNo int,
	jobs []domain.Job,
	stats *ProcessStats,
) ([]domain.Job, int, int, error) {
	written := make([]domain.Job, 0, len(jobs))
	inserted := 0
	updated := 0
	for start := 0; start < len(jobs); start += cfg.PersistBatchSize {
		if cause := context.Cause(ctx); cause != nil {
			return written, inserted, updated, cause
		}
		end := min(start+cfg.PersistBatchSize, len(jobs))
		chunk := jobs[start:end]
		var result jobstore.SaveResult
		var err error
		if cfg.Persist != nil {
			result, err = cfg.Persist(ctx, chunk)
		} else {
			result, err = cfg.Store.SaveBatch(ctx, chunk)
		}
		if err != nil {
			stats.Failed++
			slog.Error("scraper persist batch failed",
				"run_id", cfg.RunID,
				"stage", "persist",
				"batch", batchNo,
				"size", len(chunk),
				"error", err,
			)
			return written, inserted, updated, err
		}
		inserted += result.Inserted
		updated += result.Updated
		written = append(written, result.Persisted...)
	}
	return written, inserted, updated, nil
}

func indexPersistedChunk(
	ctx context.Context,
	cfg processConfig,
	batchNo int,
	jobs []domain.Job,
	stats *ProcessStats,
) error {
	if len(jobs) == 0 {
		return nil
	}
	started := time.Now()
	ids := make([]string, 0, len(jobs))
	for _, job := range jobs {
		if job.ID != "" {
			ids = append(ids, job.ID)
		}
	}

	var err error
	commands := 0
	if cfg.Index != nil {
		err = cfg.Index(ctx, jobs)
	} else {
		commands, err = indexJobsInValkeyBatched(ctx, cfg.RDB, jobs, cfg.Keywords, cfg.IndexBatchSize, cfg.IndexSession)
	}
	if err != nil {
		stats.Failed++
		slog.Error("scraper index batch failed",
			"run_id", cfg.RunID,
			"stage", "index",
			"batch", batchNo,
			"size", len(jobs),
			"error", err,
		)
		if cfg.Store == nil || cfg.RDB == nil || len(ids) == 0 {
			return err
		}
		if reconErr := reindexPersistedJobs(ctx, cfg.Store, cfg.RDB, ids, cfg.Keywords, cfg.IndexBatchSize, cfg.IndexSession); reconErr != nil {
			slog.Error("scraper index reconcile failed",
				"run_id", cfg.RunID,
				"stage", "index_reconcile",
				"batch", batchNo,
				"error", reconErr,
			)
			return err
		}
		slog.Warn("scraper index reconciled after failure",
			"run_id", cfg.RunID,
			"stage", "index_reconcile",
			"batch", batchNo,
			"ids", len(ids),
		)
	}
	stats.Indexed += len(jobs)
	slog.Info("scraper stage batch",
		"run_id", cfg.RunID,
		"stage", "index",
		"batch", batchNo,
		"indexed", len(jobs),
		"commands", commands,
		"duration", time.Since(started).Round(time.Millisecond),
	)
	return nil
}

func stageQueueCapacity(cfg processConfig) int {
	size := max(cfg.ClassificationBatchSize, cfg.PersistBatchSize, cfg.IndexBatchSize)
	return max(2, size*2)
}
