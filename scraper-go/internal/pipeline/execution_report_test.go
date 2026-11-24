package pipeline

import (
	"context"
	"errors"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestExecutionOutcomeBoundaries(t *testing.T) {
	for _, c := range []struct {
		success, threshold int
		want               string
	}{{10, 50, "success"}, {5, 50, "partial_success"}, {4, 50, "failed"}, {7, 70, "partial_success"}, {6, 70, "failed"}, {9, 100, "failed"}} {
		stats := ProcessStats{Adapters: AdapterTotals{Selected: 10, Successes: c.success}, CollectionFailed: 10 - c.success}
		status, err := EvaluateOutcome(stats, c.threshold, nil)
		require.Equal(t, c.want, status)
		require.Equal(t, c.want == "failed", err != nil)
	}
	for _, err := range []error{context.Canceled, context.DeadlineExceeded, errors.New("persist failed"), errors.New("index unconfirmed")} {
		status, actual := EvaluateOutcome(ProcessStats{Adapters: AdapterTotals{Selected: 10, Successes: 10}}, 50, err)
		require.Equal(t, "failed", status)
		require.ErrorIs(t, actual, err)
	}
}
func TestExecutionReportFunctionalFixtures(t *testing.T) {
	for _, c := range []struct {
		name       string
		successful int
		failure    error
		want       string
	}{{"all", 5, nil, "success"}, {"partial", 3, errors.New("greenhouse: status inesperado 503"), "partial_success"}, {"minority", 2, errors.New("unknown board error"), "failed"}, {"adapter_timeout", 3, context.DeadlineExceeded, "partial_success"}, {"cancel", 3, context.Canceled, "failed"}} {
		t.Run(c.name, func(t *testing.T) {
			var sources []ports.JobSource
			for i := 0; i < 5; i++ {
				n := i
				sources = append(sources, schedulerTestAdapter{name: c.name, provider: ports.ProviderGreenhouse, mode: ports.DiscoveryKeyword, search: func(context.Context, string) ([]domain.Job, error) {
					if n < c.successful {
						return nil, nil
					}
					return nil, c.failure
				}})
			}
			// schedulerTestAdapter implements catalog discovery via SearchCatalog.
			jobs, stats, err := ScrapeAllSources(context.Background(), SearchConfig{Keywords: []string{"go"}, MaxConcurrency: 2, ProviderMaxConcurrency: 2}, sources, nil)
			require.Equal(t, c.want, stats.OperationalStatus)
			require.Equal(t, c.want == "failed", err != nil)
			require.Empty(t, jobs)
			require.Equal(t, 5, stats.Adapters.Selected)
			require.Equal(t, 5, stats.Adapters.Completed)
			require.Equal(t, c.successful, stats.Adapters.Successes)
			report := EmitReport("fixture-"+c.name, []string{"greenhouse"}, "fixture", time.Now().Add(-time.Millisecond), time.Second, 2, stats, err)
			require.Equal(t, c.want, report.Status)
			if c.name == "adapter_timeout" {
				require.False(t, report.DeadlineReached)
				require.Equal(t, 2, stats.TaskTimeouts)
				require.Zero(t, stats.TaskCancellations)
			}
		})
	}
}
func TestExecutionDiagnosticEvidence(t *testing.T) {
	task := adapterTask{provider: ports.ProviderGreenhouse}
	require.Equal(t, "unknown", diagnoseAdapter(task, errors.New("unknown board error")).Category)
	d := diagnoseAdapter(task, errors.New("greenhouse: status inesperado 429 para board"))
	require.Equal(t, "rate_limit", d.Category)
	require.Equal(t, 429, d.HTTPStatus)
}
