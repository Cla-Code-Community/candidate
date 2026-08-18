package keywords

import (
	"encoding/json"
	"log/slog"
	"os"
	"sync"
)

const maxGeneratedCombinations = 200

type keywordCategory string

const (
	categoryBackend     keywordCategory = "backend"
	categoryFrontend    keywordCategory = "frontend"
	categoryFullstack   keywordCategory = "fullstack"
	categoryMobile      keywordCategory = "mobile"
	categoryData        keywordCategory = "data"
	categoryDevOps      keywordCategory = "devops"
	categoryPlatform    keywordCategory = "platform"
	categoryQA          keywordCategory = "qa"
	categorySecurity    keywordCategory = "security"
	categoryCRM         keywordCategory = "crm"
	categoryERP         keywordCategory = "erp"
	categoryIntegration keywordCategory = "integration"
	categoryBlockchain  keywordCategory = "blockchain"
	categoryEmbedded    keywordCategory = "embedded"
	categoryGame        keywordCategory = "game"
)

type titleTerm struct {
	name       string
	categories []keywordCategory
}

type technologyTerm struct {
	name       string
	categories []keywordCategory
}

type generatorFile struct {
	Titles       []generatorTerm `json:"titles"`
	Technologies []generatorTerm `json:"technologies"`
}

type generatorTerm struct {
	Name       string            `json:"name"`
	Categories []keywordCategory `json:"categories"`
}

type generatorData struct {
	titles       []titleTerm
	technologies []technologyTerm
}

var (
	generatorOnce   sync.Once
	generatorConfig generatorData
)

var defaultKeywordTitles = []titleTerm{
	{name: "backend developer", categories: []keywordCategory{categoryBackend}},
	{name: "backend engineer", categories: []keywordCategory{categoryBackend}},
	{name: "frontend developer", categories: []keywordCategory{categoryFrontend}},
	{name: "frontend engineer", categories: []keywordCategory{categoryFrontend}},
	{name: "full stack developer", categories: []keywordCategory{categoryFullstack, categoryBackend, categoryFrontend}},
	{name: "full stack engineer", categories: []keywordCategory{categoryFullstack, categoryBackend, categoryFrontend}},
	{name: "fullstack developer", categories: []keywordCategory{categoryFullstack, categoryBackend, categoryFrontend}},
	{name: "fullstack engineer", categories: []keywordCategory{categoryFullstack, categoryBackend, categoryFrontend}},
	{name: "software engineer", categories: []keywordCategory{categoryBackend, categoryFrontend, categoryFullstack, categoryMobile}},
	{name: "software developer", categories: []keywordCategory{categoryBackend, categoryFrontend, categoryFullstack, categoryMobile}},
	{name: "mobile developer", categories: []keywordCategory{categoryMobile}},
	{name: "mobile engineer", categories: []keywordCategory{categoryMobile}},
	{name: "data engineer", categories: []keywordCategory{categoryData}},
	{name: "data analyst", categories: []keywordCategory{categoryData}},
	{name: "data scientist", categories: []keywordCategory{categoryData}},
	{name: "machine learning engineer", categories: []keywordCategory{categoryData}},
	{name: "devops engineer", categories: []keywordCategory{categoryDevOps, categoryPlatform}},
	{name: "cloud engineer", categories: []keywordCategory{categoryDevOps, categoryPlatform}},
	{name: "platform engineer", categories: []keywordCategory{categoryPlatform, categoryDevOps}},
	{name: "infrastructure engineer", categories: []keywordCategory{categoryDevOps, categoryPlatform}},
	{name: "qa engineer", categories: []keywordCategory{categoryQA}},
	{name: "qa analyst", categories: []keywordCategory{categoryQA}},
	{name: "automation engineer", categories: []keywordCategory{categoryQA}},
	{name: "security engineer", categories: []keywordCategory{categorySecurity}},
	{name: "application security engineer", categories: []keywordCategory{categorySecurity, categoryBackend}},
	{name: "salesforce developer", categories: []keywordCategory{categoryCRM}},
	{name: "salesforce engineer", categories: []keywordCategory{categoryCRM}},
	{name: "salesforce architect", categories: []keywordCategory{categoryCRM}},
	{name: "sap consultant", categories: []keywordCategory{categoryERP}},
	{name: "sap developer", categories: []keywordCategory{categoryERP}},
	{name: "integration developer", categories: []keywordCategory{categoryIntegration, categoryBackend}},
	{name: "integration engineer", categories: []keywordCategory{categoryIntegration, categoryBackend}},
	{name: "blockchain developer", categories: []keywordCategory{categoryBlockchain}},
	{name: "embedded engineer", categories: []keywordCategory{categoryEmbedded}},
	{name: "firmware engineer", categories: []keywordCategory{categoryEmbedded}},
	{name: "game developer", categories: []keywordCategory{categoryGame}},
}

