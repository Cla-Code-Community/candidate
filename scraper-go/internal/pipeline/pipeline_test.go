package pipeline_test

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/models"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/pipeline"
)

func newTestRedis(t *testing.T) (*redis.Client, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)

	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { rdb.Close() })

	return rdb, mr
}

// TestIndexJobsInValkey_SemJanelaVazia é o teste central do RENAME atômico.
// Garante que durante a reindexação nunca há um momento em que a chave
// de keyword existe mas está vazia — o que causava resultados vazios na API.
func TestIndexJobsInValkey_SemJanelaVazia(t *testing.T) {
	rdb, _ := newTestRedis(t)
	ctx := context.Background()

	jobs := []models.Job{
		{Title: "Engenheiro Go", Company: "Acme", Location: "Brasil", Description: "vaga de go golang"},
	}
	keywords := []string{"go", "golang"}

	// Primeira indexação
	pipeline.IndexJobsInValkey(ctx, rdb, jobs, keywords)

	// Chave final deve existir com membros
	members, err := rdb.SMembers(ctx, "scraper:jobs:keyword:go").Result()
	require.NoError(t, err)
	assert.NotEmpty(t, members, "índice de keyword deve ter membros após indexação")

	// Chave :next deve ter sido removida pelo RENAME
	nextExists, err := rdb.Exists(ctx, "scraper:jobs:keyword:go:next").Result()
	require.NoError(t, err)
	assert.Equal(t, int64(0), nextExists, "chave :next deve sumir após RENAME atômico")

	// Segunda indexação — simula próximo ciclo de scraping
	pipeline.IndexJobsInValkey(ctx, rdb, jobs, keywords)

	// Chave final ainda deve ter membros (sem janela vazia)
	membersApos, err := rdb.SMembers(ctx, "scraper:jobs:keyword:go").Result()
	require.NoError(t, err)
	assert.NotEmpty(t, membersApos, "índice não deve ficar vazio durante reindexação")
}

// TestIndexJobsInValkey_TTLKeywordAlinhado garante que o TTL dos índices
// de keyword está alinhado com o TTL das vagas individuais (9 dias).
// Se o índice expirar antes da vaga, buscas retornam vazio mesmo com dados no cache.
func TestIndexJobsInValkey_TTLKeywordAlinhado(t *testing.T) {
	rdb, _ := newTestRedis(t)
	ctx := context.Background()

	jobs := []models.Job{
		{Title: "Dev Go", Company: "Acme", Location: "Brasil", Description: "golang backend"},
	}
	keywords := []string{"go"}

	pipeline.IndexJobsInValkey(ctx, rdb, jobs, keywords)

	ttl, err := rdb.TTL(ctx, "scraper:jobs:keyword:go").Result()
	require.NoError(t, err)

	// TTL deve ser maior que 8 dias — cobre o ciclo semanal com margem
	assert.Greater(t, ttl, 8*24*time.Hour,
		"TTL do índice de keyword deve cobrir o ciclo semanal (>8 dias)")
}

// TestIndexJobsInValkey_IndexGlobalSemTTL garante que o índice global
// não recebe TTL — ele é permanente e se auto-limpa via GetAll.
func TestIndexJobsInValkey_IndexGlobalSemTTL(t *testing.T) {
	rdb, _ := newTestRedis(t)
	ctx := context.Background()

	jobs := []models.Job{
		{Title: "Dev Go", Company: "Acme", Location: "Brasil"},
	}

	pipeline.IndexJobsInValkey(ctx, rdb, jobs, []string{"go"})

	ttl, err := rdb.TTL(ctx, "scraper:jobs:index").Result()
	require.NoError(t, err)

	// -1 = sem TTL (permanente), -2 = chave não existe
	assert.Equal(t, time.Duration(-1), ttl,
		"índice global não deve ter TTL — deve ser permanente")
}

