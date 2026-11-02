package gupy

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"strconv"
)

var errHTTPBudget = errors.New("gupy HTTP attempt budget exhausted")
var errPageBudget = errors.New("gupy query pagination truncated by page budget")

type cursorError struct{ error }

func (e cursorError) Unwrap() error { return e.error }

type budgetKey struct{}
type runBudget struct {
	initial   int
	remaining int
	maxPages  int
	started   bool
	onStart   func(context.Context) error
}

func (b *runBudget) reserve(ctx context.Context) error {
	if err := context.Cause(ctx); err != nil {
		return err
	}
	if b.remaining <= 0 {
		return errHTTPBudget
	}
	if !b.started {
		if b.onStart != nil {
			if err := b.onStart(ctx); err != nil {
				return cursorError{err}
			}
		}
		b.started = true
	}
	b.remaining--
	return nil
}
func positiveEnv(name string, fallback int) (int, error) {
	value := os.Getenv(name)
	if value == "" {
		return fallback, nil
	}
	n, err := strconv.Atoi(value)
	if err != nil || n <= 0 {
		return 0, fmt.Errorf("invalid %s", name)
	}
	return n, nil
}
func queryManifest(queries []string) string {
	raw, _ := json.Marshal(queries)
	h := sha256.Sum256(raw)
	return hex.EncodeToString(h[:])
}
func pageFingerprint(jobs []gupyJob) string {
	ids := make([]string, 0, len(jobs))
	for _, job := range jobs {
		id := gupyDedupeKey(job)
		if id == "" {
			return ""
		}
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return queryManifest(ids)
}
