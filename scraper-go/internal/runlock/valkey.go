package runlock

import (
	"context"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	LockKey        = "scraper:run:lock"
	StateKey       = "scraper:run:state"
	NextAllowedKey = "scraper:run:next_allowed_at"
)

var acquireScript = redis.NewScript(`
if redis.call('EXISTS',KEYS[1]) == 1 then return {0,0} end
local clock = redis.call('TIME')
local now = tonumber(clock[1])*1000 + math.floor(tonumber(clock[2])/1000)
local allowed = tonumber(redis.call('GET',KEYS[2]) or '0')
if allowed > now then return {-1,allowed} end
redis.call('SET',KEYS[1],ARGV[1],'PX',ARGV[2])
if tonumber(ARGV[3]) > 0 then redis.call('SET',KEYS[2],now+tonumber(ARGV[2])+tonumber(ARGV[3])) end
return {1,0}
`)

var writeStateScript = redis.NewScript(`
if redis.call("GET", KEYS[1]) ~= ARGV[1] then
  return 0
end
redis.call("DEL", KEYS[2])
redis.call("HSET", KEYS[2],
  "runId", ARGV[2],
  "source", ARGV[3],
  "startedAt", ARGV[4],
  "lockExpiresAt", ARGV[5])
redis.call("PEXPIRE", KEYS[2], ARGV[6])
return 1
`)

var renewScript = redis.NewScript(`
if redis.call("GET", KEYS[1]) ~= ARGV[1] then
  return 0
end
redis.call("PEXPIRE", KEYS[1], ARGV[6])
if tonumber(ARGV[7]) > 0 then
  local clock = redis.call('TIME')
  local now = tonumber(clock[1])*1000 + math.floor(tonumber(clock[2])/1000)
  redis.call('SET',KEYS[3],now+tonumber(ARGV[6])+tonumber(ARGV[7]))
end
if redis.call("HGET", KEYS[2], "runId") ~= ARGV[2] then
  redis.call("DEL", KEYS[2])
end
redis.call("HSET", KEYS[2],
  "runId", ARGV[2],
  "source", ARGV[3],
  "startedAt", ARGV[4],
  "lockExpiresAt", ARGV[5])
redis.call("PEXPIRE", KEYS[2], ARGV[6])
return 1
`)

var releaseScript = redis.NewScript(`
if redis.call("GET", KEYS[1]) ~= ARGV[1] then
  return 0
end
if tonumber(ARGV[3]) > 0 then
  local clock = redis.call('TIME')
  local now = tonumber(clock[1])*1000 + math.floor(tonumber(clock[2])/1000)
  redis.call('SET',KEYS[3],now+tonumber(ARGV[3]))
end
redis.call("DEL", KEYS[1])
if redis.call("HGET", KEYS[2], "runId") == ARGV[2] then
  redis.call("DEL", KEYS[2])
end
return 1
`)

type Store interface {
	TryAcquire(ctx context.Context, token string, ttl time.Duration) (bool, error)
	WriteState(ctx context.Context, token string, state State, ttl time.Duration) (bool, error)
	Renew(ctx context.Context, token string, state State, ttl time.Duration) (bool, error)
	Release(ctx context.Context, token, runID string) (bool, error)
}

type ValkeyStore struct {
	client *redis.Client
	pause  time.Duration
}

// Production always uses the five-minute default. An explicit override supports
// isolated legacy test fixtures; there is no runtime/env option to disable it.
func NewValkeyStore(client *redis.Client, testPause ...time.Duration) *ValkeyStore {
	pause := MinimumInterval
	if len(testPause) > 0 {
		pause = testPause[0]
	}
	return &ValkeyStore{client: client, pause: pause}
}

func (s *ValkeyStore) TryAcquire(ctx context.Context, token string, ttl time.Duration) (bool, error) {
	result, err := acquireScript.Run(ctx, s.client, []string{LockKey, NextAllowedKey}, token, ttl.Milliseconds(), s.pause.Milliseconds()).Int64Slice()
	if err != nil {
		return false, err
	}
	if result[0] == -1 {
		return false, &CooldownError{NextAllowedAt: time.UnixMilli(result[1])}
	}
	return result[0] == 1, nil
}

func acquireCommand(token string, ttl time.Duration) []any {
	return []any{"SET", LockKey, token, "NX", "PX", ttl.Milliseconds()}
}

func (s *ValkeyStore) WriteState(
	ctx context.Context,
	token string,
	state State,
	ttl time.Duration,
) (bool, error) {
	result, err := writeStateScript.Run(
		ctx,
		s.client,
		[]string{LockKey, StateKey},
		token,
		state.RunID,
		state.Source,
		state.StartedAt.UTC().Format(time.RFC3339Nano),
		state.LockExpiresAt.UTC().Format(time.RFC3339Nano),
		strconv.FormatInt(ttl.Milliseconds(), 10),
	).Int64()
	return result == 1, err
}

func (s *ValkeyStore) Renew(
	ctx context.Context,
	token string,
	state State,
	ttl time.Duration,
) (bool, error) {
	result, err := renewScript.Run(
		ctx,
		s.client,
		[]string{LockKey, StateKey, NextAllowedKey},
		token,
		state.RunID,
		state.Source,
		state.StartedAt.UTC().Format(time.RFC3339Nano),
		state.LockExpiresAt.UTC().Format(time.RFC3339Nano),
		strconv.FormatInt(ttl.Milliseconds(), 10),
		s.pause.Milliseconds(),
	).Int64()
	return result == 1, err
}

func (s *ValkeyStore) Release(ctx context.Context, token, runID string) (bool, error) {
	result, err := releaseScript.Run(
		ctx,
		s.client,
		[]string{LockKey, StateKey, NextAllowedKey},
		token,
		runID,
		s.pause.Milliseconds(),
	).Int64()
	return result == 1, err
}
