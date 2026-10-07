package metrics

import (
	"context"
	"math"
	"strconv"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"github.com/redis/go-redis/v9"
)

var MaintenanceTelemetryAvailable = promauto.NewGauge(prometheus.GaugeOpts{Name: "candidate_scraper_maintenance_telemetry_available", Help: "Last bounded telemetry hash read succeeded"})
var MaintenanceSampleTimestamp = promauto.NewGauge(prometheus.GaugeOpts{Name: "candidate_scraper_maintenance_sample_timestamp_seconds", Help: "Last successful maintenance telemetry sample"})

const MaintenanceMetricsKey = "scraper:observability:maintenance-metrics"

var MaintenanceBuckets = []float64{.001, .01, .05, .1, .5, 1, 5, 30, 120, 600, 1800, 3600}
var maintenanceOperations = []string{"rebuild", "reconcile", "backfill", "reclassify", "expire", "rollback"}
var maintenanceStatuses = []string{"success", "failed", "canceled"}
var maintenanceData = struct {
	sync.RWMutex
	values map[string]string
}{values: map[string]string{}}

type maintenanceCollector struct{}

var maintenanceDurationDesc = prometheus.NewDesc("candidate_scraper_index_maintenance_duration_seconds", "Durable maintenance durations across CLI invocations", []string{"operation", "status"}, nil)
var maintenanceRunsDesc = prometheus.NewDesc("candidate_scraper_index_maintenance_runs_total", "Durable maintenance outcomes across CLI invocations", []string{"operation", "status"}, nil)
var cacheInvalidationDesc = prometheus.NewDesc("candidate_jobs_search_cache_invalidations_total", "Successful committed generation changes", []string{"reason"}, nil)
var reconciliationDesc = prometheus.NewDesc("candidate_scraper_index_reconciliation_total", "Durable explicit reconciliation outcomes", []string{"result"}, nil)

func init() { prometheus.MustRegister(maintenanceCollector{}) }
func (maintenanceCollector) Describe(ch chan<- *prometheus.Desc) {
	ch <- maintenanceDurationDesc
	ch <- maintenanceRunsDesc
	ch <- reconciliationDesc
	ch <- cacheInvalidationDesc
}
func (maintenanceCollector) Collect(ch chan<- prometheus.Metric) {
	maintenanceData.RLock()
	defer maintenanceData.RUnlock()
	v := maintenanceData.values
	number := func(k string) float64 {
		n, e := strconv.ParseFloat(v[k], 64)
		if e != nil || n < 0 || math.IsNaN(n) || math.IsInf(n, 0) {
			return 0
		}
		return n
	}
	for _, op := range maintenanceOperations {
		for _, status := range maintenanceStatuses {
			p := op + ":" + status + ":"
			count := uint64(number(p + "count"))
			if count == 0 {
				continue
			}
			buckets := map[float64]uint64{}
			for _, b := range MaintenanceBuckets {
				buckets[b] = uint64(number(p + strconv.FormatFloat(b, 'g', -1, 64)))
			}
			ch <- prometheus.MustNewConstHistogram(maintenanceDurationDesc, count, number(p+"sum"), buckets, op, status)
			ch <- prometheus.MustNewConstMetric(maintenanceRunsDesc, prometheus.CounterValue, float64(count), op, status)
		}
	}
	for _, reason := range []string{"job_created", "job_updated", "job_removed", "job_reclassified", "index_rebuilt", "taxonomy_changed"} {
		ch <- prometheus.MustNewConstMetric(cacheInvalidationDesc, prometheus.CounterValue, number("cache:"+reason), reason)
	}
	for _, result := range []string{"consistent", "divergent", "failed", "canceled"} {
		ch <- prometheus.MustNewConstMetric(reconciliationDesc, prometheus.CounterValue, number("reconcile:"+result), result)
	}
}

// No I/O in Collect. The bounded hash contains only fixed operations/statuses.
// A failed poll retains known cumulative values rather than resetting counters.
func StartMaintenanceSampler(parent context.Context, rdb *redis.Client) func() {
	ctx, cancel := context.WithCancel(parent)
	done := make(chan struct{})
	go func() {
		defer close(done)
		timer := time.NewTicker(15 * time.Second)
		defer timer.Stop()
		for {
			pollCtx, stop := context.WithTimeout(ctx, 2*time.Second)
			v, err := rdb.HGetAll(pollCtx, MaintenanceMetricsKey).Result()
			stop()
			if err == nil {
				MaintenanceTelemetryAvailable.Set(1)
				MaintenanceSampleTimestamp.Set(float64(time.Now().Unix()))
				maintenanceData.Lock()
				maintenanceData.values = v
				maintenanceData.Unlock()
				if n, e := strconv.ParseFloat(v["rebuildProgress"], 64); e == nil {
					RebuildProgress.Set(n)
				}
				for _, k := range []string{"missing", "stale", "membership", "primary", "related", "any", "invalid", "documents", "counts"} {
					if n, e := strconv.ParseFloat(v["divergence:"+k], 64); e == nil {
						Divergences.WithLabelValues(k).Set(n)
					}
				}
			}
			if err != nil {
				MaintenanceTelemetryAvailable.Set(0)
			}
			select {
			case <-ctx.Done():
				return
			case <-timer.C:
			}
		}
	}()
	return func() { cancel(); <-done }
}
