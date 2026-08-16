package cache

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

func NewCache() (Cache, error) {
	url := os.Getenv("VALKEY_URL")

	if url == "" || strings.HasPrefix(url, "memory://") {
		return NewMemoryCache(), nil
	}

	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("cache: invalid VALKEY_URL %q: %w", url, err)
	}

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := waitForRedisPing(ctx, client); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("cache: could not reach Valkey at %q: %w", url, err)
	}

	return NewRedisCache(client), nil
}

func waitForRedisPing(ctx context.Context, client *redis.Client) error {
	var lastErr error
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		if err := client.Ping(ctx).Err(); err == nil {
			return nil
		} else {
			lastErr = err
		}

		select {
		case <-ctx.Done():
			return lastErr
		case <-ticker.C:
		}
	}
}
