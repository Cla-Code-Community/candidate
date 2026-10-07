package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/metrics"
	"github.com/redis/go-redis/v9"
)

type dependencyHealth struct {
	Status string `json:"status"`
}
type operationalResources struct {
	CPUPercent      *float64 `json:"cpuPercent"`
	CPUSeconds      float64  `json:"cpuSeconds"`
	MemoryBytes     *uint64  `json:"memoryBytes"`
	HeapBytes       uint64   `json:"heapBytes"`
	Goroutines      int      `json:"goroutines"`
	GOMAXPROCS      int      `json:"gomaxprocs"`
	GOMEMLIMITBytes int64    `json:"gomemlimitBytes"`
}

type operationalIndex struct {
	ActiveVersion   string                      `json:"activeVersion"`
	Maintenance     *metrics.MaintenanceSummary `json:"maintenance"`
	RebuildProgress *int64                      `json:"rebuildProgress"`
}

// Separate small pool: diagnostic deadlines must also constrain Redis I/O,
// without changing retries/timeouts of catalog persistence and index writes.
func observabilityRedisClient(source *redis.Client) *redis.Client {
	opts := *source.Options()
	opts.Dialer = nil
	opts.DialerRetries = 1
	opts.PushNotificationProcessor = nil
	opts.ContextTimeoutEnabled = true
	opts.MaxRetries = -1
	opts.DialTimeout = 2 * time.Second
	opts.ReadTimeout = 2 * time.Second
	opts.WriteTimeout = 2 * time.Second
	opts.PoolTimeout = 2 * time.Second
	opts.PoolSize = 2
	opts.MaxConcurrentDials = 2
	opts.MaxActiveConns = 2
	opts.MaxIdleConns = 2
	opts.MinIdleConns = 0
	return redis.NewClient(&opts)
}

var cpuSample = struct {
	sync.Mutex
	at      time.Time
	seconds float64
	percent *float64
}{}

func resources() operationalResources {
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)
	var usage syscall.Rusage
	_ = syscall.Getrusage(syscall.RUSAGE_SELF, &usage)
	r := operationalResources{CPUSeconds: float64(usage.Utime.Sec+usage.Stime.Sec) + float64(usage.Utime.Usec+usage.Stime.Usec)/1e6, HeapBytes: mem.HeapAlloc, Goroutines: runtime.NumGoroutine()}
	r.GOMAXPROCS, r.GOMEMLIMITBytes = metrics.RuntimeSettings()
	cpuSample.Lock()
	now := time.Now()
	elapsed := now.Sub(cpuSample.at).Seconds()
	if !cpuSample.at.IsZero() && elapsed >= .1 {
		v := max(0, (r.CPUSeconds-cpuSample.seconds)/elapsed*100)
		cpuSample.percent = &v
	}
	r.CPUPercent = cpuSample.percent
	cpuSample.at = now
	cpuSample.seconds = r.CPUSeconds
	cpuSample.Unlock()
	if raw, e := os.ReadFile("/proc/self/statm"); e == nil {
		parts := strings.Fields(string(raw))
		if len(parts) > 1 {
			if pages, e := strconv.ParseUint(parts[1], 10, 64); e == nil {
				bytes := pages * uint64(os.Getpagesize())
				r.MemoryBytes = &bytes
			}
		}
	}
	return r
}

// Internal technical status only. Authentication and RBAC remain in Node.
// Every dependency probe shares the request deadline and is joined before return.
func handleOperationalSnapshot(db *sql.DB, rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		pg, vk := dependencyHealth{"down"}, dependencyHealth{"down"}
		version := ""
		var maintenance *metrics.MaintenanceSummary
		var rebuildProgress *int64
		var wg sync.WaitGroup
		wg.Add(2)
		go func() {
			defer wg.Done()
			if db != nil && db.PingContext(ctx) == nil {
				pg.Status = "ok"
			}
		}()
		go func() {
			defer wg.Done()
			if rdb == nil {
				return
			}
			pipe := rdb.Pipeline()
			ping := pipe.Ping(ctx)
			active := pipe.Get(ctx, "scraper:jobs:index-version")
			summary := pipe.Get(ctx, "scraper:observability:maintenance")
			progress := pipe.HGet(ctx, metrics.MaintenanceMetricsKey, "rebuildProgress")
			_, err := pipe.Exec(ctx)

			if ping.Err() == nil {
				vk.Status = "ok"
				if err != nil && err != redis.Nil {
					vk.Status = "degraded"
				}
			}
			version = active.Val()
			if n, e := strconv.ParseInt(progress.Val(), 10, 64); e == nil && n >= 0 {
				rebuildProgress = &n
			}
			if summary.Err() == nil {
				var parsed metrics.MaintenanceSummary
				if json.Unmarshal([]byte(summary.Val()), &parsed) == nil && parsed.Valid() {
					maintenance = &parsed
				} else if vk.Status == "ok" {
					vk.Status = "degraded"
				}
			}
		}()
		wg.Wait()
		status := "ok"
		if pg.Status != "ok" || vk.Status != "ok" {
			status = "partial"
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		json.NewEncoder(w).Encode(struct {
			metrics.Snapshot
			Status       string                      `json:"status"`
			Timestamp    time.Time                   `json:"timestamp"`
			Resources    operationalResources        `json:"resources"`
			Dependencies map[string]dependencyHealth `json:"dependencies"`
			Index        operationalIndex            `json:"index"`
		}{Snapshot: metrics.Current(), Status: status, Timestamp: time.Now().UTC(), Resources: resources(), Dependencies: map[string]dependencyHealth{"postgres": pg, "valkey": vk}, Index: operationalIndex{version, maintenance, rebuildProgress}})
	}
}
