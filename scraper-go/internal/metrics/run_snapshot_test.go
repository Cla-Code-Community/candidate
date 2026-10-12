package metrics

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
)

func TestRunSnapshotLifecycleAndIsolation(t *testing.T) {
	StartRun("manual", time.Now(), "run-one")
	s := Current()
	if s.Execution.RunID == nil || *s.Execution.RunID != "run-one" || s.Classification != nil || s.Persistence != nil || s.Providers != nil {
		t.Fatalf("new run: %+v", s)
	}
	BeginRunProcessing("run-one", true)
	RunClassificationReceived("run-one", 3)
	RecordRunClassification("run-one", true)
	RecordRunClassification("run-one", false)
	RecordRunInvalid("run-one")
	RunPersistenceReceived("run-one", 2)
	RecordRunPersistence("run-one", 2, 1, 0, 1, nil)
	FinishRun(nil, "run-one")
	RecordRunClassification("run-one", true)
	s = Current()
	if s.Execution.FinishedAt == nil || s.Classification.Classified != 2 || s.Classification.Received != 3 || s.Classification.Invalid != 1 || s.Persistence.Inserted != 1 || s.Persistence.Skipped != 1 {
		t.Fatalf("finished: %+v", s)
	}
	s.Classification.Approved = 999
	if Current().Classification.Approved != 1 {
		t.Fatal("snapshot aliases live state")
	}
	StartRun("cron", time.Now(), "run-two")
	RecordRunClassification("run-one", true)
	RunPersistenceReceived("run-one", 100)
	FinishRun(context.Canceled, "run-one")
	s = Current()
	if *s.Execution.RunID != "run-two" || s.Execution.FinishedAt != nil || s.Classification != nil || s.Persistence != nil || s.Execution.Status != "running" {
		t.Fatalf("reset/old run: %+v", s)
	}
	BeginRunProcessing("run-two", false)
	if Current().Classification.Classified != 0 || Current().Persistence != nil {
		t.Fatal("zero versus unavailable")
	}
	StartRun("manual", time.Now())
	if Current().Execution.RunID != nil || Current().Classification != nil {
		t.Fatal("missing identity")
	}
}
func TestRunPersistenceCountsFinalCalls(t *testing.T) {
	StartRun("manual", time.Now(), "persist-run")
	BeginRunProcessing("persist-run", true)
	RunPersistenceReceived("persist-run", 4)
	if Current().Persistence.Received != 4 || Current().Persistence.Inserted != 0 {
		t.Fatal("pending")
	}
	RecordRunPersistence("persist-run", 4, 1, 2, 3, nil)
	RunPersistenceReceived("persist-run", 2)
	RecordRunPersistence("persist-run", 2, 100, 100, 0, errors.New("private message"))
	p := Current().Persistence
	if p.Received != 6 || p.Inserted != 1 || p.Updated != 2 || p.Skipped != 1 || p.Failed != 2 || p.FailedBatches != 1 {
		t.Fatalf("outcomes %+v", p)
	}
}
func TestRunProvidersUseBoundedPlanAndRealTasks(t *testing.T) {
	StartRun("manual", time.Now(), "providers-run")
	Configure(4, 4, nil, 0, func(ports.ProviderID) int { return 2 }, "providers-run")
	if Current().Providers == nil || len(Current().Providers) != 0 {
		t.Fatal("known empty plan")
	}
	sources := []ports.JobSource{runSource("Green House:company secret"), runSource("arbitrary secret")}
	Configure(4, 4, sources, 2, func(ports.ProviderID) int { return 2 }, "providers-run")
	Active("greenhouse", 1)
	Waiting("greenhouse", 1)
	RecordRunProvider("providers-run", "greenhouse", 3, time.Now().Add(-time.Second), nil)
	RecordRunProvider("providers-run", "greenhouse", 0, time.Now(), errors.New("HTTP 429 secret"))
	providers := Current().Providers
	if len(providers) != 2 || providers[0].ID != "greenhouse" || providers[0].TasksTotal != 2 || providers[0].TasksCompleted != 2 || providers[0].JobsCollected != 3 || providers[0].TasksFailed != 1 || *providers[0].LastErrorType != "rate_limit" || providers[0].Active != 1 || providers[0].Waiting != 1 {
		t.Fatalf("providers %+v", providers)
	}
	RecordRunProvider("old", "greenhouse", 100, time.Now(), nil)
	if Current().Providers[0].JobsCollected != 3 {
		t.Fatal("old run")
	}
	providers[0].JobsCollected = 999
	if Current().Providers[0].JobsCollected != 3 {
		t.Fatal("aliased provider")
	}
	FinishRun(nil, "providers-run")
	if Current().Providers[0].Active != 0 || Current().Providers[0].Waiting != 0 {
		t.Fatal("finished live counts")
	}
}

type runSource string

func (s runSource) SourceName() string { return string(s) }
func (s runSource) Search(context.Context, string, domain.ScrapeRequest) ([]domain.Job, error) {
	return nil, nil
}
