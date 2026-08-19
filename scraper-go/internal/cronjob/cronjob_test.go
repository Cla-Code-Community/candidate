package cronjob

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDefaultConfigUsesSafeMaxConcurrency(t *testing.T) {
	cfg := DefaultConfig()

	assert.Equal(t, 12, cfg.MaxConcurrency)
}

func TestSchedulerSearchConfigReceivesGlobalMaxConcurrency(t *testing.T) {
	cfg := DefaultConfig()
	cfg.MaxConcurrency = 9

	scheduler := New(cfg, nil, nil, nil, nil)
	searchConfig := scheduler.searchConfig([]string{"go"})

	assert.Equal(t, 9, searchConfig.MaxConcurrency)
	assert.Equal(t, []string{"go"}, searchConfig.Keywords)
}

func TestAdminManualSharesSchedulerConfig(t *testing.T) {
	cfg := DefaultConfig()
	cfg.MaxConcurrency = 7

	scheduler := New(cfg, nil, nil, nil, nil)

	assert.Equal(t, 7, scheduler.cfg.MaxConcurrency)
}
