package cronjob

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/runlock"
	"github.com/redis/go-redis/v9"
)

const gupyCursorKey = "scraper:provider:gupy:checkpoint"

type gupyCursor struct {
	scheduler *Scheduler
	lease     *runlock.Lease
}
type gupyCursorState struct {
	Manifest string `json:"manifest"`
	Offset   int    `json:"offset"`
}

func (c *gupyCursor) Load(ctx context.Context, manifest string, count int) (int, error) {
	raw, err := c.scheduler.rdb.Get(ctx, gupyCursorKey).Bytes()
	if err == redis.Nil {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	var state gupyCursorState
	if err = json.Unmarshal(raw, &state); err != nil {
		return 0, err
	}
	if state.Manifest != manifest {
		return 0, fmt.Errorf("gupy query manifest changed; explicit cursor migration required")
	}
	if state.Offset < 0 || state.Offset >= count {
		return 0, fmt.Errorf("invalid gupy cursor")
	}
	return state.Offset, nil
}

var advanceGupyCursor = redis.NewScript(`
if redis.call('GET',KEYS[1]) ~= ARGV[1] then return -1 end
local raw=redis.call('GET',KEYS[2])
if raw then
 local state=cjson.decode(raw)
 if state.manifest ~= ARGV[2] or state.offset ~= tonumber(ARGV[3]) then return 0 end
elseif tonumber(ARGV[3]) ~= 0 then return 0 end
redis.call('SET',KEYS[2],ARGV[4])
return 1
`)

func (c *gupyCursor) Advance(_ context.Context, manifest string, count, index int) error {
	next, _ := json.Marshal(gupyCursorState{Manifest: manifest, Offset: (index + 1) % count})
	// The processing context permits a bounded checkpoint during collection drain,
	// while still honoring shutdown and ownership loss.
	written, err := advanceGupyCursor.Run(c.lease.Context(), c.scheduler.rdb, []string{runlock.LockKey, gupyCursorKey}, c.lease.Token(), manifest, index, string(next)).Int()
	if err != nil {
		return err
	}
	if written == -1 {
		return runlock.ErrLost
	}
	if written != 1 {
		return fmt.Errorf("gupy cursor conflict")
	}
	return nil
}
