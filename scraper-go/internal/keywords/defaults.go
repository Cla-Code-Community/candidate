package keywords

import (
	"encoding/json"
	"log/slog"
	"os"
)

type keywordsFile struct {
	Keywords []string `json:"KEYWORDS"`
}

// LoadDefaultKeywords lê o keywords.json empacotado no binário.
// Tenta o path do Docker primeiro, depois o path local de desenvolvimento.
// Retorna slice vazio (nunca nil) se o arquivo não for encontrado.
func LoadDefaultKeywords() []string {
	paths := []string{
		"/app/internal/keywords/keywords.json",
		"./internal/keywords/keywords.json",
	}

	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}

		var parsed keywordsFile
		if err := json.Unmarshal(data, &parsed); err != nil {
			slog.Error("keywords: failed to parse keywords.json", "path", p, "error", err)
			return []string{}
		}

		normalized := GenerateSearchKeywords(parsed.Keywords)
		slog.Info("keywords: loaded from file", "path", p, "count", len(normalized))
		return normalized
	}

	slog.Warn("keywords: keywords.json not found in any path", "paths", paths)
	return []string{}
}
