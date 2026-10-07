package main

import (
	"context"
	"encoding/json"
	"io"
	"net"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/metrics"
	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func TestOperationalSnapshotPartialResourcesAndNoSecrets(t *testing.T) {
	metrics.StartRun("cron", time.Now())
	metrics.LockAcquired(time.Second)
	r := httptest.NewRecorder()
	handleOperationalSnapshot(nil, nil)(r, httptest.NewRequest("GET", "/admin/observability", nil))
	if r.Code != 200 {
		t.Fatal(r.Code)
	}
	var body struct {
		Status    string
		Execution metrics.Execution
		Resources operationalResources
		Lock      metrics.Lock
	}
	if err := json.Unmarshal(r.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Status != "partial" || body.Execution.Status != "running" || body.Resources.Goroutines < 1 || !body.Lock.Held {
		t.Fatal(r.Body.String())
	}
	if strings.Contains(r.Body.String(), "token") || strings.Contains(r.Body.String(), "runId") {
		t.Fatal("secret exposure")
	}
	metrics.LockReleased()
	metrics.FinishRun(nil)
	r = httptest.NewRecorder()
	handleOperationalSnapshot(nil, nil)(r, httptest.NewRequest("GET", "/admin/observability", nil))
	if err := json.Unmarshal(r.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Execution.LastStatus == nil || *body.Execution.LastStatus != "success" {
		t.Fatal("last run missing")
	}
}

func TestOperationalSnapshotSanitizesMaintenanceAndKeepsPartialFields(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr(), ContextTimeoutEnabled: true})
	defer rdb.Close()
	for _, raw := range []string{
		`{"operation":"reconcile","status":"success","finishedAt":"2026-10-07T00:00:00Z","durationSeconds":1,"processed":2,"divergences":0,"token":"private-secret"}`,
		`{"token":"private-secret"}`,
	} {
		mr.Set("scraper:observability:maintenance", raw)
		response := httptest.NewRecorder()
		handleOperationalSnapshot(nil, rdb)(response, httptest.NewRequest("GET", "/admin/observability", nil))
		if strings.Contains(response.Body.String(), "private-secret") || !strings.Contains(response.Body.String(), `"resources":`) {
			t.Fatal("maintenance payload escaped sanitization or hid available resources")
		}
		if raw == `{"token":"private-secret"}` && !strings.Contains(response.Body.String(), `"valkey":{"status":"degraded"}`) {
			t.Fatal("invalid maintenance metadata was not marked partially unavailable")
		}
	}
}

func TestOperationalSnapshotRedisDeadlineDoesNotChangeCatalogClient(t *testing.T) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	done := make(chan struct{})
	go func() {
		defer close(done)
		connection, err := listener.Accept()
		if err == nil {
			defer connection.Close()
			connection.SetReadDeadline(time.Now().Add(time.Second))
			io.Copy(io.Discard, connection) // Accept Redis requests, never respond.
		}
	}()
	source := redis.NewClient(&redis.Options{Addr: listener.Addr().String()})
	defer source.Close()
	diagnostic := observabilityRedisClient(source)
	defer diagnostic.Close()
	if source.Options().ContextTimeoutEnabled || !diagnostic.Options().ContextTimeoutEnabled || diagnostic.Options().MaxRetries != 0 {
		t.Fatal("diagnostic pool changed the catalog client")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	response := httptest.NewRecorder()
	started := time.Now()
	handleOperationalSnapshot(nil, diagnostic)(response, httptest.NewRequest("GET", "/admin/observability", nil).WithContext(ctx))
	if time.Since(started) > time.Second || response.Code != 200 || !strings.Contains(response.Body.String(), `"status":"partial"`) {
		t.Fatal("dependency deadline did not yield a partial snapshot")
	}
	diagnostic.Close()
	listener.Close()
	<-done
}
