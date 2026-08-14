package main

import (
	"log/slog"
	"os"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
)

func loadEnv() {
	candidates := []string{
		os.Getenv("ENV_FILE"),
		"/app/.env",
		"../.env",
		".env",
	}
	for _, p := range candidates {
		if p == "" {
			continue
		}
		if err := godotenv.Load(p); err == nil {
			slog.Info("arquivo .env carregado", "path", p)
			return
		}
	}
	slog.Warn("arquivo .env não encontrado, usando variáveis do sistema")
}

// func resolveInterfacesPath(filename string) string {
// 	if v := os.Getenv("INTERFACES_DIR"); v != "" {
// 		return v + "/" + filename
// 	}
// 	candidates := []string{
// 		"internal/interfaces/" + filename,
// 		"../internal/interfaces/" + filename,
// 		"../../internal/interfaces/" + filename,
// 	}
// 	for _, c := range candidates {
// 		if _, err := os.Stat(c); err == nil {
// 			return c
// 		}
// 	}
// 	return "internal/interfaces/" + filename
// }

func buildAdapters(rdb *redis.Client) []ports.JobSource {
	return adapters.GetAdapters(rdb)
}
