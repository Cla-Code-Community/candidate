package keywords

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func readProductGenerator(t *testing.T) generatorData {
	t.Helper()
	raw, err := os.ReadFile("generator.json")
	require.NoError(t, err)
	var file generatorFile
	require.NoError(t, json.Unmarshal(raw, &file))
	var cfg generatorData
	for _, term := range file.Titles {
		cfg.titles = append(cfg.titles, titleTerm{name: term.Name, categories: term.Categories})
	}
	for _, term := range file.Technologies {
		cfg.technologies = append(cfg.technologies, technologyTerm{name: term.Name, categories: term.Categories})
	}
	return cfg
}

func TestProductKeywordsFileAndFallbackHaveSameDirectRoles(t *testing.T) {
	file := readProductGenerator(t)
	raw, err := os.ReadFile("keywords.json")
	require.NoError(t, err)
	var keywords keywordsFile
	require.NoError(t, json.Unmarshal(raw, &keywords))
	seeds := NormalizeKeywords(keywords.Keywords)
	require.Equal(t, len(keywords.Keywords), len(seeds), "seeds must already be normalized and unique")
	var direct []string
	for _, title := range file.titles {
		if categoriesOverlap(title.categories, []keywordCategory{categoryProduct, categoryProductDesign}) {
			direct = append(direct, title.name)
			assert.Contains(t, seeds, title.name)
		}
	}
	require.Len(t, direct, 35)
	var fallback []string
	for _, title := range defaultKeywordTitles {
		if categoriesOverlap(title.categories, []keywordCategory{categoryProduct, categoryProductDesign}) {
			fallback = append(fallback, title.name)
		}
	}
	assert.Equal(t, direct, fallback)
	assert.Contains(t, direct, "product operations analyst")
	assert.Contains(t, direct, "gerente de produto")
	assert.Contains(t, direct, "líder de produto")
	assert.Contains(t, direct, "product design manager")
	assert.Contains(t, direct, "designer de interação")
}

func TestProductKeywordsStayDirectWithToolsInSameCategory(t *testing.T) {
	file := readProductGenerator(t)
	fallback := generatorData{titles: defaultKeywordTitles, technologies: defaultKeywordTechnologies}
	for _, cfg := range []generatorData{file, fallback} {
		// Even explicit category overlap must never synthesize tool+role titles.
		cfg.technologies = append(append([]technologyTerm(nil), cfg.technologies...),
			technologyTerm{name: "jira", categories: []keywordCategory{categoryProduct}},
			technologyTerm{name: "figma", categories: []keywordCategory{categoryProduct, categoryProductDesign}},
			technologyTerm{name: "sql", categories: []keywordCategory{categoryProductDesign}})
		input := []string{" Product Manager ", "product owner", "UX Designer", "gerente de produto", "designer de produto", "Jira", "Figma", "SQL", "PRODUCT MANAGER"}
		got := generateSearchKeywords(input, cfg)
		assert.Equal(t, NormalizeKeywords(input), got)
		assert.NotContains(t, got, "jira product manager")
		assert.NotContains(t, got, "figma product owner")
		assert.NotContains(t, got, "sql ux designer")
		assert.Equal(t, got, generateSearchKeywords(got, cfg))
		assert.Equal(t, got, generateSearchKeywords(input, cfg))
	}
}

func TestProductKeywordsDoNotChangeTechnicalCombinationsOrLimit(t *testing.T) {
	for _, cfg := range []generatorData{readProductGenerator(t), {titles: defaultKeywordTitles, technologies: defaultKeywordTechnologies}} {
		technical := []string{"backend developer", "frontend developer", "go", "react"}
		before := generateSearchKeywords(technical, cfg)
		input := append(append([]string(nil), technical...), "product manager", "ux designer", "figma", "jira")
		got := generateSearchKeywords(input, cfg)
		assert.Equal(t, NormalizeKeywords(input), got[:len(input)])
		assert.Equal(t, before[len(technical):], got[len(input):])
		assert.Equal(t, got, generateSearchKeywords(input, cfg))
		assert.LessOrEqual(t, len(got), len(NormalizeKeywords(input))+maxGeneratedCombinations)
		assert.Equal(t, len(got), len(NormalizeKeywords(got)))
		for _, keyword := range got[len(input):] {
			assert.False(t, strings.Contains(keyword, "product"))
			assert.False(t, strings.Contains(keyword, "designer"))
		}
	}
}
