package runlock

import (
	"context"
	"fmt"
	"time"
)

const MaxExecutionDuration = 55 * time.Minute
const MinimumInterval = 5 * time.Minute

type CooldownError struct{ NextAllowedAt time.Time }

func (e *CooldownError) Error() string {
	return fmt.Sprintf("scraper global pause until %s", e.NextAllowedAt.UTC().Format(time.RFC3339Nano))
}

// Keep the existing HTTP 409 admission contract; callers can distinguish pause.
func (e *CooldownError) Unwrap() error { return ErrAlreadyHeld }

func executionDeadlines(ctx context.Context, start time.Time) (total, processing, collection time.Time) {
	total = start.Add(MaxExecutionDuration)
	if parent, ok := ctx.Deadline(); ok && parent.Before(total) {
		total = parent
	}
	remaining := max(time.Duration(0), total.Sub(start))
	release := min(5*time.Second, remaining/20)
	drain := min(30*time.Second, (remaining-release)/10)
	processing = total.Add(-release)
	collection = processing.Add(-drain)
	return
}

func (l *Lease) Deadline() time.Time { return l.deadline }
func (l *Lease) CollectionDeadline(timeout time.Duration) time.Time {
	deadline := l.collectionDeadline
	if timeout > 0 && l.startedAt.Add(timeout).Before(deadline) {
		deadline = l.startedAt.Add(timeout)
	}
	return deadline
}
