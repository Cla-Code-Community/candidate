package metrics

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
)

func TestExecutionOutcomesAndState(t *testing.T) {
	for _, source := range []string{"cron", "admin_manual", "public_endpoint"} {
		for _, test := range []struct {
			err    error
			status string
		}{{nil, "success"}, {errors.New("failure"), "failed"}, {context.Canceled, "canceled"}, {context.DeadlineExceeded, "timeout"}} {
			before := testutil.ToFloat64(Runs.WithLabelValues(Source(source), test.status))
			StartRun(source, time.Now().Add(-time.Second))
			if Current().Execution.Status != "running" {
				t.Fatal("run not active")
			}
			FinishRun(test.err)
			s := Current()
			if s.Execution.LastStatus == nil || *s.Execution.LastStatus != test.status || s.Execution.LastDurationSeconds < 1 || s.Execution.FinishedAt == nil {
				t.Fatalf("bad last run: %+v", s.Execution)
			}
			if got := testutil.ToFloat64(Runs.WithLabelValues(Source(source), test.status)); got != before+1 {
				t.Fatal("run counted incorrectly")
			}
		}
	}
	before := testutil.ToFloat64(Runs.WithLabelValues("cron", "skipped"))
	Attempt("cron", "skipped")
	if testutil.ToFloat64(Runs.WithLabelValues("cron", "skipped")) != before+1 {
		t.Fatal("skip missing")
	}
	StartRun("cron", time.Now())
	Canceling()
	if Current().Execution.Status != "canceling" {
		t.Fatal("cancellation missing")
	}
	FinishRun(context.Canceled)
}
func TestConcurrencyQueuesAndLock(t *testing.T) {
	StartRun("manual", time.Now())
	Configure(12, 8, nil, 0, func(ports.ProviderID) int { return 2 })
	Active("linkedin", 1)
	Waiting("linkedin", 1)
	BindQueue("collection", func() Queue { return Queue{2, 4} })
	s := Current()
	if s.Concurrency.Configured != 12 || s.Concurrency.Effective != 8 || s.Concurrency.Active != 1 || s.Concurrency.Waiting != 1 || s.Queues["collection"].Depth != 2 {
		t.Fatalf("wrong concurrency %+v", s)
	}
	Active("linkedin", -1)
	Active("linkedin", -1)
	Waiting("linkedin", -1)
	Waiting("linkedin", -1)
	if Current().Concurrency.Active < 0 || Current().Concurrency.Waiting < 0 {
		t.Fatal("negative gauge")
	}
	Active("linkedin", 1)
	Waiting("linkedin", 1)
	ClearQueues()
	if Current().Concurrency.Active != 0 || Current().Concurrency.Waiting != 0 || testutil.ToFloat64(ProviderWaiting.WithLabelValues("linkedin")) != 0 {
		t.Fatal("canceled pipeline left tasks waiting")
	}
	LockAcquired(time.Second)
	if !Current().Lock.Held || Current().Lock.TTLSeconds < 0 {
		t.Fatal("lock state")
	}
	LockReleased()
	if Current().Lock.Held || Current().Lock.TTLSeconds != 0 {
		t.Fatal("lock release")
	}
	FinishRun(nil)
	if Current().Queues["collection"].Depth != 0 || Current().Concurrency.Active != 0 || Current().Concurrency.Waiting != 0 {
		t.Fatal("unfinished live state")
	}
}
func TestProviderAndErrorCategories(t *testing.T) {
	for _, tt := range []struct {
		err      error
		category string
	}{{context.Canceled, "canceled"}, {context.DeadlineExceeded, "timeout"}, {errors.New("HTTP 429 secret"), "rate_limit"}, {errors.New("HTTP 401"), "authentication"}, {errors.New("json decode private"), "parsing"}, {errors.New("invalid"), "validation"}, {errors.New("network connection"), "network"}, {errors.New("sensitive arbitrary failure"), "unknown"}} {
		if ErrorType(tt.err) != tt.category {
			t.Fatal(tt)
		}
	}
	for _, mode := range []string{"keyword", "batch", "catalog"} {
		RecordProvider("greenhouse", mode, 3, 2, time.Now(), nil)
	}
	if Provider("Green House:some private company") != "greenhouse" || Provider("arbitrary company") != "unknown" {
		t.Fatal("provider label unbounded")
	}
	before := testutil.ToFloat64(ProviderJobs.WithLabelValues("linkedin", "persisted"))
	JobResult("LinkedIn, Gupy, LinkedIn", "persisted", 1)
	if testutil.ToFloat64(ProviderJobs.WithLabelValues("linkedin", "persisted")) != before+1 {
		t.Fatal("merged providers were not deduplicated")
	}
}
func TestClassificationRejectionsAndBoundedTitles(t *testing.T) {
	StartRun("manual", time.Now())
	for _, family := range []string{"product", "product_design"} {
		Classification(domain.Job{Title: "private title", Source: "linkedin"}, domain.Classification{PrimaryFamily: family, InScope: true}, time.Now())
		if testutil.ToFloat64(ClassificationJobs.WithLabelValues("approved", family)) == 0 {
			t.Fatal("missing product")
		}
	}
	Classification(domain.Job{Title: "Production Manager"}, domain.Classification{PrimaryFamily: "other", Reasons: []string{"vaga administrativa: produto"}}, time.Now())
	Classification(domain.Job{Title: "Unrecognized"}, domain.Classification{PrimaryFamily: "other", Reasons: []string{"nenhuma familia reconhecida"}}, time.Now())
	InvalidJob("unknown")
	for i := 0; i < 1000; i++ {
		RejectTitle(fmt.Sprintf("Title %d", i), "negative_title")
	}
	s := Current()
	if len(s.RejectedTitles) > 10 || len(state.titles) > 100 {
		t.Fatal("unbounded title aggregate")
	}
	FinishRun(nil)
}
func TestMetricLabelCardinalityPolicy(t *testing.T) {
	// Exercise arbitrary IDs/text first, then inspect actual registered series.
	RecordProvider("url/user-secret", "keyword", 2, 0, time.Now(), errors.New("job-id secret error"))
	allowedNames := map[string]bool{"adapter": true, "provider": true, "source": true, "status": true, "result": true, "mode": true, "family": true, "reason_code": true, "error_type": true, "reason": true, "kind": true, "queue": true, "operation": true}
	allowedValues := map[string]bool{}
	for _, s := range strings.Fields("linkedin adzuna themuse gupy inhire jooble greenhouse lever unknown manual cron success failed canceled skipped timeout approved rejected other invalid collected valid duplicate persisted indexed keyword batch catalog backend frontend fullstack mobile data devops platform qa security product product_design software leadership no_family_recognized negative_title insufficient_title_evidence missing_required_field classification_error network rate_limit authentication parsing validation persistence indexing inserted updated no_family_recognized collection classification tasksTotal tasksCompleted tasksCanceled providersTotal providersCompleted adaptersTotal adaptersProcessed keywordsTotal keywordsProcessed batchesCompleted missing stale membership primary related any documents counts job_created job_updated job_removed job_reclassified index_rebuilt taxonomy_changed invalidate conflict permanent consistent divergent rebuild reconcile backfill reclassify expire rollback") {
		allowedValues[s] = true
	}
	all, err := prometheus.DefaultGatherer.Gather()
	if err != nil {
		t.Fatal(err)
	}
	for _, family := range all {
		if !strings.HasPrefix(family.GetName(), "candidate_") && !strings.HasPrefix(family.GetName(), "scraper_") {
			continue
		}
		for _, m := range family.Metric {
			for _, l := range m.Label {
				if !allowedNames[l.GetName()] || !allowedValues[l.GetValue()] {
					t.Fatalf("uncontrolled metric label %s %s=%q", family.GetName(), l.GetName(), l.GetValue())
				}
			}
		}
	}
}

