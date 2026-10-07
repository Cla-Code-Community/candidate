package metrics

import (
	"runtime"
	runtimemetrics "runtime/metrics"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/taxonomy"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

type Execution struct {
	Status              string     `json:"status"`
	Source              *string    `json:"source"`
	StartedAt           *time.Time `json:"startedAt"`
	DurationSeconds     float64    `json:"durationSeconds"`
	FinishedAt          *time.Time `json:"finishedAt"`
	LastDurationSeconds float64    `json:"lastDurationSeconds"`
	LastStatus          *string    `json:"lastStatus"`
	NextRunAt           *time.Time `json:"nextRunAt"`
	Stage               *string    `json:"stage"`
	ApplicationVersion  string     `json:"applicationVersion"`
	TaxonomyVersion     string     `json:"taxonomyVersion"`
}
type Concurrency struct {
	Configured int `json:"configured"`
	Effective  int `json:"effective"`
	Active     int `json:"active"`
	Waiting    int `json:"waiting"`
}
type Lock struct {
	Held       bool    `json:"held"`
	TTLSeconds float64 `json:"ttlSeconds"`
}
type Queue struct {
	Depth    int `json:"depth"`
	Capacity int `json:"capacity"`
}
type RejectedTitle struct {
	Title      string `json:"title"`
	Count      int    `json:"count"`
	ReasonCode string `json:"reasonCode"`
}
type MaintenanceSummary struct {
	Operation       string    `json:"operation"`
	Status          string    `json:"status"`
	DurationSeconds float64   `json:"durationSeconds"`
	FinishedAt      time.Time `json:"finishedAt"`
	Processed       int       `json:"processed"`
	Divergences     int       `json:"divergences"`
}

func (s MaintenanceSummary) Valid() bool {
	switch s.Operation {
	case "rebuild", "reconcile", "backfill", "reclassify", "expire", "rollback":
	default:
		return false
	}
	return (s.Status == "success" || s.Status == "failed" || s.Status == "canceled") &&
		s.DurationSeconds >= 0 && s.Processed >= 0 && s.Divergences >= 0 && !s.FinishedAt.IsZero()
}

type Snapshot struct {
	Execution   Execution        `json:"execution"`
	Lock        Lock             `json:"lock"`
	Concurrency Concurrency      `json:"concurrency"`
	Progress    map[string]int   `json:"progress"`
	Queues      map[string]Queue `json:"queues"`
	Errors      struct {
		Total    int `json:"total"`
		Timeouts int `json:"timeouts"`
	} `json:"errors"`
	RejectedTitles      []RejectedTitle `json:"rejectedTitles"`
	RejectedTitlesSince time.Time       `json:"rejectedTitlesSince"`
}

var state = struct {
	sync.Mutex
	runID             string
	lockRunID         string
	execution         Execution
	concurrency       Concurrency
	expiry            time.Time
	held              bool
	progress          map[string]int
	providerRemaining map[string]int
	adapterRemaining  map[int]int
	active, waiting   map[string]int
	queues            map[string]func() Queue
	errors, timeouts  int
	titles            map[string]RejectedTitle
	titlesSince       time.Time
}{execution: Execution{Status: "idle", ApplicationVersion: "unknown", TaxonomyVersion: taxonomy.Version()}, progress: map[string]int{}, providerRemaining: map[string]int{}, adapterRemaining: map[int]int{}, active: map[string]int{}, waiting: map[string]int{}, queues: map[string]func() Queue{}, titles: map[string]RejectedTitle{}, titlesSince: time.Now().UTC()}
var progressKinds = []string{"providersTotal", "providersCompleted", "adaptersTotal", "adaptersProcessed", "tasksTotal", "tasksCompleted", "tasksCanceled", "keywordsTotal", "keywordsProcessed", "batchesCompleted"}
var CronInterval = promauto.NewGauge(prometheus.GaugeOpts{Name: "candidate_scraper_cron_interval_seconds", Help: "Configured cron interval"})

var queueNames = []string{"collection", "classification", "persistence", "indexing"}

func init() {
	for _, item := range []struct {
		name string
		get  func() float64
	}{
		{"candidate_scraper_configured_concurrency", func() float64 { return float64(Current().Concurrency.Configured) }},
		{"candidate_scraper_effective_concurrency", func() float64 { return float64(Current().Concurrency.Effective) }},
		{"candidate_scraper_active_tasks", func() float64 { return float64(Current().Concurrency.Active) }},
		{"candidate_scraper_waiting_tasks", func() float64 { return float64(Current().Concurrency.Waiting) }},
		{"candidate_scraper_lock_held", func() float64 {
			if Current().Lock.Held {
				return 1
			}
			return 0
		}},
		{"candidate_scraper_lock_ttl_seconds", func() float64 { return Current().Lock.TTLSeconds }},
		{"candidate_scraper_run_started_timestamp_seconds", func() float64 {
			v := Current().Execution.StartedAt
			if v == nil {
				return 0
			}
			return float64(v.Unix())
		}},
		{"candidate_scraper_running", func() float64 {
			s := Current().Execution.Status
			if s == "running" || s == "canceling" {
				return 1
			}
			return 0
		}},
	} {
		promauto.NewGaugeFunc(prometheus.GaugeOpts{Name: item.name, Help: item.name}, item.get)
	}
	for _, q := range queueNames {
		for _, kind := range []string{"depth", "capacity"} {
			promauto.NewGaugeFunc(prometheus.GaugeOpts{Name: "candidate_scraper_queue_" + kind, Help: "Actual bounded queue " + kind, ConstLabels: prometheus.Labels{"queue": q}}, func() float64 {
				v := Current().Queues[q]
				if kind == "capacity" {
					return float64(v.Capacity)
				}
				return float64(v.Depth)
			})
		}
	}
	// These settings are already exposed by the default Go collector. Do not
	// create duplicate runtime/resource metrics here.
}
func SetVersion(version string) {
	state.Lock()
	defer state.Unlock()
	state.execution.ApplicationVersion = version
}
func SetNextRun(t time.Time) {
	state.Lock()
	defer state.Unlock()
	if t.IsZero() {
		state.execution.NextRunAt = nil
	} else {
		state.execution.NextRunAt = &t
	}
}
func StartRun(source string, started time.Time, runID ...string) {
	state.Lock()
	defer state.Unlock()
	state.runID = ""
	if len(runID) > 0 {
		state.runID = runID[0]
	}
	s := Source(source)
	state.execution.Status = "running"
	state.execution.Source = &s
	state.execution.StartedAt = &started
	stage := "collection"
	state.execution.Stage = &stage
	state.progress = map[string]int{}
	for _, k := range progressKinds {
		state.progress[k] = 0
		Progress.WithLabelValues(k).Set(0)
	}
	state.errors = 0
	state.timeouts = 0
	state.titles = map[string]RejectedTitle{}
	state.titlesSince = started
	LastProgress.Set(float64(started.Unix()))
}
func FinishRun(err error, runID ...string) {
	state.Lock()
	defer state.Unlock()
	if len(runID) > 0 && runID[0] != state.runID {
		return
	}
	if state.execution.StartedAt == nil || state.execution.Source == nil {
		return
	}
	status := Status(err)
	now := time.Now().UTC()
	duration := now.Sub(*state.execution.StartedAt).Seconds()
	source := *state.execution.Source
	Runs.WithLabelValues(source, status).Inc()
	RunDuration.WithLabelValues(source, status).Observe(duration)
	LastRun.WithLabelValues(source, status).Set(float64(now.Unix()))
	state.execution.FinishedAt = &now
	state.execution.LastDurationSeconds = duration
	state.execution.LastStatus = &status
	if err == nil {
		state.execution.Status = "completed"
	} else {
		state.execution.Status = "failed"
	}
	state.execution.Stage = nil
	if status == "canceled" || status == "timeout" {
		n := max(0, state.progress["tasksTotal"]-state.progress["tasksCompleted"])
		state.progress["tasksCanceled"] += n
		Progress.WithLabelValues("tasksCanceled").Set(float64(state.progress["tasksCanceled"]))
	}
	state.concurrency.Active = 0
	state.concurrency.Waiting = 0
	state.active = map[string]int{}
	state.waiting = map[string]int{}
	for p := range state.providerRemaining {
		ProviderActive.WithLabelValues(p).Set(0)
		ProviderWaiting.WithLabelValues(p).Set(0)
	}
	state.queues = map[string]func() Queue{}
}
func Attempt(source, status string) {
	source = Source(source)
	Runs.WithLabelValues(source, status).Inc()
	RunDuration.WithLabelValues(source, status).Observe(0)
	LastRun.WithLabelValues(source, status).Set(float64(time.Now().Unix()))
}
func Canceling(runID ...string) {
	state.Lock()
	defer state.Unlock()
	if len(runID) > 0 && runID[0] != state.runID {
		return
	}
	if state.execution.Status == "running" {
		state.execution.Status = "canceling"
	}
}
func LockAcquired(ttl time.Duration, runID ...string) {
	state.Lock()
	defer state.Unlock()
	if len(runID) > 0 {
		state.lockRunID = runID[0]
	}
	state.held = true
	state.expiry = time.Now().Add(ttl)
}
func LockReleased(runID ...string) {
	state.Lock()
	defer state.Unlock()
	if len(runID) > 0 && runID[0] != state.lockRunID {
		return
	}
	state.held = false
	state.expiry = time.Time{}
}
func Stage(stage string) { state.Lock(); defer state.Unlock(); state.execution.Stage = &stage }
func BindQueue(name string, read func() Queue) {
	state.Lock()
	defer state.Unlock()
	state.queues[name] = read
}
func ClearQueues() {
	state.Lock()
	defer state.Unlock()
	state.queues = map[string]func() Queue{}
	state.concurrency.Active = 0
	state.concurrency.Waiting = 0
	for p := range state.active {
		ProviderActive.WithLabelValues(p).Set(0)
	}
	for p := range state.waiting {
		ProviderWaiting.WithLabelValues(p).Set(0)
	}
	state.active = map[string]int{}
	state.waiting = map[string]int{}
}
func AddProgress(kind string, n int) { state.Lock(); defer state.Unlock(); addProgress(kind, n) }
func addProgress(kind string, n int) {
	state.progress[kind] += n
	Progress.WithLabelValues(kind).Set(float64(state.progress[kind]))
	LastProgress.Set(float64(time.Now().Unix()))
}
func Configure(configured, effective int, sources []ports.JobSource, keywords int, limit func(ports.ProviderID) int) {
	state.Lock()
	defer state.Unlock()
	if configured > 0 {
		state.concurrency.Configured = configured
	}
	state.concurrency.Effective = effective
	state.providerRemaining = map[string]int{}
	state.adapterRemaining = map[int]int{}
	ProviderConfigured.Reset()
	tasks := 0
	for i, a := range sources {
		c := ports.CapabilitiesOf(a)
		n := 1
		if c.Mode == ports.DiscoveryKeyword {
			n = keywords
		}
		p := Provider(string(c.Provider))
		state.providerRemaining[p] += n
		state.adapterRemaining[i] = n
		tasks += n
		ProviderConfigured.WithLabelValues(p).Set(float64(limit(c.Provider)))
		ProviderActive.WithLabelValues(p).Set(0)
		ProviderWaiting.WithLabelValues(p).Set(0)
	}
	state.progress["providersTotal"] = len(state.providerRemaining)
	state.progress["adaptersTotal"] = len(sources)
	state.progress["tasksTotal"] = tasks
	// KeywordsProcessed counts the actual keyword inputs consumed across tasks,
	// not distinct strings (strings are never stored for metrics).
	state.progress["keywordsTotal"] = 0
	for i, a := range sources {
		c := ports.CapabilitiesOf(a)
		n := state.adapterRemaining[i]
		if c.Mode == ports.DiscoveryKeyword {
			state.progress["keywordsTotal"] += n
		} else {
			state.progress["keywordsTotal"] += keywords
		}
	}
	for k, v := range state.progress {
		Progress.WithLabelValues(k).Set(float64(v))
	}
}
func Waiting(provider string, delta int) {
	p := Provider(provider)
	state.Lock()
	defer state.Unlock()
	state.waiting[p] = max(0, state.waiting[p]+delta)
	state.concurrency.Waiting = max(0, state.concurrency.Waiting+delta)
	ProviderWaiting.WithLabelValues(p).Set(float64(state.waiting[p]))
}
func Active(provider string, delta int) {
	p := Provider(provider)
	state.Lock()
	defer state.Unlock()
	state.active[p] = max(0, state.active[p]+delta)
	state.concurrency.Active = max(0, state.concurrency.Active+delta)
	ProviderActive.WithLabelValues(p).Set(float64(state.active[p]))
}
func AdapterFinished(adapter int) {
	state.Lock()
	defer state.Unlock()
	if n := state.adapterRemaining[adapter]; n > 0 {
		state.adapterRemaining[adapter] = n - 1
		if n == 1 {
			addProgress("adaptersProcessed", 1)
		}
	}
}
func taskFinished(provider, status string, keywords int) {
	state.Lock()
	defer state.Unlock()
	addProgress("tasksCompleted", 1)
	addProgress("keywordsProcessed", keywords)
	if status == "canceled" || status == "timeout" {
		addProgress("tasksCanceled", 1)
	}
	if status != "success" {
		state.errors++
		if status == "timeout" {
			state.timeouts++
		}
	}
	if n := state.providerRemaining[provider]; n > 0 {
		state.providerRemaining[provider] = n - 1
		if n == 1 {
			addProgress("providersCompleted", 1)
		}
	}
}
func Current() Snapshot {
	state.Lock()
	defer state.Unlock()
	s := Snapshot{Execution: state.execution, Concurrency: state.concurrency, Lock: Lock{Held: state.held, TTLSeconds: max(0, time.Until(state.expiry).Seconds())}, Progress: map[string]int{}, Queues: map[string]Queue{}, RejectedTitles: []RejectedTitle{}, RejectedTitlesSince: state.titlesSince}
	if s.Execution.StartedAt != nil {
		if s.Execution.Status == "running" || s.Execution.Status == "canceling" {
			s.Execution.DurationSeconds = max(0, time.Since(*s.Execution.StartedAt).Seconds())
		} else {
			s.Execution.DurationSeconds = s.Execution.LastDurationSeconds
		}
	}
	for k, v := range state.progress {
		s.Progress[k] = v
	}
	for _, k := range progressKinds {
		if _, ok := s.Progress[k]; !ok {
			s.Progress[k] = 0
		}
	}
	for _, q := range queueNames {
		if f := state.queues[q]; f != nil {
			s.Queues[q] = f()
		} else {
			s.Queues[q] = Queue{}
		}
	}
	s.Errors.Total = state.errors
	s.Errors.Timeouts = state.timeouts
	if time.Since(state.titlesSince) < 24*time.Hour {
		for _, v := range state.titles {
			s.RejectedTitles = append(s.RejectedTitles, v)
		}
	}
	sort.Slice(s.RejectedTitles, func(i, j int) bool {
		a, b := s.RejectedTitles[i], s.RejectedTitles[j]
		if a.Count != b.Count {
			return a.Count > b.Count
		}
		if a.Title != b.Title {
			return a.Title < b.Title
		}
		return a.ReasonCode < b.ReasonCode
	})
	if len(s.RejectedTitles) > 10 {
		s.RejectedTitles = s.RejectedTitles[:10]
	}
	return s
}
func RejectTitle(title, reason string) {
	state.Lock()
	defer state.Unlock()
	if time.Since(state.titlesSince) >= 24*time.Hour {
		state.titles = map[string]RejectedTitle{}
		state.titlesSince = time.Now().UTC()
	}
	r := []rune(stringsLowerSpace(title))
	if len(r) > 50 {
		r = r[:50]
	}
	t := string(r)
	if t == "" || strings.Contains(t, "@") || strings.Contains(t, "http://") || strings.Contains(t, "https://") {
		return
	}
	key := reason + ":" + t
	if _, ok := state.titles[key]; !ok && len(state.titles) >= 100 {
		return
	}
	v := state.titles[key]
	v.Title = t
	v.ReasonCode = reason
	v.Count++
	state.titles[key] = v
}
func RuntimeSettings() (int, int64) {
	samples := []runtimemetrics.Sample{{Name: "/gc/gomemlimit:bytes"}}
	runtimemetrics.Read(samples)
	return runtime.GOMAXPROCS(0), int64(samples[0].Value.Uint64())
}

func stringsLowerSpace(s string) string { return strings.ToLower(strings.Join(strings.Fields(s), " ")) }

func SetConfiguredConcurrency(n int) {
	state.Lock()
	defer state.Unlock()
	state.concurrency.Configured = n
}

func RecordStateError(err error) {
	state.Lock()
	defer state.Unlock()
	state.errors++
	if ErrorType(err) == "timeout" {
		state.timeouts++
	}
}
