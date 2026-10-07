package catalogops

import (
	"context"
	"encoding/json"
	"log/slog"
	"strconv"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/metrics"
)

type maintenanceSummary = metrics.MaintenanceSummary

func (m *Maintenance) record(ctx context.Context, operation string, started time.Time, processed int, report Report, err error, remaining ...Report) {
	duration := time.Since(started).Seconds()
	status := metrics.BatchStatus(err)
	fields := map[string]int{"missing": report.Missing, "stale": report.Stale, "membership": report.Membership, "primary": report.Primary, "related": report.Related, "any": report.Any, "invalid": report.Invalid, "documents": report.Documents, "counts": report.Counts}
	divergent := 0
	for _, v := range fields {
		divergent += v
	}
	raw, _ := json.Marshal(maintenanceSummary{
		Operation: operation, Status: status, DurationSeconds: duration,
		FinishedAt: time.Now().UTC(), Processed: max(0, processed), Divergences: divergent,
	})
	// Telemetry cleanup has a bounded independent deadline after cancellation;
	// it cannot change commit/publication success or trigger a catalog retry.
	recordCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 2*time.Second)
	defer cancel()
	pipe := m.Index.RDB.TxPipeline()
	prefix := operation + ":" + status + ":"
	key := metrics.MaintenanceMetricsKey
	pipe.HIncrBy(recordCtx, key, prefix+"count", 1)
	pipe.HIncrByFloat(recordCtx, key, prefix+"sum", duration)
	for _, b := range metrics.MaintenanceBuckets {
		if duration <= b {
			pipe.HIncrBy(recordCtx, key, prefix+strconv.FormatFloat(b, 'g', -1, 64), 1)
		}
	}
	if operation == "reconcile" {
		result := "consistent"
		if divergent > 0 {
			result = "divergent"
		}
		if err != nil {
			result = status
		}
		pipe.HIncrBy(recordCtx, key, "reconcile:"+result, 1)
		if len(remaining) > 0 {
			r := remaining[0]
			fields = map[string]int{"missing": r.Missing, "stale": r.Stale, "membership": r.Membership, "primary": r.Primary, "related": r.Related, "any": r.Any, "invalid": r.Invalid, "documents": r.Documents, "counts": r.Counts}
		}
		for k, v := range fields {
			pipe.HSet(recordCtx, key, "divergence:"+k, v)
		}
	}
	pipe.Set(recordCtx, "scraper:observability:maintenance", raw, 24*time.Hour)
	if _, e := pipe.Exec(recordCtx); e != nil {
		slog.Warn("maintenance telemetry unavailable", "operation", operation, "errorType", metrics.ErrorType(e))
	}
	slog.Info("catalog maintenance completed", "operation", operation, "status", status, "duration", duration, "processed", processed, "divergences", divergent)
}
func (m *Maintenance) progress(ctx context.Context, n int) {
	metrics.RebuildProgress.Set(float64(n))
	if e := m.Index.RDB.HSet(ctx, metrics.MaintenanceMetricsKey, "rebuildProgress", n).Err(); e != nil {
		slog.Warn("maintenance progress telemetry unavailable", "errorType", metrics.ErrorType(e))
	}
}
