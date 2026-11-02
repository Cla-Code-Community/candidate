package runlock

import (
	"context"
	"github.com/stretchr/testify/require"
	"strconv"
	"testing"
	"time"
)

func TestExecutionAbsoluteBudgetIncludesDrainAndRelease(t *testing.T) {
	start := time.Now()
	total, processing, collection := executionDeadlines(context.Background(), start)
	require.Equal(t, 55*time.Minute, total.Sub(start))
	require.Equal(t, 5*time.Second, total.Sub(processing))
	require.Equal(t, 30*time.Second, processing.Sub(collection))
	parent, cancel := context.WithDeadline(context.Background(), start.Add(time.Second))
	defer cancel()
	total, processing, collection = executionDeadlines(parent, start)
	require.Equal(t, start.Add(time.Second), total)
	require.True(t, collection.Before(processing))
	require.True(t, processing.Before(total))
}

func TestGlobalPausePersistsAcrossRestartAndSerializesReplicas(t *testing.T) {
	m, client, server := newTestManager(t, 2*time.Second, 500*time.Millisecond)
	m.store = NewValkeyStore(client)
	now := time.Now().UTC().Truncate(time.Millisecond)
	server.SetTime(now)
	lease, err := m.Acquire(context.Background(), "cron")
	require.NoError(t, err)
	require.NoError(t, lease.Release(context.Background()))
	stamp, err := strconv.ParseInt(client.Get(context.Background(), NextAllowedKey).Val(), 10, 64)
	require.NoError(t, err)
	require.Equal(t, now.Add(MinimumInterval), time.UnixMilli(stamp).UTC())
	restarted, err := New(NewValkeyStore(client), m.cfg)
	require.NoError(t, err)
	server.SetTime(now.Add(MinimumInterval - time.Millisecond))
	_, err = restarted.Acquire(context.Background(), "admin_manual")
	var pause *CooldownError
	require.ErrorAs(t, err, &pause)
	server.SetTime(now.Add(MinimumInterval))
	type answer struct {
		lease *Lease
		err   error
	}
	out := make(chan answer, 2)
	for _, replica := range []*Manager{m, restarted} {
		go func(m *Manager) { l, e := m.Acquire(context.Background(), "cron"); out <- answer{l, e} }(replica)
	}
	wins := 0
	for range 2 {
		a := <-out
		if a.err == nil {
			wins++
			defer a.lease.Release(context.Background())
		} else {
			require.ErrorIs(t, a.err, ErrAlreadyHeld)
		}
	}
	require.Equal(t, 1, wins)
}

func TestCrashRetainsPauseBeyondLeaseExpiration(t *testing.T) {
	m, client, server := newTestManager(t, 2*time.Second, 500*time.Millisecond)
	m.store = NewValkeyStore(client)
	now := time.Now().UTC()
	server.SetTime(now)
	lease, err := m.Acquire(context.Background(), "cron")
	require.NoError(t, err)
	lease.cancelRenewal()
	lease.stopOnce.Do(func() { close(lease.stopRenewal) })
	<-lease.renewalDone
	server.FastForward(3 * time.Second)
	server.SetTime(now.Add(3 * time.Second))
	_, err = m.Acquire(context.Background(), "admin_manual")
	var pause *CooldownError
	require.ErrorAs(t, err, &pause)
	lease.cancel(nil)
	lease.cancelDeadline()
}

func TestCanceledExecutionRenewsUntilWorkersJoinAndRelease(t *testing.T) {
	m, client, server := newTestManager(t, 100*time.Millisecond, 10*time.Millisecond)
	ctx, cancel := context.WithCancel(context.Background())
	lease, err := m.Acquire(ctx, "cron")
	require.NoError(t, err)
	defer lease.Release(context.Background())
	cancel()
	require.ErrorIs(t, context.Cause(lease.Context()), context.Canceled)
	server.FastForward(90 * time.Millisecond)
	require.Eventually(t, func() bool { return client.PTTL(context.Background(), LockKey).Val() > 90*time.Millisecond }, time.Second, 5*time.Millisecond)
	_, err = m.Acquire(context.Background(), "admin_manual")
	require.ErrorIs(t, err, ErrAlreadyHeld)
}
