package adapters

import (
	"context"
	"log/slog"
	"os"
	"strings"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/adzuna"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/greenhouse"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/gupy"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/inhire"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/jooble"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/lever"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/linkedin"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/adapters/themuse"
	"github.com/redis/go-redis/v9"
)

func GetAdapters(rdb *redis.Client) []Adapter {
	var list []Adapter

	list = append(list, linkedin.NewLinkedIn())

	if appID, appKey := os.Getenv("ADZUNA_APP_ID"), os.Getenv("ADZUNA_APP_KEY"); appID != "" && appKey != "" {
		list = append(list, adzuna.NewAdzuna(appID, appKey, "br"))
	} else {
		slog.Warn("ADZUNA_APP_ID ou ADZUNA_APP_KEY não configurados, adapter ignorado")
	}

	list = append(list, themuse.NewTheMuse())

	if strings.EqualFold(os.Getenv("GUPY_ENABLED"), "true") {
		list = append(list, gupy.NewGupy())
		slog.Info("Gupy habilitado")
	}

	if strings.EqualFold(os.Getenv("INHIRE_ENABLED"), "true") {
		list = append(list, inhire.NewInHire())
		slog.Info("InHire habilitado")
	}

	if apiKey := os.Getenv("JOOBLE_API_KEY"); apiKey != "" {
		list = append(list, jooble.NewJooble(apiKey, rdb))
	} else {
		slog.Warn("JOOBLE_API_KEY não configurada, adapter ignorado")
	}

	if strings.EqualFold(os.Getenv("GREENHOUSE_ENABLED"), "true") {
		greenhouseAdapters, err := greenhouse.BuildGreenhouseAdapters(context.Background())
		if err != nil {
			slog.Warn("Greenhouse ignorado: falha ao carregar empresas", "error", err)
		} else {
			list = append(list, greenhouseAdapters...)
			slog.Info("Greenhouse habilitado", "adapters", len(greenhouseAdapters))
		}
	}

	if strings.EqualFold(os.Getenv("LEVER_ENABLED"), "true") {
		leverAdapters, err := lever.BuildLeverAdapters(context.Background())
		if err != nil {
			slog.Warn("Lever ignorado: falha ao carregar empresas", "error", err)
		} else {
			list = append(list, leverAdapters...)
			slog.Info("Lever habilitado", "adapters", len(leverAdapters))
		}
	}

	return list
}
