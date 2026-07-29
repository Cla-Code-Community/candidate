package jobstore

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/url"
	"strings"
	"time"
	"unicode"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/models"
	"github.com/redis/go-redis/v9"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

const (
	jobTTL       = 9 * 24 * time.Hour
	indexKey     = "scraper:jobs:index"
	jobKeyPrefix = "scraper:job:"
)

type Store struct {
	rdb *redis.Client
}

func New(rdb *redis.Client) *Store {
	return &Store{rdb: rdb}
}

// SaveBatch persiste vagas novas no Valkey, ignorando duplicatas.
// Retorna o número de vagas efetivamente novas salvas.
func (s *Store) SaveBatch(ctx context.Context, jobs []models.Job) (int, error) {
	if len(jobs) == 0 {
		return 0, nil
	}

	var saved int

	for _, job := range jobs {
		id := StableID(&job)
		if id == "" {
			slog.Warn("jobstore: vaga sem ID estável ignorada",
				"title", job.Title,
				"company", job.Company,
			)
			continue
		}

		exists, err := s.rdb.SIsMember(ctx, indexKey, id).Result()
		if err != nil {
			return saved, fmt.Errorf("jobstore.SaveBatch: SIsMember %q: %w", id, err)
		}
		if exists {
			continue
		}

		job.ID = id

		payload, err := json.Marshal(job)
		if err != nil {
			slog.Warn("jobstore: erro ao serializar vaga", "id", id, "error", err)
			continue
		}

		pipe := s.rdb.Pipeline()
		pipe.Set(ctx, jobKeyPrefix+id, payload, jobTTL)
		pipe.SAdd(ctx, indexKey, id)

		if _, err := pipe.Exec(ctx); err != nil {
			return saved, fmt.Errorf("jobstore.SaveBatch: pipeline exec %q: %w", id, err)
		}

		saved++
	}

	slog.Info("jobstore: vagas salvas",
		"new", saved,
		"skipped", len(jobs)-saved,
		"total_input", len(jobs),
	)

	return saved, nil
}

// GetAll retorna todas as vagas do índice.
func (s *Store) GetAll(ctx context.Context) ([]models.Job, error) {
	ids, err := s.rdb.SMembers(ctx, indexKey).Result()
	if err != nil {
		return nil, fmt.Errorf("jobstore.GetAll: SMembers: %w", err)
	}
	if len(ids) == 0 {
		return []models.Job{}, nil
	}

	jobs := make([]models.Job, 0, len(ids))

	for _, id := range ids {
		raw, err := s.rdb.Get(ctx, jobKeyPrefix+id).Result()
		if err == redis.Nil {
			s.rdb.SRem(ctx, indexKey, id)
			continue
		}
		if err != nil {
			slog.Warn("jobstore.GetAll: erro ao buscar vaga", "id", id, "error", err)
			continue
		}

		var job models.Job
		if err := json.Unmarshal([]byte(raw), &job); err != nil {
			slog.Warn("jobstore.GetAll: erro ao deserializar", "id", id, "error", err)
			continue
		}

		jobs = append(jobs, job)
	}

	return jobs, nil
}

// GetSample retorna uma amostra limitada de vagas do índice global.
// Também remove IDs órfãos encontrados durante a leitura.
func (s *Store) GetSample(ctx context.Context, limit int) ([]models.Job, error) {
	if limit <= 0 {
		return s.GetAll(ctx)
	}

	ids := make([]string, 0, limit)
	var cursor uint64

	for {
		batch, nextCursor, err := s.rdb.SScan(ctx, indexKey, cursor, "*", int64(limit)).Result()
		if err != nil {
			return nil, fmt.Errorf("jobstore.GetSample: SScan: %w", err)
		}

		remaining := limit - len(ids)
		if len(batch) > remaining {
			batch = batch[:remaining]
		}
		ids = append(ids, batch...)

		cursor = nextCursor
		if cursor == 0 || len(ids) >= limit {
			break
		}
	}

	if len(ids) == 0 {
		return []models.Job{}, nil
	}

	jobs := make([]models.Job, 0, len(ids))

	for _, id := range ids {
		raw, err := s.rdb.Get(ctx, jobKeyPrefix+id).Result()
		if err == redis.Nil {
			s.rdb.SRem(ctx, indexKey, id)
			continue
		}
		if err != nil {
			slog.Warn("jobstore.GetSample: erro ao buscar vaga", "id", id, "error", err)
			continue
		}

		var job models.Job
		if err := json.Unmarshal([]byte(raw), &job); err != nil {
			slog.Warn("jobstore.GetSample: erro ao deserializar", "id", id, "error", err)
			continue
		}

		jobs = append(jobs, job)
	}

	return jobs, nil
}

// Count retorna o total de vagas no índice.
func (s *Store) Count(ctx context.Context) (int64, error) {
	n, err := s.rdb.SCard(ctx, indexKey).Result()
	if err != nil {
		return 0, fmt.Errorf("jobstore.Count: %w", err)
	}
	return n, nil
}

// StableID deriva um ID determinístico via SHA-256 truncado de título+empresa+local.
// Exportado para o linkedin.go e outros adapters poderem setar job.ID corretamente.
func StableID(j *models.Job) string {
	title := normalizeForID(j.Title)
	company := normalizeForID(j.Company)
	location := normalizeForID(j.Location)

	var key string
	if title != "" && company != "" {
		loc := location
		if loc == "" {
			loc = "sem-local"
		}
		key = title + "|" + company + "|" + loc
	} else if u := normalizeURL(j.URL); u != "" {
		key = u
	} else {
		return ""
	}

	h := sha256.Sum256([]byte(key))
	return fmt.Sprintf("%x", h[:12]) // 24 chars hex
}

func normalizeForID(s string) string {
	t := transform.Chain(norm.NFD, transform.RemoveFunc(func(r rune) bool {
		return unicode.Is(unicode.Mn, r)
	}), norm.NFC)

	result, _, _ := transform.String(t, s)

	var b strings.Builder
	for _, r := range strings.ToLower(result) {
		if unicode.IsLetter(r) || unicode.IsNumber(r) {
			b.WriteRune(r)
		} else {
			b.WriteRune(' ')
		}
	}

	return strings.Join(strings.Fields(b.String()), " ")
}

func normalizeURL(raw string) string {
	if raw == "" {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil {
		return strings.TrimRight(raw, "/")
	}
	u.RawQuery = ""
	u.Fragment = ""
	return strings.TrimRight(u.String(), "/")
}