// TestIndexJobsInValkey_KeywordComposta garante que keywords compostas
// (ex: "node js") só indexam vagas que contêm todos os sub-termos.
func TestIndexJobsInValkey_KeywordComposta(t *testing.T) {
	rdb, _ := newTestRedis(t)
	ctx := context.Background()

	jobs := []models.Job{
		{
			Title:       "Dev Node.js",
			Company:     "Empresa A",
			Location:    "Brasil",
			Description: "vaga para node js backend",
		},
		{
			Title:       "Dev Python",
			Company:     "Empresa B",
			Location:    "Brasil",
			Description: "vaga para python backend, sem node",
		},
	}

	keywords := []string{"node js"}
	pipeline.IndexJobsInValkey(ctx, rdb, jobs, keywords)

	members, err := rdb.SMembers(ctx, "scraper:jobs:keyword:node js").Result()
	require.NoError(t, err)

	// Só a primeira vaga deve estar no índice composto "node js"
	assert.Len(t, members, 1, "keyword composta deve indexar apenas vagas com todos os termos")

	// O ID deve ser o da vaga de Node.js
	expectedID := jobstore.StableID(&jobs[0])
	assert.Contains(t, members, expectedID)
}

// TestIndexJobsInValkey_SubTermosIndexadosIndividualmente garante que
// cada sub-termo de uma keyword composta também gera seu próprio índice.
func TestIndexJobsInValkey_SubTermosIndexadosIndividualmente(t *testing.T) {
	rdb, _ := newTestRedis(t)
	ctx := context.Background()

	jobs := []models.Job{
		{
			Title:       "Dev Node.js",
			Company:     "Acme",
			Location:    "Brasil",
			Description: "backend com node e js",
		},
	}

	keywords := []string{"node js"}
	pipeline.IndexJobsInValkey(ctx, rdb, jobs, keywords)

	// Sub-termo "node" deve ter seu próprio índice
	nodeMembers, err := rdb.SMembers(ctx, "scraper:jobs:keyword:node").Result()
	require.NoError(t, err)
	assert.NotEmpty(t, nodeMembers, "sub-termo 'node' deve ter índice próprio")

	// Sub-termo "js" deve ter seu próprio índice
	jsMembers, err := rdb.SMembers(ctx, "scraper:jobs:keyword:js").Result()
	require.NoError(t, err)
	assert.NotEmpty(t, jsMembers, "sub-termo 'js' deve ter índice próprio")
}

func TestIndexJobsInValkey_NormalizaAliasesDeTecnologia(t *testing.T) {
	rdb, _ := newTestRedis(t)
	ctx := context.Background()

	jobs := []models.Job{
		{
			Title:       "Node.js Developer",
			Company:     "Acme",
			Location:    "Brasil",
			Description: "backend com node js",
		},
	}

	pipeline.IndexJobsInValkey(ctx, rdb, jobs, []string{"Node.js Developer"})
	expectedID := jobstore.StableID(&jobs[0])

	keys := []string{
		"scraper:jobs:keyword:node.js developer",
		"scraper:jobs:keyword:node js developer",
		"scraper:jobs:keyword:nodejs",
		"scraper:jobs:keyword:node",
	}

	for _, key := range keys {
		members, err := rdb.SMembers(ctx, key).Result()
		require.NoError(t, err)
		assert.Contains(t, members, expectedID, "alias de tecnologia %s deve conter a vaga", key)
	}
}

func TestIndexJobsInValkey_IndicesEstruturados(t *testing.T) {
	rdb, _ := newTestRedis(t)
	ctx := context.Background()

	jobs := []models.Job{
		{
			Title:       "Desenvolvedor Node.js Júnior PJ",
			Company:     "Acme",
			Location:    "São Paulo, SP, Brasil - Híbrido",
			Modality:    "Hybrid",
			Description: "Contrato PJ para atuar em modelo híbrido",
		},
	}

	pipeline.IndexJobsInValkey(ctx, rdb, jobs, []string{"node"})
	expectedID := jobstore.StableID(&jobs[0])

	keys := []string{
		"scraper:jobs:level:junior",
		"scraper:jobs:model:hibrido",
		"scraper:jobs:contract:pj",
		"scraper:jobs:continent:america do sul",
		"scraper:jobs:country:brasil",
		"scraper:jobs:location:brasil",
		"scraper:jobs:state:sp",
		"scraper:jobs:city:sao paulo",
	}

	for _, key := range keys {
		members, err := rdb.SMembers(ctx, key).Result()
		require.NoError(t, err)
		assert.Contains(t, members, expectedID, "índice estruturado %s deve conter a vaga", key)
	}
}