var defaultKeywordTechnologies = []technologyTerm{
	{name: "react", categories: []keywordCategory{categoryFrontend, categoryFullstack}},
	{name: "next.js", categories: []keywordCategory{categoryFrontend, categoryFullstack}},
	{name: "vue", categories: []keywordCategory{categoryFrontend, categoryFullstack}},
	{name: "angular", categories: []keywordCategory{categoryFrontend, categoryFullstack}},
	{name: "javascript", categories: []keywordCategory{categoryFrontend, categoryBackend, categoryFullstack}},
	{name: "typescript", categories: []keywordCategory{categoryFrontend, categoryBackend, categoryFullstack}},
	{name: "node.js", categories: []keywordCategory{categoryBackend, categoryFullstack}},
	{name: "nestjs", categories: []keywordCategory{categoryBackend, categoryFullstack}},
	{name: "java", categories: []keywordCategory{categoryBackend}},
	{name: "spring boot", categories: []keywordCategory{categoryBackend}},
	{name: "python", categories: []keywordCategory{categoryBackend, categoryData, categoryQA}},
	{name: "django", categories: []keywordCategory{categoryBackend}},
	{name: "flask", categories: []keywordCategory{categoryBackend}},
	{name: "go", categories: []keywordCategory{categoryBackend}},
	{name: "golang", categories: []keywordCategory{categoryBackend}},
	{name: "php", categories: []keywordCategory{categoryBackend}},
	{name: "laravel", categories: []keywordCategory{categoryBackend}},
	{name: "ruby on rails", categories: []keywordCategory{categoryBackend}},
	{name: ".net", categories: []keywordCategory{categoryBackend}},
	{name: "c#", categories: []keywordCategory{categoryBackend}},
	{name: "react native", categories: []keywordCategory{categoryMobile}},
	{name: "flutter", categories: []keywordCategory{categoryMobile}},
	{name: "android", categories: []keywordCategory{categoryMobile}},
	{name: "ios", categories: []keywordCategory{categoryMobile}},
	{name: "kotlin", categories: []keywordCategory{categoryMobile}},
	{name: "swift", categories: []keywordCategory{categoryMobile}},
	{name: "docker", categories: []keywordCategory{categoryDevOps, categoryPlatform, categoryBackend}},
	{name: "kubernetes", categories: []keywordCategory{categoryDevOps, categoryPlatform}},
	{name: "terraform", categories: []keywordCategory{categoryDevOps, categoryPlatform}},
	{name: "ansible", categories: []keywordCategory{categoryDevOps, categoryPlatform}},
	{name: "aws", categories: []keywordCategory{categoryDevOps, categoryPlatform, categoryBackend, categoryData}},
	{name: "azure", categories: []keywordCategory{categoryDevOps, categoryPlatform, categoryBackend, categoryData}},
	{name: "gcp", categories: []keywordCategory{categoryDevOps, categoryPlatform, categoryBackend, categoryData}},
	{name: "postgresql", categories: []keywordCategory{categoryBackend, categoryData}},
	{name: "mysql", categories: []keywordCategory{categoryBackend, categoryData}},
	{name: "mongodb", categories: []keywordCategory{categoryBackend, categoryData}},
	{name: "redis", categories: []keywordCategory{categoryBackend}},
	{name: "kafka", categories: []keywordCategory{categoryBackend, categoryData, categoryIntegration}},
	{name: "rabbitmq", categories: []keywordCategory{categoryBackend, categoryIntegration}},
	{name: "graphql", categories: []keywordCategory{categoryFrontend, categoryBackend, categoryFullstack}},
	{name: "selenium", categories: []keywordCategory{categoryQA}},
	{name: "cypress", categories: []keywordCategory{categoryQA}},
	{name: "playwright", categories: []keywordCategory{categoryQA}},
	{name: "salesforce", categories: []keywordCategory{categoryCRM}},
	{name: "apex", categories: []keywordCategory{categoryCRM}},
	{name: "lwc", categories: []keywordCategory{categoryCRM}},
	{name: "mulesoft", categories: []keywordCategory{categoryIntegration, categoryCRM}},
	{name: "sap abap", categories: []keywordCategory{categoryERP}},
	{name: "sap hana", categories: []keywordCategory{categoryERP}},
	{name: "sap fiori", categories: []keywordCategory{categoryERP, categoryFrontend}},
	{name: "oracle", categories: []keywordCategory{categoryBackend, categoryERP}},
	{name: "power platform", categories: []keywordCategory{categoryCRM}},
	{name: "solidity", categories: []keywordCategory{categoryBlockchain}},
	{name: "web3", categories: []keywordCategory{categoryBlockchain}},
	{name: "unity", categories: []keywordCategory{categoryGame}},
	{name: "unreal engine", categories: []keywordCategory{categoryGame}},
}

