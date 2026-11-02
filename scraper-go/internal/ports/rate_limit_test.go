package ports

import (
	"errors"
	"fmt"
	"github.com/stretchr/testify/require"
	"testing"
	"time"
)

func TestLatestRetryAfterPreservesLongestProviderDeadline(t *testing.T) {
	now := time.Now()
	err := errors.Join(&RateLimitError{ProviderGreenhouse, now.Add(time.Minute)}, fmt.Errorf("wrapped: %w", &RateLimitError{ProviderGreenhouse, now.Add(time.Hour)}), &RateLimitError{ProviderLever, now.Add(24 * time.Hour)})
	require.Equal(t, now.Add(time.Hour), LatestRetryAfter(err, ProviderGreenhouse))
	require.True(t, LatestRetryAfter(err, ProviderGupy).IsZero())
}
