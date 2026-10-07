package catalogops

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobindex"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/metrics"
	"github.com/alicebob/miniredis/v2"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/redis/go-redis/v9"
)

func TestMaintenanceTelemetrySurvivesCLIAndKeepsCatalogReadOnly(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()
	ctx := context.Background()
	m := Maintenance{Index: jobindex.New(rdb)}
	rdb.Set(ctx, "scraper:jobs:index-version", "existing", 0)
	m.record(ctx, "reconcile", time.Now().Add(-time.Second), 3, Report{Missing: 2, Related: 1}, nil)
	if got := rdb.HGet(ctx, metrics.MaintenanceMetricsKey, "reconcile:divergent").Val(); got != "1" {
		t.Fatal(got)
	}
	if rdb.Get(ctx, "scraper:jobs:index-version").Val() != "existing" || rdb.Exists(ctx, jobindex.GenerationKey).Val() != 0 {
		t.Fatal("telemetry changed catalog")
	}
	var summary maintenanceSummary
	if e := json.Unmarshal([]byte(rdb.Get(ctx, "scraper:observability:maintenance").Val()), &summary); e != nil {
		t.Fatal(e)
	}
	if summary.Divergences != 3 || summary.DurationSeconds < 1 || summary.Status != "success" {
		t.Fatal(summary)
	}
	stopped := metrics.StartMaintenanceSampler(ctx, rdb)
	defer stopped()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		families, err := prometheus.DefaultGatherer.Gather()
		if err != nil {
			t.Fatal(err)
		}
		for _, f := range families {
			if f.GetName() == "candidate_scraper_index_reconciliation_total" {
				for _, item := range f.Metric {
					for _, label := range item.Label {
						if label.GetName() == "result" && label.GetValue() == "divergent" && item.GetCounter().GetValue() == 1 {
							return
						}
					}
				}
			}
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatal("durable observation missing")
}
