package classifier

import (
	"strings"
	"testing"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClassifyProductTitles(t *testing.T) {
	titles := []string{
		"Product Manager", "Senior Product Manager", "Product Owner", "Technical Product Manager",
		"Associate Product Manager", "Growth Product Manager", "Product Analyst", "Product Operations Analyst",
		"Product Operations", "Product Lead", "Head of Product", "Platform Product Manager",
		"Data Product Manager", "AI Product Manager", "Gerente de Produto", "Analista de Produto",
		"Especialista de Produto", "Líder de Produto", "Operações de Produto", "Diretor de Produto",
	}
	for _, title := range titles {
		t.Run(title, func(t *testing.T) {
			// A technical description must not override a recognized product title.
			job := domain.Job{Title: title, Description: "APIs microservices backend java SQL React mobile data engineer DevOps"}
			got := Classify(job)
			assert.Equal(t, "product", got.PrimaryFamily)
			assert.True(t, got.InScope)
			require.NotEmpty(t, got.Reasons)
			assert.True(t, strings.HasPrefix(got.Reasons[0], "titulo: "))
			assert.NotContains(t, got.Reasons[0], job.Description)
			assert.Equal(t, title, job.Title)
			assert.Equal(t, got, Classify(job))
		})
	}
}

func TestClassifyProductDesignTitlesAndPrecedence(t *testing.T) {
	titles := []string{
		"Product Designer", "Lead Product Designer", "Product Design Manager", "UX Designer", "UI Designer",
		"UX/UI Designer", "UX Researcher", "UX Writer", "Content Designer", "Service Designer",
		"Interaction Designer", "Design System Designer", "Designer de Produto", "Pesquisadora UX",
		"Designer de Interação", "Product Designer / Product Manager", "Lead Product Designer (Product Owner)",
		"Product Owner / UX Writer",
	}
	for _, title := range titles {
		t.Run(title, func(t *testing.T) {
			job := domain.Job{Title: title, Description: "Product Manager product strategy Jira SQL python APIs backend"}
			got := Classify(job)
			assert.Equal(t, "product_design", got.PrimaryFamily)
			assert.True(t, got.InScope)
			assert.True(t, strings.HasPrefix(got.Reasons[0], "titulo: "))
			assert.Equal(t, title, job.Title)
			assert.Equal(t, got, Classify(job))
		})
	}
}

func TestProductNormalizationAndWordBoundaries(t *testing.T) {
	cases := []struct{ title, family string }{
		{"  sENIOR   PRODUCT-MANAGER (Remote) ", "product"},
		{"PRODUCT / OWNER", "product"},
		{"Gerente (de) Produto", "product"},
		{"LÍDER—DE—PRODUTO", "product"},
		{"OPERAÇÕES / DE / PRODUTO", "product"},
		{"UX/UI-DESIGNER", "product_design"},
		{"UI / UX Designer", "product_design"},
		{"Designer (de) Interação!", "product_design"},
		{"Product Managerial Assistant", "other"},
		{"Nonproduct Manager", "other"},
		{"Product Designership", "other"},
		{"Production Manager", "other"},
	}
	for _, tc := range cases {
		t.Run(tc.title, func(t *testing.T) {
			got := Classify(domain.Job{Title: tc.title})
			assert.Equal(t, tc.family, got.PrimaryFamily)
			assert.Equal(t, tc.family != "other", got.InScope)
		})
	}
}

func TestProductFalsePositivesKeepExistingTechnicalFamilies(t *testing.T) {
	cases := []struct{ title, family string }{
		{"Production Manager", "other"}, {"Production Engineer", "other"}, {"Gerente de Produção", "other"},
		{"Product Marketing Manager", "other"}, {"Product Sales Manager", "other"},
		{"Product Support Engineer", "other"}, {"Product Engineer", "other"},
		{"Product Security Engineer", "security"}, {"Product Data Engineer", "data"},
		{"Backend Engineer, Product Platform", "backend"}, {"Software Engineer - Product", "software"},
	}
	for _, tc := range cases {
		t.Run(tc.title, func(t *testing.T) {
			got := Classify(domain.Job{Title: tc.title, Description: "Product Manager Product Designer roadmap discovery Figma Jira"})
			assert.Equal(t, tc.family, got.PrimaryFamily)
			assert.NotEqual(t, "product", got.PrimaryFamily)
			assert.NotEqual(t, "product_design", got.PrimaryFamily)
			require.Greater(t, len(got.Reasons), 1)
			assert.Contains(t, strings.Join(got.Reasons, "; "), "exclusao product:")
		})
	}
}

func TestProductDesignFalsePositives(t *testing.T) {
	titles := []string{
		"Graphic Designer", "Motion Designer", "Fashion Designer", "Industrial Designer", "Interior Designer",
		"Marketing Designer", "Designer Gráfico", "Designer de Moda", "Graphic Designer / Product Designer",
	}
	for _, title := range titles {
		t.Run(title, func(t *testing.T) {
			got := Classify(domain.Job{Title: title, Description: "Product Designer UX Designer UX Researcher Figma Sketch prototyping"})
			assert.Equal(t, "other", got.PrimaryFamily)
			assert.False(t, got.InScope)
			assert.Contains(t, strings.Join(got.Reasons, "; "), "exclusao product_design:")
		})
	}
}

func TestProductDescriptionAndToolsCannotDefineFamily(t *testing.T) {
	for _, title := range []string{"", "Consultant", "Analista", "Designer"} {
		got := Classify(domain.Job{Title: title, Description: "Product Manager Product Designer UX Designer roadmap discovery Figma Jira"})
		assert.Equal(t, "other", got.PrimaryFamily, title)
		assert.False(t, got.InScope, title)
	}
	for _, title := range []string{"Product", "Produto", "Design", "Jira", "Figma", "SQL"} {
		got := Classify(domain.Job{Title: title, Description: "Jira Figma SQL Sketch Amplitude Mixpanel"})
		assert.NotEqual(t, "product", got.PrimaryFamily, title)
		assert.NotEqual(t, "product_design", got.PrimaryFamily, title)
		assert.False(t, got.InScope, title)
	}
	for _, tc := range []struct{ title, tools, family string }{
		{"Product Manager", "Jira SQL Amplitude", "product"},
		{"UX Designer", "Figma Sketch Adobe XD", "product_design"},
	} {
		plain := Classify(domain.Job{Title: tc.title})
		supported := Classify(domain.Job{Title: tc.title, Description: tc.tools})
		assert.Equal(t, tc.family, plain.PrimaryFamily)
		assert.Equal(t, plain.PrimaryFamily, supported.PrimaryFamily)
		assert.Greater(t, supported.Confidence, plain.Confidence)
		assert.Equal(t, plain.Reasons, supported.Reasons)
	}
}

func TestExistingFamiliesIgnoreProductContext(t *testing.T) {
	cases := []struct{ title, family string }{
		{"Backend Engineer", "backend"}, {"Frontend Engineer", "frontend"}, {"Mobile Engineer", "mobile"},
		{"Fullstack Developer", "fullstack"}, {"Platform Engineer", "platform"}, {"DevOps Engineer", "devops"},
		{"Data Engineer", "data"}, {"Data Analyst - Product Strategy", "data"},
		{"QA Engineer", "qa"}, {"Security Engineer", "security"},
		{"Engineering Manager", "leadership"}, {"Software Engineer", "software"},
	}
	for _, tc := range cases {
		t.Run(tc.family, func(t *testing.T) {
			plain := Classify(domain.Job{Title: tc.title})
			context := Classify(domain.Job{Title: tc.title, Description: "Work with the Product Manager on product discovery and product strategy."})
			assert.Equal(t, tc.family, context.PrimaryFamily)
			assert.Equal(t, plain.Confidence, context.Confidence)
			assert.Equal(t, plain.RelatedFamilies, context.RelatedFamilies)
			assert.Equal(t, plain.InScope, context.InScope)
		})
	}
}

func TestProductFallbackAndOpeningBlocks(t *testing.T) {
	for _, title := range []string{"", "Unknown Role", "Designer", "Product"} {
		got := Classify(domain.Job{Title: title})
		assert.Equal(t, "other", got.PrimaryFamily)
		assert.False(t, got.InScope)
		assert.Equal(t, []string{"nenhuma familia reconhecida"}, got.Reasons)
	}
	for _, title := range []string{"Banco de Talentos - Product Manager", "Talent Pool - Product Designer"} {
		got := Classify(domain.Job{Title: title})
		assert.Equal(t, "other", got.PrimaryFamily)
		assert.False(t, got.InScope)
		assert.Contains(t, got.Reasons[0], "vaga nao concreta")
	}
}

func TestProductBatchKeepsTitlesAndMatchesIndividualOutput(t *testing.T) {
	jobs := []domain.Job{{Title: "Product Manager"}, {Title: "Designer de Interação"}, {Title: "Graphic Designer"}}
	got := ClassifyJobs(jobs)
	require.Len(t, got, 2)
	for i := range got {
		assert.Equal(t, jobs[i].Title, got[i].Title)
		assert.Equal(t, Classify(jobs[i]), *got[i].Classification)
	}
}
