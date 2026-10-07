package metrics

import (
	"strings"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/taxonomy"
)

// Collapse free-text explanations into stable operational codes. Classification
// remains unchanged; title text is only kept in the bounded admin aggregate.
func Classification(job domain.Job, c domain.Classification, started time.Time) {
	family := c.PrimaryFamily
	if !taxonomy.IsPublic(family) && family != "other" {
		family = "other"
	}
	result := "approved"
	reason := "insufficient_title_evidence"
	if !c.InScope {
		result = "rejected"
		for _, r := range c.Reasons {
			s := strings.ToLower(r)
			if strings.Contains(s, "nenhuma familia") {
				reason = "no_family_recognized"
				result = "other"
				break
			}
			if strings.Contains(s, "administrativ") || strings.Contains(s, "negativ") || strings.Contains(s, "nao tecnic") || strings.Contains(s, "producao") || strings.Contains(s, "operacion") {
				reason = "negative_title"
			}
		}
	}
	ClassificationJobs.WithLabelValues(result, family).Inc()
	ClassificationDuration.WithLabelValues(result).Observe(time.Since(started).Seconds())
	if !c.InScope {
		ClassificationRejections.WithLabelValues(family, reason).Inc()
		RejectTitle(job.Title, reason)
		JobResult(job.Source, "rejected", 1)
	} else {
		JobResult(job.Source, "approved", 1)
	}
}
func InvalidJob(provider string) {
	ClassificationJobs.WithLabelValues("invalid", "other").Inc()
	ClassificationRejections.WithLabelValues("other", "missing_required_field").Inc()
	JobResult(provider, "invalid", 1)
}
