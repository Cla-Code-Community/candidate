package adapterutil

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/stretchr/testify/require"
)

func TestKeywordCoverageLogsPlannedCompletedFailedAndNotExecuted(t *testing.T) {
	var output bytes.Buffer
	old := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&output, nil)))
	defer slog.SetDefault(old)
	calls := 0
	limit := &ports.RateLimitError{Provider: ports.ProviderAdzuna, NotBefore: time.Now().Add(time.Hour)}
	jobs, err := SearchAllKeywords(context.Background(), []string{" go ", "go", "java", "rust", "python", " "}, domain.ScrapeRequest{RunID: "run-1", WindowID: "adzuna-1"}, ports.ProviderAdzuna, func(context.Context, string, domain.ScrapeRequest) ([]domain.Job, error) {
		calls++
		if calls == 2 {
			return nil, limit
		}
		return []domain.Job{{Title: "Developer"}}, nil
	})
	require.ErrorIs(t, err, limit)
	require.Len(t, jobs, 1)
	require.Equal(t, 2, calls)
	var entry map[string]any
	require.NoError(t, json.Unmarshal(output.Bytes(), &entry))
	for key, value := range map[string]any{"planned": float64(4), "started": float64(2), "completed": float64(1), "failed": float64(1), "not_executed": float64(2), "status": "partial", "window_id": "adzuna-1", "run_id": "run-1"} {
		require.Equal(t, value, entry[key], key)
	}
}
