package main

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/cronjob"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
)

// handleTriggerScrape dispara o scraper manualmente via POST /admin/scrape
// retorna 409 se já houver uma execução em andamento.
func handleTriggerScrape(scheduler *cronjob.Scheduler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := scheduler.RunNow(r.Context()); err != nil {
			if err == cronjob.ErrAlreadyRunning {
				w.WriteHeader(http.StatusConflict)
				json.NewEncoder(w).Encode(map[string]any{
					"ok":      false,
					"message": "scraper já está em execução",
				})
				return
			}
			http.Error(w, "erro ao iniciar scraper", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"ok":      true,
			"message": "scraper iniciado em background",
		})
	}
}

// handleScraperStatus retorna o estado atual do scheduler via GET /admin/scrape/status
func handleScraperStatus(scheduler *cronjob.Scheduler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"running": scheduler.IsRunning(),
		})
	}
}

// handleGetJobs retorna todas as vagas do Valkey via GET /admin/jobs
// Para o frontend, o Node.js lê direto do Valkey — esse endpoint é para uso administrativo.
func handleGetJobs(js *jobstore.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

		jobs, err := js.GetSample(r.Context(), limit)
		if err != nil {
			http.Error(w, "erro ao buscar vagas", http.StatusInternalServerError)
			return
		}

		total := len(jobs)
		if limit > 0 {
			if count, countErr := js.Count(r.Context()); countErr == nil {
				total = int(count)
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"jobs":  jobs,
			"total": total,
		})
	}
}

// handleJobsCount retorna o total de vagas no índice via GET /admin/jobs/count
func handleJobsCount(js *jobstore.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		count, err := js.Count(r.Context())
		if err != nil {
			http.Error(w, "erro ao contar vagas", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"total": count,
		})
	}
}
