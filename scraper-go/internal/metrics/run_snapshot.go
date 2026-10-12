package metrics

import "time"

// Run totals are independent of process-lifetime Prometheus counters. Only
// events carrying the current real lease identity may update an active run.
type ClassificationTotals struct {
	Received   int `json:"received"`
	Classified int `json:"classified"`
	Approved   int `json:"approved"`
	Rejected   int `json:"rejected"`
	Invalid    int `json:"invalid"`
}
type PersistenceTotals struct {
	Received      int `json:"received"`
	Inserted      int `json:"inserted"`
	Updated       int `json:"updated"`
	Skipped       int `json:"skipped"`
	Failed        int `json:"failed"`
	FailedBatches int `json:"failedBatches"`
}
type ProviderState struct {
	ID                      string     `json:"id"`
	ConfiguredConcurrency   int        `json:"configuredConcurrency"`
	Active                  int        `json:"active"`
	Waiting                 int        `json:"waiting"`
	TasksTotal              int        `json:"tasksTotal"`
	TasksCompleted          int        `json:"tasksCompleted"`
	TasksFailed             int        `json:"tasksFailed"`
	TasksCanceled           int        `json:"tasksCanceled"`
	JobsCollected           int        `json:"jobsCollected"`
	LastTaskStatus          *string    `json:"lastTaskStatus"`
	LastTaskFinishedAt      *time.Time `json:"lastTaskFinishedAt"`
	LastTaskDurationSeconds *float64   `json:"lastTaskDurationSeconds"`
	LastErrorType           *string    `json:"lastErrorType"`
}

func activeRun(runID string) bool {
	return runID != "" && runID == state.runID && (state.execution.Status == "running" || state.execution.Status == "canceling")
}
func BeginRunProcessing(runID string, persistence bool) {
	state.Lock()
	defer state.Unlock()
	if !activeRun(runID) {
		return
	}
	if state.classification == nil {
		state.classification = &ClassificationTotals{}
	}
	if persistence && state.persistence == nil {
		state.persistence = &PersistenceTotals{}
	}
}
func RunClassificationReceived(runID string, n int) {
	state.Lock()
	defer state.Unlock()
	if activeRun(runID) && state.classification != nil {
		state.classification.Received += max(0, n)
	}
}
func RecordRunClassification(runID string, approved bool) {
	state.Lock()
	defer state.Unlock()
	if !activeRun(runID) || state.classification == nil {
		return
	}
	state.classification.Classified++
	if approved {
		state.classification.Approved++
	} else {
		state.classification.Rejected++
	}
}
func RecordRunInvalid(runID string) {
	state.Lock()
	defer state.Unlock()
	if activeRun(runID) && state.classification != nil {
		state.classification.Invalid++
	}
}
func RunPersistenceReceived(runID string, size int) {
	state.Lock()
	defer state.Unlock()
	if activeRun(runID) && state.persistence != nil {
		state.persistence.Received += max(0, size)
	}
}

// Called once with the final SaveBatch result, after its internal retries.
// Skipped means inputs absent from committed Persisted, including invalid and
// duplicate inputs; it is not another count of unique durable catalog rows.
func RecordRunPersistence(runID string, size, inserted, updated, persisted int, err error) {
	state.Lock()
	defer state.Unlock()
	if !activeRun(runID) || state.persistence == nil {
		return
	}
	p := state.persistence
	if err != nil {
		p.Failed += max(0, size)
		p.FailedBatches++
		return
	}
	p.Inserted += max(0, inserted)
	p.Updated += max(0, updated)
	p.Skipped += max(0, size-persisted)
}
func RecordRunProvider(runID, provider string, jobs int, started time.Time, err error) {
	state.Lock()
	defer state.Unlock()
	if !activeRun(runID) {
		return
	}
	p, ok := state.providers[Provider(provider)]
	if !ok {
		return
	} // Never create providers from arbitrary event text.
	status := Status(err)
	now := time.Now().UTC()
	duration := max(0, now.Sub(started).Seconds())
	p.TasksCompleted++
	p.JobsCollected += max(0, jobs)
	if status == "failed" {
		p.TasksFailed++
	}
	if status == "canceled" || status == "timeout" {
		p.TasksCanceled++
	}
	p.LastTaskStatus = &status
	p.LastTaskFinishedAt = &now
	p.LastTaskDurationSeconds = &duration
	p.LastErrorType = nil
	if err != nil {
		category := ErrorType(err)
		p.LastErrorType = &category
	}
	state.providers[p.ID] = p
}

func copyPointer[T any](p *T) *T {
	if p == nil {
		return nil
	}
	v := *p
	return &v
}
