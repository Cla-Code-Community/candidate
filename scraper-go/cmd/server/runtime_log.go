package main

import "log/slog"

func slogScrapeStart(origin string, configured, requested, effective, keywords, adapters int) {
	attrs := []any{
		"origin", origin,
		"max_concurrency_configured", configured,
		"max_concurrency_effective", effective,
		"keywords", keywords,
		"adapters", adapters,
	}
	if requested != 0 {
		attrs = append(attrs, "max_concurrency_requested", requested)
	}
	slog.Info("scraper execução iniciada", attrs...)
}
