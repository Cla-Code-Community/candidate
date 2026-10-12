package pipeline

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobindex"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func benchJobs(n int) []domain.Job {
	jobs := make([]domain.Job, n)
	for i := 0; i < n; i++ {
		jobs[i] = domain.Job{
			Title:       "Backend Engineer",
			Company:     fmt.Sprintf("Acme-%d", i),
			Location:    "Brasil",
			Description: "Golang go APIs microservices postgresql redis kafka",
			Source:      "gupy",
			Keyword:     "go",
		}
	}
	return jobs
}

func newBenchRedis(b *testing.B) (*redis.Client, *jobstore.Store) {
	b.Helper()
	mr, err := miniredis.Run()
	if err != nil {
		b.Fatal(err)
	}
	b.Cleanup(mr.Close)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	b.Cleanup(func() { _ = rdb.Close() })
	return rdb, jobstore.New(rdb)
}

func BenchmarkPersistIndividual(b *testing.B) {
	_, store := newBenchRedis(b)
	jobs := benchJobs(200)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		b.StopTimer()
		ctx := context.Background()
		b.StartTimer()
		for _, job := range jobs {
			if _, err := store.SaveBatch(ctx, []domain.Job{job}); err != nil {
				b.Fatal(err)
			}
		}
	}
}

func BenchmarkPersistBatched(b *testing.B) {
	_, store := newBenchRedis(b)
	jobs := benchJobs(200)
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := store.SaveBatch(context.Background(), jobs); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkIndexIndividual(b *testing.B) {
	rdb, _ := newBenchRedis(b)
	jobs := benchJobs(200)
	for i := range jobs {
		jobs[i].ID = jobstore.StableID(&jobs[i])
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, job := range jobs {
			if _, err := IndexJobsInValkeyBatched(context.Background(), rdb, []domain.Job{job}, []string{"go"}, 1); err != nil {
				b.Fatal(err)
			}
		}
	}
}

func BenchmarkIndexBatched(b *testing.B) {
	rdb, _ := newBenchRedis(b)
	jobs := benchJobs(200)
	for i := range jobs {
		jobs[i].ID = jobstore.StableID(&jobs[i])
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := IndexJobsInValkeyBatched(context.Background(), rdb, jobs, []string{"go"}, 250); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkProcessIncomingIndividual(b *testing.B) {
	jobs := benchJobs(200)
	cfg := processConfig{ClassificationBatchSize: 1, PersistBatchSize: 1, IndexBatchSize: 1}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, _, err := processIncomingJobs(context.Background(), feedJobs(jobs...), cfg); err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkProcessIncomingBatched(b *testing.B) {
	jobs := benchJobs(200)
	cfg := processConfig{ClassificationBatchSize: 100, PersistBatchSize: 100, IndexBatchSize: 250}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, _, err := processIncomingJobs(context.Background(), feedJobs(jobs...), cfg); err != nil {
			b.Fatal(err)
		}
	}
}

// Requires an explicitly supplied disposable server: this benchmark writes index
// data. It never reads the application Redis URL or starts external processes.
func BenchmarkDurableIndexApply(b *testing.B) {
	socket := os.Getenv("PAV178_BENCH_REDIS_SOCKET")
	if socket == "" {
		b.Skip("PAV178_BENCH_REDIS_SOCKET must identify an isolated disposable server")
	}
	rdb := redis.NewClient(&redis.Options{Network: "unix", Addr: socket, MaxRetries: -1})
	b.Cleanup(func() { rdb.Close() })
	manager := jobindex.New(rdb)
	jobs := benchJobs(250)
	description := strings.Repeat("Golang go APIs microservices postgresql redis kafka backend engineer remote Brasil. ", 52)[:4096]
	expires := time.Now().Add(time.Hour)
	for i := range jobs {
		jobs[i].ID = fmt.Sprintf("bench-%d-%d-%d", os.Getpid(), expires.UnixNano(), i)
		jobs[i].Description = description
		jobs[i].CatalogRevision = 1
		jobs[i].CatalogExpiresAt = expires
		jobs[i].Classification = &domain.Classification{PrimaryFamily: "backend", InScope: true}
	}
	keywords := make([]string, 445)
	for i := range keywords {
		keywords[i] = fmt.Sprintf("backend engineer technology%d", i)
	}
	keywords[0] = "go"
	keys := func(j domain.Job) []string { return IndexKeys(j, keywords) }
	if _, err := manager.Apply(context.Background(), jobs, keys); err != nil {
		b.Fatal(err)
	}
	b.ReportAllocs()
	b.ResetTimer()
	for n := 0; n < b.N; n++ {
		for i := range jobs {
			jobs[i].CatalogRevision++
		}
		if _, err := manager.Apply(context.Background(), jobs, keys); err != nil {
			b.Fatal(err)
		}
	}
}
