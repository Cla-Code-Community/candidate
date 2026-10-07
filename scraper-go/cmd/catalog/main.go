// Explicit catalog operations. Reconcile is read-only unless --fix is supplied.
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/catalog"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/catalogops"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/config"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobindex"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/keywords"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/pipeline"
	"github.com/redis/go-redis/v9"
)

func main() {
	if err := run(); err != nil {
		slog.Error("catalog maintenance failed", "error", err)
		os.Exit(1)
	}
}
func run() error {
	operation := flag.String("operation", "reconcile", "reconcile, rebuild, backfill, reclassify, expire, deactivate, rollback, cleanup")
	fix := flag.Bool("fix", false, "explicitly repair reconciliation divergences by rebuilding")
	batch := flag.Int("batch-size", 200, "bounded batch size (1..2500)")
	version := flag.String("version", "", "inactive namespace to clean")
	ids := flag.String("ids", "", "comma-separated IDs to deactivate")
	flag.Parse()
	if *batch < 1 || *batch > 2500 {
		return fmt.Errorf("invalid batch size")
	}
	cfg, err := config.LoadRuntimeConfig()
	if err != nil {
		return err
	}
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()
	if strings.TrimSpace(os.Getenv("DATABASE_URL")) == "" {
		return fmt.Errorf("DATABASE_URL is required")
	}
	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	defer db.Close()
	db.SetMaxOpenConns(8)
	pingCtx, pingCancel := context.WithTimeout(ctx, 30*time.Second)
	err = db.PingContext(pingCtx)
	pingCancel()
	if err != nil {
		return err
	}
	opts, err := redis.ParseURL(os.Getenv("VALKEY_URL"))
	if err != nil {
		return err
	}
	rdb := redis.NewClient(opts)
	defer rdb.Close()
	store := catalog.New(db, cfg.CatalogLifetime)
	index := jobindex.New(rdb)
	configuredKeywords := keywords.LoadDefaultKeywords()
	if raw, e := rdb.Get(ctx, "scraper:keywords").Result(); e == nil {
		var configured []string
		if json.Unmarshal([]byte(raw), &configured) == nil {
			configuredKeywords = keywords.GenerateSearchKeywords(configured)
		}
	}
	ops := catalogops.Maintenance{Store: store, Index: index, BatchSize: *batch, Keywords: configuredKeywords}
	switch *operation {
	case "reclassify":
		n, e := ops.Reclassify(ctx)
		if e != nil {
			return e
		}
		fmt.Printf("reclassified=%d\n", n)
	case "expire":
		n, e := ops.Expire(ctx)
		if e != nil {
			return e
		}
		fmt.Printf("expired=%d\n", n)
	case "rebuild":
		v, e := ops.Rebuild(ctx)
		if e != nil {
			return e
		}
		fmt.Println(v)
	case "backfill":
		n, bad, e := ops.Backfill(ctx)
		if e != nil {
			return e
		}
		fmt.Printf("imported=%d invalid=%d\n", n, bad)
	case "reconcile":
		report, e := ops.Reconcile(ctx, *fix)
		if e != nil {
			return e
		}
		raw, _ := json.Marshal(report)
		fmt.Println(string(raw))
	case "rollback":
		return ops.Rollback(ctx, *version)
	case "cleanup":
		return ops.Cleanup(ctx, *version)
	case "deactivate":
		if *ids == "" {
			return fmt.Errorf("--ids is required")
		}
		release, e := store.ProcessingLease(ctx)
		if e != nil {
			return e
		}
		defer release()
		jobs, e := store.Deactivate(ctx, strings.Split(*ids, ","))
		if e != nil {
			return e
		}
		if _, e = index.Apply(ctx, jobs, func(j domain.Job) []string { return pipeline.IndexKeys(j, nil) }); e != nil {
			return e
		}
		return store.MarkIndexed(ctx, jobs)
	default:
		return fmt.Errorf("unknown operation")
	}
	return nil
}