func TestIndexJobsInValkey_DetectaBrasilPorEstadoECidade(t *testing.T) {
	rdb, _ := newTestRedis(t)
	ctx := context.Background()

	jobs := []models.Job{
		{
			Title:       "Junior/midlevel Java Developer - Remote Work",
			Company:     "BairesDev",
			Location:    "Joinville, Santa Catarina",
			Description: "vaga remota para java",
		},
	}

	pipeline.IndexJobsInValkey(ctx, rdb, jobs, []string{"java"})
	expectedID := jobstore.StableID(&jobs[0])

	keys := []string{
		"scraper:jobs:country:brasil",
		"scraper:jobs:location:brasil",
		"scraper:jobs:continent:america do sul",
		"scraper:jobs:state:sc",
		"scraper:jobs:city:joinville",
	}

	for _, key := range keys {
		members, err := rdb.SMembers(ctx, key).Result()
		require.NoError(t, err)
		assert.Contains(t, members, expectedID, "índice %s deve conter a vaga", key)
	}
}

func TestIndexJobsInValkey_ClassificacaoIgnoraKeywordDaBusca(t *testing.T) {
	rdb, _ := newTestRedis(t)
	ctx := context.Background()

	jobs := []models.Job{
		{
			Title:    "Software Engineer",
			Company:  "Acme",
			Location: "São Paulo, Brasil",
			Keyword:  "Remote Junior Developer",
			Keywords: []string{"Remote Junior Developer"},
		},
	}

	pipeline.IndexJobsInValkey(ctx, rdb, jobs, []string{"Remote Junior Developer"})
	expectedID := jobstore.StableID(&jobs[0])

	plenoMembers, err := rdb.SMembers(ctx, "scraper:jobs:level:pleno").Result()
	require.NoError(t, err)
	assert.Contains(t, plenoMembers, expectedID)

	juniorMembers, err := rdb.SMembers(ctx, "scraper:jobs:level:junior").Result()
	require.NoError(t, err)
	assert.NotContains(t, juniorMembers, expectedID)

	presencialMembers, err := rdb.SMembers(ctx, "scraper:jobs:model:presencial").Result()
	require.NoError(t, err)
	assert.Contains(t, presencialMembers, expectedID)

	remoteMembers, err := rdb.SMembers(ctx, "scraper:jobs:model:remoto").Result()
	require.NoError(t, err)
	assert.NotContains(t, remoteMembers, expectedID)
}

// TestIndexJobsInValkey_VagasSemIDIgnoradas garante robustez:
// vagas sem título, empresa e URL não devem causar panic nem entrar no índice.
func TestIndexJobsInValkey_VagasSemIDIgnoradas(t *testing.T) {
	rdb, _ := newTestRedis(t)
	ctx := context.Background()

	jobs := []models.Job{
		{}, // vaga completamente vazia — StableID retorna ""
		{Title: "Dev Go", Company: "Acme", Location: "Brasil"},
	}

	// Não deve panic
	assert.NotPanics(t, func() {
		pipeline.IndexJobsInValkey(ctx, rdb, jobs, []string{"go"})
	})

	// Apenas a vaga válida deve estar no índice global
	members, err := rdb.SMembers(ctx, "scraper:jobs:index").Result()
	require.NoError(t, err)
	assert.Len(t, members, 1, "vaga sem ID estável não deve entrar no índice")
}