func GenerateSearchKeywords(raw []string) []string {
	base := NormalizeKeywords(raw)
	result := make([]string, 0, len(base)+maxGeneratedCombinations)
	seen := make(map[string]struct{}, len(base)+maxGeneratedCombinations)

	for _, keyword := range base {
		addKeyword(&result, seen, keyword)
	}

	cfg := loadGeneratorConfig()
	titles := matchingTitles(base, cfg.titles)
	technologies := matchingTechnologies(base, cfg.technologies)
	evaluatedCombinations := 0

	for _, title := range titles {
		for _, tech := range technologies {
			if !categoriesOverlap(title.categories, tech.categories) {
				continue
			}
			if evaluatedCombinations >= maxGeneratedCombinations {
				return result
			}
			evaluatedCombinations++
			addKeyword(&result, seen, tech.name+" "+title.name)
		}
	}

	return result
}

func loadGeneratorConfig() generatorData {
	generatorOnce.Do(func() {
		generatorConfig = generatorData{
			titles:       defaultKeywordTitles,
			technologies: defaultKeywordTechnologies,
		}

		paths := []string{
			"/app/internal/keywords/generator.json",
			"./internal/keywords/generator.json",
		}

		for _, p := range paths {
			data, err := os.ReadFile(p)
			if err != nil {
				continue
			}

			var parsed generatorFile
			if err := json.Unmarshal(data, &parsed); err != nil {
				slog.Error("keywords: failed to parse generator.json", "path", p, "error", err)
				return
			}

			titles := make([]titleTerm, 0, len(parsed.Titles))
			for _, term := range parsed.Titles {
				if term.Name == "" || len(term.Categories) == 0 {
					continue
				}
				titles = append(titles, titleTerm{name: term.Name, categories: term.Categories})
			}

			technologies := make([]technologyTerm, 0, len(parsed.Technologies))
			for _, term := range parsed.Technologies {
				if term.Name == "" || len(term.Categories) == 0 {
					continue
				}
				technologies = append(technologies, technologyTerm{name: term.Name, categories: term.Categories})
			}

			if len(titles) == 0 || len(technologies) == 0 {
				slog.Warn("keywords: generator.json vazio, usando fallback interno", "path", p)
				return
			}

			generatorConfig = generatorData{titles: titles, technologies: technologies}
			slog.Info("keywords: generator loaded from file", "path", p, "titles", len(titles), "technologies", len(technologies))
			return
		}
	})

	return generatorConfig
}

func matchingTitles(seed []string, titles []titleTerm) []titleTerm {
	found := make([]titleTerm, 0, len(titles))
	for _, title := range titles {
		for _, keyword := range seed {
			if keyword == title.name {
				found = append(found, title)
				break
			}
		}
	}
	return found
}

func matchingTechnologies(seed []string, technologies []technologyTerm) []technologyTerm {
	found := make([]technologyTerm, 0, len(technologies))
	seen := make(map[string]struct{}, len(technologies))

	for _, tech := range technologies {
		for _, keyword := range seed {
			if keywordContainsTerm(keyword, tech.name) {
				if _, exists := seen[tech.name]; !exists {
					found = append(found, tech)
					seen[tech.name] = struct{}{}
				}
				break
			}
		}
	}

	return found
}

func keywordContainsTerm(keyword string, term string) bool {
	return keyword == term ||
		keyword == term+" developer" ||
		keyword == term+" engineer" ||
		keyword == term+" analyst" ||
		keyword == term+" consultant" ||
		keyword == term+" architect"
}

func categoriesOverlap(left []keywordCategory, right []keywordCategory) bool {
	for _, l := range left {
		for _, r := range right {
			if l == r {
				return true
			}
		}
	}
	return false
}

func addKeyword(result *[]string, seen map[string]struct{}, keyword string) bool {
	if keyword == "" {
		return false
	}
	if _, exists := seen[keyword]; exists {
		return false
	}
	seen[keyword] = struct{}{}
	*result = append(*result, keyword)
	return true
}
