package pipeline

import (
	"context"
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/classifier"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/keywords"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/ports"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type productBatchAdapter struct {
	schedulerTestAdapter
	calls    int
	keywords []string
}

func (a *productBatchAdapter) SearchBatch(_ context.Context, keywords []string, _ domain.ScrapeRequest) ([]domain.Job, error) {
	a.calls++
	a.keywords = append([]string(nil), keywords...)
	return nil, nil
}

func TestProductKeywordsRespectDiscoveryModes(t *testing.T) {
	seed := keywords.GenerateSearchKeywords([]string{"product manager", "ux designer", "gerente de produto", "figma"})
	catalog := &schedulerCatalogAdapter{schedulerTestAdapter: schedulerTestAdapter{provider: ports.ProviderGreenhouse, mode: ports.DiscoveryCatalog}}
	batch := &productBatchAdapter{schedulerTestAdapter: schedulerTestAdapter{provider: ports.ProviderLinkedIn, mode: ports.DiscoveryBatch}}
	adapters := []ports.JobSource{catalog, batch, schedulerTestAdapter{provider: ports.ProviderAdzuna}}
	queue := make(chan adapterTask, len(seed)+2)
	produceTasks(context.Background(), queue, adapters, seed, newProviderRunStats(adapters, nil))
	counts := map[ports.DiscoveryMode]int{}
	var keywordOrder []string
	for task := range queue {
		counts[task.mode]++
		if task.mode == ports.DiscoveryKeyword {
			keywordOrder = append(keywordOrder, task.keywords[0])
		} else {
			assert.Equal(t, seed, task.keywords)
		}
	}
	assert.Equal(t, map[ports.DiscoveryMode]int{ports.DiscoveryCatalog: 1, ports.DiscoveryBatch: 1, ports.DiscoveryKeyword: len(seed)}, counts)
	assert.Equal(t, seed, keywordOrder)
	_, err := Run(context.Background(), adapters, domain.ScrapeRequest{Keywords: seed, MaxConcurrency: 1})
	require.NoError(t, err)
	assert.Equal(t, 1, catalog.calls)
	assert.Equal(t, 1, batch.calls)
	assert.Equal(t, seed, catalog.keywords)
	assert.Equal(t, seed, batch.keywords)
}

func TestProductClassificationDoesNotCreateFamilyIndexes(t *testing.T) {
	for _, title := range []string{"Product Manager", "Product Designer"} {
		job := domain.Job{Title: title, Description: "SQL"}
		classification := classifier.Classify(job)
		require.True(t, classification.InScope)
		job.Classification = &classification
		keys := classificationIndexKeys(job)
		assert.NotContains(t, keys, "scraper:jobs:family:product")
		assert.NotContains(t, keys, "scraper:jobs:family:product_design")
		assert.NotContains(t, keys, "scraper:jobs:keyword:product")
		assert.NotContains(t, keys, "scraper:jobs:keyword:product design")
		assert.Contains(t, invertedIndexKeys(job, []string{title}), "scraper:jobs:keyword:"+normalizeIndexValue(title))
	}
	job := domain.Job{Classification: &domain.Classification{PrimaryFamily: "backend", RelatedFamilies: []string{"product", "product_design"}, InScope: true}}
	assert.Contains(t, classificationIndexKeys(job), "scraper:jobs:family:backend")
	assert.NotContains(t, classificationIndexKeys(job), "scraper:jobs:family:product")
}
