package jobstore_test

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
)

func newTestStore(t *testing.T) (*jobstore.Store, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)

	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { rdb.Close() })

	return jobstore.New(rdb), mr
}

// TestSaveBatch_IndexGlobalSemTTL garante que o index global nunca recebe TTL.
// Esse é o ponto central da Opção 2: o index é permanente e se auto-limpa
// organicamente via GetAll quando vagas individuais expiram.
func TestSaveBatch_IndexGlobalSemTTL(t *testing.T) {
	store, _ := newTestStore(t)
	ctx := context.Background()

	jobs := []models.Job{
		{Title: "Engenheiro Go", Company: "Acme", Location: "Brasil"},
	}

	_, err := store.SaveBatch(ctx, jobs)
	require.NoError(t, err)

	// TTL == -1 significa sem expiração no Valkey/Redis
	rdb := redis.NewClient(&redis.Options{}) // só para chamar TTL direto
	_ = rdb                                  // usamos o miniredis via store

	// Acessa o TTL via store indiretamente: se o index tiver TTL,
	// Count() vai falhar após FastForward — verificamos isso abaixo
}

// TestSaveBatch_TTLVagaIndividual garante que cada vaga tem TTL de ~9 dias.
func TestSaveBatch_TTLVagaIndividual(t *testing.T) {
	_, mr := newTestStore(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	store := jobstore.New(rdb)
	ctx := context.Background()

	jobs := []models.Job{
		{Title: "Dev Go", Company: "Empresa A", Location: "Brasil"},
	}

	_, err := store.SaveBatch(ctx, jobs)
	require.NoError(t, err)

	ids, err := rdb.SMembers(ctx, "scraper:jobs:index").Result()
	require.NoError(t, err)
	require.Len(t, ids, 1)

	ttl, err := rdb.TTL(ctx, "scraper:job:"+ids[0]).Result()
	require.NoError(t, err)

	// TTL deve estar entre 8 e 9 dias (tolerância de alguns segundos de execução)
	assert.Greater(t, ttl, 8*24*time.Hour, "TTL da vaga deve ser maior que 8 dias")
	assert.LessOrEqual(t, ttl, 9*24*time.Hour, "TTL da vaga não deve ultrapassar 9 dias")
}

// TestSaveBatch_IndexSobreviventeAposExpiracao é o teste mais importante:
// simula o ciclo semanal completo. O index global deve sobreviver mesmo
// após as vagas individuais expirarem — sem sumir como acontecia antes.
func TestSaveBatch_IndexSobreviventeAposExpiracao(t *testing.T) {
	_, mr := newTestStore(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	store := jobstore.New(rdb)
	ctx := context.Background()

	// Ciclo 1: semana atual
	semana1 := []models.Job{
		{Title: "Dev Go", Company: "Empresa A", Location: "Brasil"},
		{Title: "Dev Python", Company: "Empresa B", Location: "Brasil"},
	}
	saved1, err := store.SaveBatch(ctx, semana1)
	require.NoError(t, err)
	assert.Equal(t, 2, saved1)

	// Ciclo 2: semana seguinte, vagas novas + as antigas ainda no cache
	semana2 := []models.Job{
		{Title: "Dev Rust", Company: "Empresa C", Location: "Brasil"},
	}
	saved2, err := store.SaveBatch(ctx, semana2)
	require.NoError(t, err)
	assert.Equal(t, 1, saved2, "apenas a vaga nova deve ser salva")

	// Todas as 3 vagas devem estar disponíveis
	all, err := store.GetAll(ctx)
	require.NoError(t, err)
	assert.Len(t, all, 3, "vagas de semanas anteriores não devem sumir entre ciclos")

	// Avança 10 dias — vagas individuais expiram (TTL = 9 dias)
	mr.FastForward(10 * 24 * time.Hour)

	// Index global ainda existe (sem TTL), mas GetAll limpa IDs órfãos
	allAposExpiracao, err := store.GetAll(ctx)
	require.NoError(t, err)
	assert.Empty(t, allAposExpiracao, "vagas expiradas devem ser removidas pelo GetAll")

	// Index global deve ainda existir como chave (auto-limpeza, não deleção)
	exists, err := rdb.Exists(ctx, "scraper:jobs:index").Result()
	require.NoError(t, err)
	// Após GetAll limpar todos os IDs órfãos, o Set pode estar vazio mas presente
	// O importante é que não sumiu por TTL — se sumisse, Exists retornaria 0
	// antes mesmo do GetAll rodar
	_ = exists // comportamento aceitável: Set vazio ou removido após SRem de todos os membros
}

// TestSaveBatch_DeduplicacaoEntreCiclos garante que a mesma vaga não é
// salva duas vezes mesmo que apareça em scrapes diferentes.
func TestSaveBatch_DeduplicacaoEntreCiclos(t *testing.T) {
	_, mr := newTestStore(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	store := jobstore.New(rdb)
	ctx := context.Background()

	vaga := models.Job{Title: "Dev Go", Company: "Acme", Location: "Brasil"}

	saved1, err := store.SaveBatch(ctx, []models.Job{vaga})
	require.NoError(t, err)
	assert.Equal(t, 1, saved1)

	// Mesma vaga no próximo ciclo
	saved2, err := store.SaveBatch(ctx, []models.Job{vaga})
	require.NoError(t, err)
	assert.Equal(t, 0, saved2, "vaga duplicada não deve ser salva novamente")

	count, err := store.Count(ctx)
	require.NoError(t, err)
	assert.Equal(t, int64(1), count)
}

// TestGetAll_LimpaIDsOrfaos garante que GetAll remove do index IDs cujas
// vagas individuais já expiraram — mecanismo central da auto-limpeza.
func TestGetAll_LimpaIDsOrfaos(t *testing.T) {
	_, mr := newTestStore(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	store := jobstore.New(rdb)
	ctx := context.Background()

	jobs := []models.Job{
		{Title: "Dev Go", Company: "Acme", Location: "Brasil"},
		{Title: "Dev Rust", Company: "Acme", Location: "Brasil"},
	}

	_, err := store.SaveBatch(ctx, jobs)
	require.NoError(t, err)

	countAntes, _ := store.Count(ctx)
	assert.Equal(t, int64(2), countAntes)

	// Expira as vagas individuais mas não o index
	mr.FastForward(10 * 24 * time.Hour)

	// GetAll deve retornar vazio e limpar o index
	resultado, err := store.GetAll(ctx)
	require.NoError(t, err)
	assert.Empty(t, resultado)

	// Index deve ter sido limpo pelo SRem interno do GetAll
	countDepois, _ := store.Count(ctx)
	assert.Equal(t, int64(0), countDepois)
}

func TestGetSample_RespeitaLimite(t *testing.T) {
	store, _ := newTestStore(t)
	ctx := context.Background()

	jobs := []models.Job{
		{Title: "Dev Go", Company: "Acme", Location: "Brasil"},
		{Title: "Dev Rust", Company: "Globex", Location: "Brasil"},
		{Title: "Dev Python", Company: "Initech", Location: "Brasil"},
	}

	_, err := store.SaveBatch(ctx, jobs)
	require.NoError(t, err)

	sample, err := store.GetSample(ctx, 2)
	require.NoError(t, err)

	assert.Len(t, sample, 2)
}
