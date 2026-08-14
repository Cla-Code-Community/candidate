package ports

import (
	"context"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
)

type JobSource interface {
	SourceName() string
	Search(ctx context.Context, keyword string, req domain.ScrapeRequest) ([]domain.Job, error)
}

type BatchJobSource interface {
	JobSource
	SearchBatch(ctx context.Context, keywords []string, req domain.ScrapeRequest) ([]domain.Job, error)
}

type JobRepository interface {
	SaveBatch(ctx context.Context, jobs []domain.Job) (int, error)
	GetAll(ctx context.Context) ([]domain.Job, error)
	GetSample(ctx context.Context, limit int) ([]domain.Job, error)
	Count(ctx context.Context) (int64, error)
}

type KeywordRepository interface {
	Load(ctx context.Context) ([]string, error)
	Save(ctx context.Context, keywords []string) error
}

type CacheRepository interface {
	Get(ctx context.Context, key string, target any) (bool, error)
	Set(ctx context.Context, key string, value any, ttl time.Duration) error
	Delete(ctx context.Context, key string) error
	SetNX(ctx context.Context, key string, value any, ttl time.Duration) (bool, error)
}

type MetricsRecorder interface {
	RecordSourceRun(source string, duration time.Duration, jobs int, err error)
	RecordPipelineRun(duration time.Duration, jobs int)
}