func TestOldLeaseCannotResetCurrentState(t *testing.T) {
	StartRun("manual", time.Now(), "old")
	LockAcquired(time.Minute, "old")
	StartRun("cron", time.Now(), "new")
	LockAcquired(time.Minute, "new")
	LockReleased("old")
	FinishRun(context.Canceled, "old")
	if !Current().Lock.Held || Current().Execution.Status != "running" || *Current().Execution.Source != "cron" {
		t.Fatal("old lease changed new run")
	}
	LockReleased("new")
	FinishRun(nil, "new")
}
func TestPersistenceAndIndexOutcomes(t *testing.T) {
	for _, err := range []error{nil, errors.New("permanent failure"), context.Canceled} {
		before := testutil.ToFloat64(PersistenceBatches.WithLabelValues(BatchStatus(err)))
		ObservePersistence(time.Now(), 4, 1, 2, 1, err)
		if testutil.ToFloat64(PersistenceBatches.WithLabelValues(BatchStatus(err))) != before+1 {
			t.Fatal("persistence result missing")
		}
		before = testutil.ToFloat64(IndexBatches.WithLabelValues(BatchStatus(err)))
		ObserveIndex(time.Now(), 4, 3, err)
		if testutil.ToFloat64(IndexBatches.WithLabelValues(BatchStatus(err))) != before+1 {
			t.Fatal("index result missing")
		}
	}
}

func TestRuntimeMetricsAreReused(t *testing.T) {
	families, err := prometheus.DefaultGatherer.Gather()
	if err != nil {
		t.Fatal(err)
	}
	names := map[string]bool{}
	for _, f := range families {
		names[f.GetName()] = true
	}
	for _, name := range []string{"go_goroutines", "go_memstats_heap_alloc_bytes", "go_gc_duration_seconds", "go_sched_gomaxprocs_threads", "go_gc_gomemlimit_bytes", "process_cpu_seconds_total", "process_resident_memory_bytes"} {
		if !names[name] {
			t.Fatalf("missing reused runtime metric %s", name)
		}
	}
}
