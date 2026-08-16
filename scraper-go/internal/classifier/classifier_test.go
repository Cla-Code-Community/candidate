package classifier

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
)

func TestClassifyFrontendComSinonimosEmPortuguesEIngles(t *testing.T) {
	cases := []domain.Job{
		{
			Title:       "Front-end Software Developer",
			Description: "React, Next.js e TypeScript",
		},
		{
			Title:       "Desenvolvedor Front-end",
			Description: "Produto web com React",
		},
	}

	for _, job := range cases {
		classification := Classify(job)

		assert.True(t, classification.InScope)
		assert.Equal(t, "frontend", classification.PrimaryFamily)
		assert.Contains(t, classification.Technologies, "react")
	}
}

func TestClassifyMobileComFamiliaRelacionadaFrontend(t *testing.T) {
	classification := Classify(domain.Job{
		Title:       "Senior Software Engineer - React Native",
		Description: "Mobile app com TypeScript",
	})

	assert.True(t, classification.InScope)
	assert.Equal(t, "mobile", classification.PrimaryFamily)
	assert.Contains(t, classification.RelatedFamilies, "frontend")
	assert.Contains(t, classification.Technologies, "react-native")
	assert.Equal(t, "senior", classification.Seniority)
}

func TestClassifyForaDoEscopo(t *testing.T) {
	classification := Classify(domain.Job{
		Title:       "Graphic Designer",
		Description: "Branding e campanhas visuais",
	})

	assert.False(t, classification.InScope)
	assert.Equal(t, "other", classification.PrimaryFamily)
}

func TestClassifyRejeitaBancoDeTalentosMesmoComCargoTecnico(t *testing.T) {
	classification := Classify(domain.Job{
		Title:       "[Banco de Talentos] Pessoa Desenvolvedora Frontend Junior",
		Description: "React, TypeScript e desenvolvimento web.",
	})

	assert.False(t, classification.InScope)
	assert.Equal(t, "other", classification.PrimaryFamily)
	assert.Contains(t, classification.Reasons[0], "vaga nao concreta")
}

func TestClassifyRejeitaCargoAdministrativoConhecido(t *testing.T) {
	cases := []domain.Job{
		{
			Title:       "Assistente Central de Reservas",
			Description: "Atendimento, relacionamento e processos administrativos.",
		},
		{
			Title:       "MOTORISTA DE VAN - AEROPORTO_FLORIANOPOLIS (SC)",
			Description: "Transporte de clientes e atendimento operacional.",
		},
		{
			Title:       "ANALISTA QUALIDADE III",
			Description: "Processos de qualidade operacional e auditoria.",
		},
		{
			Title: "Atendente",
		},
	}

	for _, job := range cases {
		classification := Classify(job)

		assert.False(t, classification.InScope)
		assert.Equal(t, "other", classification.PrimaryFamily)
		assert.Contains(t, classification.Reasons[0], "vaga administrativa")
	}
}

func TestJobSourceFallback(t *testing.T) {
	assert.Equal(t, "InHire", jobSource(domain.Job{Source: " InHire "}))
	assert.Equal(t, "Gupy", jobSource(domain.Job{Sources: []string{"", " Gupy "}}))
	assert.Equal(t, "unknown", jobSource(domain.Job{}))
}

func TestTopCountLabelsOrdenaPorContagemENome(t *testing.T) {
	labels := topCountLabels(map[string]int{
		"Analista":       3,
		"Designer":       1,
		"Comercial":      3,
		"Administrativo": 2,
	}, 3)

	assert.Equal(t, []string{
		"Analista=3",
		"Comercial=3",
		"Administrativo=2",
	}, labels)
}
