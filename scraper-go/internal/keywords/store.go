package keywords

import (
	"context"
	"log/slog"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/cache"
)

// cacheKey é a chave fixa no Valkey para as keywords do scraper.
// Namespace "scraper:" é aplicado internamente pelo cache.Cache.
const cacheKey = "keywords"

type Store struct {
	cache cache.Cache
}

func NewStore(c cache.Cache) *Store {
	return &Store{cache: c}
}

// Load retorna as keywords do Valkey. Se a chave não existir ou ocorrer
// qualquer erro, retorna o fallback do keywords.json sem propagar o erro —
// o scraper nunca deve parar por falha de cache.
func (s *Store) Load(ctx context.Context) ([]string, error) {
	fallback := LoadDefaultKeywords()

	raw, found, err := cache.GetAs[[]string](s.cache, ctx, cacheKey)
	if err != nil {
		slog.Warn("keywords.Store.Load: cache read failed, using defaults", "error", err)
		return fallback, nil
	}
	if !found {
		return fallback, nil
	}

	return GenerateSearchKeywords(raw), nil
}

// Save persiste as keywords no Valkey sem expiração (TTL=0).
// Keywords são configuração, não cache — não devem expirar automaticamente.
func (s *Store) Save(ctx context.Context, keywords []string) error {
	normalized := GenerateSearchKeywords(keywords)

	if err := s.cache.Set(ctx, cacheKey, normalized, 0); err != nil {
		return err
	}

	slog.Info("keywords.Store.Save: keywords saved", "count", len(normalized))
	return nil
}
