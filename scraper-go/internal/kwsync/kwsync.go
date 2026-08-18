package kwsync

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/keywords"
	"github.com/redis/go-redis/v9"
)

const (
	pendingKey   = "scraper:keywords:pending"
	pollInterval = 30 * time.Second
)

// KeywordEvent é o payload publicado pelo Node.js na fila.
type KeywordEvent struct {
	Keyword   string    `json:"keyword"`
	Source    string    `json:"source"` // "user"
	CreatedAt time.Time `json:"createdAt"`
}

// Consumer lê a fila do Valkey e persiste keywords novas.
type Consumer struct {
	rdb     *redis.Client
	kwStore *keywords.Store
}

func NewConsumer(rdb *redis.Client, kwStore *keywords.Store) *Consumer {
	return &Consumer{rdb: rdb, kwStore: kwStore}
}

// Start inicia o polling em background.
// Cancela quando ctx for cancelado (shutdown do servidor).
func (c *Consumer) Start(ctx context.Context) {
	if !enabled() {
		slog.Info("kwsync: consumer desabilitado", "env", "KWSYNC_ENABLED")
		return
	}

	slog.Info("kwsync: consumer iniciado", "interval", pollInterval)

	go func() {
		ticker := time.NewTicker(pollInterval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				if err := c.process(ctx); err != nil {
					slog.Error("kwsync: erro ao processar fila", "error", err)
				}
			case <-ctx.Done():
				slog.Info("kwsync: consumer encerrado")
				return
			}
		}
	}()
}

func enabled() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("KWSYNC_ENABLED"))) {
	case "1", "true", "yes", "y", "on":
		return true
	default:
		return false
	}
}

// process drena a fila inteira e processa cada keyword.
func (c *Consumer) process(ctx context.Context) error {
	raws, err := c.rdb.LRange(ctx, pendingKey, 0, -1).Result()
	if err != nil {
		return fmt.Errorf("kwsync.process: LRange: %w", err)
	}
	if len(raws) == 0 {
		return nil
	}

	// Remove atomicamente antes de processar para evitar reprocessamento
	if err := c.rdb.Del(ctx, pendingKey).Err(); err != nil {
		return fmt.Errorf("kwsync.process: Del: %w", err)
	}

	existing, err := c.kwStore.Load(ctx)
	if err != nil {
		return fmt.Errorf("kwsync.process: load existing: %w", err)
	}

	existingSet := make(map[string]struct{}, len(existing))
	for _, kw := range existing {
		existingSet[strings.TrimSpace(strings.ToLower(kw))] = struct{}{}
	}

	var newKeywords []string

	for _, raw := range raws {
		var event KeywordEvent
		if err := json.Unmarshal([]byte(raw), &event); err != nil {
			slog.Warn("kwsync: payload inválido ignorado", "raw", raw, "error", err)
			continue
		}

		kw := strings.TrimSpace(event.Keyword)
		if kw == "" {
			continue
		}

		normalized := strings.ToLower(kw)
		if _, exists := existingSet[normalized]; exists {
			slog.Debug("kwsync: keyword já existe, ignorada", "keyword", kw)
			continue
		}

		newKeywords = append(newKeywords, kw)
		existingSet[normalized] = struct{}{}
		slog.Info("kwsync: nova keyword aceita", "keyword", kw, "source", event.Source)
	}

	if len(newKeywords) == 0 {
		return nil
	}

	all := append(existing, newKeywords...)

	if err := c.kwStore.Save(ctx, all); err != nil {
		return fmt.Errorf("kwsync.process: save to store: %w", err)
	}

	if err := appendToKeywordsJSON(newKeywords); err != nil {
		// Não fatal — Valkey já foi atualizado, JSON é o fallback
		slog.Error("kwsync: falha ao persistir no keywords.json", "error", err)
	}

	slog.Info("kwsync: keywords novas processadas",
		"new", len(newKeywords),
		"total", len(all),
	)

	return nil
}

type keywordsFile struct {
	Keywords []string `json:"KEYWORDS"`
}

// appendToKeywordsJSON adiciona keywords novas ao keywords.json em disco.
func appendToKeywordsJSON(newKeywords []string) error {
	paths := []string{
		"/app/internal/keywords/keywords.json",
		"./internal/keywords/keywords.json",
	}

	var filePath string
	var existing keywordsFile

	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		if err := json.Unmarshal(data, &existing); err != nil {
			return fmt.Errorf("kwsync: unmarshal keywords.json: %w", err)
		}
		filePath = p
		break
	}

	if filePath == "" {
		return fmt.Errorf("kwsync: keywords.json não encontrado")
	}

	existing.Keywords = append(existing.Keywords, newKeywords...)

	data, err := json.MarshalIndent(existing, "", "  ")
	if err != nil {
		return fmt.Errorf("kwsync: marshal keywords.json: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("kwsync: write keywords.json: %w", err)
	}

	return nil
}
