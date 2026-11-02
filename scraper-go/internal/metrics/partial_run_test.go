package metrics

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestPartialRunReportsSavedWorkWithoutSuccess(t *testing.T) {
	StartRun("cron", time.Now(), "partial-test")
	BeginRunProcessing("partial-test", true)
	RecordRunPersistence("partial-test", 3, 2, 1, 3, nil)
	FinishRun(context.DeadlineExceeded, "partial-test")
	s := Current()
	require.True(t, s.Execution.Partial)
	require.Equal(t, "failed", s.Execution.Status)
	require.Equal(t, "timeout", *s.Execution.LastStatus)
	require.Equal(t, 2, s.Persistence.Inserted)
	StartRun("cron", time.Now(), "next-test")
	require.False(t, Current().Execution.Partial)
	FinishRun(nil, "next-test")
}
