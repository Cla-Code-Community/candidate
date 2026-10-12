package pipeline

import (
	"context"
	"fmt"
	"strings"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/config"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/redis/go-redis/v9"
)

const (
	globalIndexKey  = "scraper:jobs:index"
	indexTTL        = config.DefaultCatalogLifetime
	indexNextSuffix = ":next"
	publishChunk    = 100
)

// indexSession accumulates inverted indexes in isolated :next keys for one
// execution, then publishes them with RENAME so live sets match the current
// run without wiping earlier batches of the same run.
type indexSession struct {
	runID      string
	keys       map[string]struct{}
	membership map[string]map[string]struct{}
}

func newIndexSession(runID string) *indexSession {
	return &indexSession{
		runID:      strings.TrimSpace(runID),
		keys:       make(map[string]struct{}),
		membership: make(map[string]map[string]struct{}),
	}
}

func (s *indexSession) tempKey(live string) string {
	if s == nil || s.runID == "" {
		return live + indexNextSuffix
	}
	return live + indexNextSuffix + ":" + s.runID
}

func (s *indexSession) liveKeys() []string {
	keys := make([]string, 0, len(s.keys))
	for key := range s.keys {
		keys = append(keys, key)
	}
	return keys
}

func IndexJobsInValkey(ctx context.Context, rdb *redis.Client, jobs []domain.Job, keywords []string) error {
	_, err := IndexJobsInValkeyBatched(ctx, rdb, jobs, keywords, config.DefaultIndexBatchSize)
	return err
}

// IndexJobsInValkeyBatched writes inverted indexes in limited pipelines.
// Each call builds isolated :next keys and publishes them atomically with
// RENAME so live sets represent that job list. Use a shared indexSession
// during a scrape run to accumulate batches before one publish.
func IndexJobsInValkeyBatched(
	ctx context.Context,
	rdb *redis.Client,
	jobs []domain.Job,
	keywords []string,
	batchSize int,
) (int, error) {
	return indexJobsInValkeyBatched(ctx, rdb, jobs, keywords, batchSize, nil)
}

func indexJobsInValkeyBatched(
	ctx context.Context,
	rdb *redis.Client,
	jobs []domain.Job,
	keywords []string,
	batchSize int,
	session *indexSession,
) (int, error) {
	if rdb == nil || len(jobs) == 0 {
		return 0, nil
	}
	if cause := context.Cause(ctx); cause != nil {
		return 0, cause
	}
	if batchSize <= 0 {
		batchSize = config.DefaultIndexBatchSize
	}

	owned := session == nil
	if owned {
		session = newIndexSession("")
	}

	prepared := prepareIndexKeywords(keywords)
	commands := 0
	var err error
	for start := 0; start < len(jobs); start += batchSize {
		if cause := context.Cause(ctx); cause != nil {
			err = cause
			break
		}
		end := min(start+batchSize, len(jobs))
		chunkCommands, chunkErr := indexJobChunk(ctx, rdb, jobs[start:end], prepared, session)
		commands += chunkCommands
		if chunkErr != nil {
			err = chunkErr
			break
		}
	}

	if owned {
		cleanupCtx := context.WithoutCancel(ctx)
		if err != nil {
			_ = session.Discard(cleanupCtx, rdb)
			return commands, err
		}
		if pubErr := session.Publish(ctx, rdb); pubErr != nil {
			_ = session.Discard(cleanupCtx, rdb)
			return commands, pubErr
		}
	}
	return commands, err
}

func indexJobChunk(
	ctx context.Context,
	rdb *redis.Client,
	jobs []domain.Job,
	prepared *preparedIndexKeywords,
	session *indexSession,
) (int, error) {
	if session == nil {
		session = newIndexSession("")
	}

	type jobPlan struct {
		id     string
		newSet map[string]struct{}
	}

	plans := make([]jobPlan, 0, len(jobs))
	additions := make(map[string][]string)
	pendingKeys := make(map[string]struct{})
	ids := make([]string, 0, len(jobs))

	for _, job := range jobs {
		if cause := context.Cause(ctx); cause != nil {
			return 0, cause
		}
		id := job.ID
		if id == "" {
			id = jobstore.StableID(&job)
		}
		if id == "" {
			continue
		}
		ids = append(ids, id)
		additions[globalIndexKey] = append(additions[globalIndexKey], id)

		newKeys := prepared.keys(job)
		newSet := make(map[string]struct{}, len(newKeys))
		for _, key := range newKeys {
			newSet[key] = struct{}{}
			additions[key] = append(additions[key], id)
			pendingKeys[key] = struct{}{}
		}
		plans = append(plans, jobPlan{id: id, newSet: newSet})
	}

	storedMeta, err := loadIndexMeta(ctx, rdb, ids, session)
	if err != nil {
		return 0, err
	}

	nextRemovals := make(map[string][]string)
	liveRemovals := make(map[string][]string)
	pendingMembership := make(map[string]map[string]struct{}, len(plans))
	for _, plan := range plans {
		old := session.membership[plan.id]
		if old == nil {
			old = storedMeta[plan.id]
		}
		for key := range old {
			if _, keep := plan.newSet[key]; keep {
				continue
			}
			_, rebuilding := additions[key]
			if !rebuilding {
				_, rebuilding = session.keys[key]
			}
			if rebuilding {
				nextRemovals[key] = append(nextRemovals[key], plan.id)
			}
			liveRemovals[key] = append(liveRemovals[key], plan.id)
		}
		pendingMembership[plan.id] = plan.newSet
	}

	if len(additions) == 0 && len(nextRemovals) == 0 && len(liveRemovals) == 0 {
		return 0, nil
	}

	var commands int
	err = jobstore.RetryTransient(ctx, func() error {
		pipe := rdb.TxPipeline()
		commands = 0
		for key, members := range additions {
			unique := uniqueIndexMembers(members)
			if len(unique) == 0 {
				continue
			}
			args := make([]any, len(unique))
			for i, member := range unique {
				args[i] = member
			}
			dest := key
			if key != globalIndexKey {
				dest = session.tempKey(key)
			}
			pipe.SAdd(ctx, dest, args...)
			commands++
			if key != globalIndexKey {
				pipe.Expire(ctx, dest, indexTTL)
				commands++
			}
		}
		for key, members := range nextRemovals {
			args := indexMemberArgs(members)
			if len(args) == 0 {
				continue
			}
			pipe.SRem(ctx, session.tempKey(key), args...)
			commands++
		}
		for key, members := range liveRemovals {
			args := indexMemberArgs(members)
			if len(args) == 0 {
				continue
			}
			pipe.SRem(ctx, key, args...)
			commands++
		}
		for _, plan := range plans {
			metaKey := jobIndexMetaKey(plan.id)
			pipe.Del(ctx, metaKey)
			commands++
			if len(plan.newSet) == 0 {
				continue
			}
			args := make([]any, 0, len(plan.newSet))
			for key := range plan.newSet {
				args = append(args, key)
			}
			pipe.SAdd(ctx, metaKey, args...)
			pipe.Expire(ctx, metaKey, indexTTL)
			commands += 2
		}
		if commands == 0 {
			return nil
		}
		if _, err := pipe.Exec(ctx); err != nil {
			return fmt.Errorf("index chunk exec (%d commands): %w", commands, err)
		}
		return nil
	})
	if err != nil {
		return commands, err
	}

	for key := range pendingKeys {
		session.keys[key] = struct{}{}
	}
	for id, keys := range pendingMembership {
		session.membership[id] = keys
	}
	return commands, nil
}

func jobIndexMetaKey(id string) string {
	return "scraper:job:" + id + ":idx"
}

func indexMemberArgs(members []string) []any {
	unique := uniqueIndexMembers(members)
	args := make([]any, len(unique))
	for i, member := range unique {
		args[i] = member
	}
	return args
}

func loadIndexMeta(
	ctx context.Context,
	rdb *redis.Client,
	ids []string,
	session *indexSession,
) (map[string]map[string]struct{}, error) {
	out := make(map[string]map[string]struct{}, len(ids))
	need := make([]string, 0, len(ids))
	for _, id := range ids {
		if _, ok := session.membership[id]; ok {
			continue
		}
		need = append(need, id)
	}
	if len(need) == 0 {
		return out, nil
	}

	pipe := rdb.Pipeline()
	cmds := make([]*redis.StringSliceCmd, len(need))
	for i, id := range need {
		cmds[i] = pipe.SMembers(ctx, jobIndexMetaKey(id))
	}
	if _, err := pipe.Exec(ctx); err != nil && err != redis.Nil {
		return nil, fmt.Errorf("index meta load: %w", err)
	}
	for i, id := range need {
		members, err := cmds[i].Result()
		if err != nil && err != redis.Nil {
			continue
		}
		if len(members) == 0 {
			continue
		}
		set := make(map[string]struct{}, len(members))
		for _, member := range members {
			if member != "" {
				set[member] = struct{}{}
			}
		}
		out[id] = set
	}
	return out, nil
}

func (s *indexSession) Publish(ctx context.Context, rdb *redis.Client) error {
	if s == nil || rdb == nil {
		return nil
	}
	keys := s.liveKeys()
	if len(keys) == 0 {
		return nil
	}
	if cause := context.Cause(ctx); cause != nil {
		return cause
	}

	for start := 0; start < len(keys); start += publishChunk {
		if cause := context.Cause(ctx); cause != nil {
			return cause
		}
		end := min(start+publishChunk, len(keys))
		chunk := keys[start:end]
		if err := publishIndexChunk(ctx, rdb, s, chunk); err != nil {
			return err
		}
	}
	return nil
}

func publishIndexChunk(ctx context.Context, rdb *redis.Client, session *indexSession, keys []string) error {
	return jobstore.RetryTransient(ctx, func() error {
		probe := rdb.Pipeline()
		exists := make([]*redis.IntCmd, len(keys))
		for i, key := range keys {
			exists[i] = probe.Exists(ctx, session.tempKey(key))
		}
		if _, err := probe.Exec(ctx); err != nil && err != redis.Nil {
			return fmt.Errorf("index publish exists: %w", err)
		}

		pipe := rdb.TxPipeline()
		commands := 0
		for i, key := range keys {
			if exists[i].Val() == 0 {
				continue
			}
			pipe.Rename(ctx, session.tempKey(key), key)
			pipe.Expire(ctx, key, indexTTL)
			commands += 2
		}
		if commands == 0 {
			return nil
		}
		if _, err := pipe.Exec(ctx); err != nil {
			return fmt.Errorf("index publish exec (%d commands): %w", commands, err)
		}
		return nil
	})
}

func (s *indexSession) Discard(ctx context.Context, rdb *redis.Client) error {
	if s == nil || rdb == nil || len(s.keys) == 0 {
		return nil
	}
	keys := s.liveKeys()
	return jobstore.RetryTransient(ctx, func() error {
		pipe := rdb.Pipeline()
		for _, key := range keys {
			pipe.Del(ctx, s.tempKey(key))
		}
		_, err := pipe.Exec(ctx)
		return err
	})
}

// preparedIndexKeywords owns an immutable snapshot of the execution's keywords.
// No job-specific results or mutable caches are shared between callers.
type preparedIndexKeywords struct {
	plans []indexKeywordPlan
}

type indexKeywordPlan struct {
	terms    []string
	aliases  []string
	subterms []indexSubterm
}

type indexSubterm struct {
	term string
	key  string
}

func prepareIndexKeywords(keywords []string) *preparedIndexKeywords {
	prepared := &preparedIndexKeywords{plans: make([]indexKeywordPlan, 0, len(keywords))}
	for _, kw := range keywords {
		sanitized := strings.ToLower(strings.TrimSpace(kw))
		if sanitized == "" {
			continue
		}
		normalized := normalizeIndexValue(sanitized)
		rawTerms := strings.Fields(normalized)
		plan := indexKeywordPlan{terms: make([]string, 0, len(rawTerms))}
		for i := 0; i < len(rawTerms); i++ {
			if rawTerms[i] == "node" && i+1 < len(rawTerms) && rawTerms[i+1] == "js" {
				plan.terms = append(plan.terms, "node js")
				i++
			} else {
				plan.terms = append(plan.terms, rawTerms[i])
			}
		}
		aliasValues := []string{strings.Join(strings.Fields(strings.ReplaceAll(sanitized, "/", " ")), " "), normalized}
		if strings.Contains(normalized, "node js") {
			aliasValues = append(aliasValues, strings.ReplaceAll(normalized, "node js", "nodejs"), "nodejs", "node")
		}
		for _, alias := range uniqueStrings(aliasValues) {
			plan.aliases = append(plan.aliases, "scraper:jobs:keyword:"+alias)
		}
		subterms := rawTerms
		if len(rawTerms) >= 2 && rawTerms[0] == "node" && rawTerms[1] == "js" {
			subterms = append(subterms, "nodejs")
		}
		for _, term := range uniqueStrings(subterms) {
			plan.subterms = append(plan.subterms, indexSubterm{term: term, key: "scraper:jobs:keyword:" + term})
		}
		prepared.plans = append(prepared.plans, plan)
	}
	return prepared
}

func invertedIndexKeys(job domain.Job, keywords []string) []string {
	return prepareIndexKeywords(keywords).keys(job)
}

func (prepared *preparedIndexKeywords) keys(job domain.Job) []string {
	searchText := keywordSearchText(job)
	// normalizeIndexValue joins words using literal spaces. Token membership is
	// exactly the old padded-token search; phrases retain substring semantics.
	tokens := make(map[string]bool)
	for _, token := range strings.Fields(searchText) {
		tokens[token] = true
	}
	nodeJS := strings.Contains(searchText, "node js") || tokens["nodejs"]
	keys := make([]string, 0, 32)
	for _, plan := range prepared.plans {
		matches := len(plan.terms) > 0
		for _, term := range plan.terms {
			if (term == "node js" && !nodeJS) || (term != "node js" && !tokens[term]) {
				matches = false
				break
			}
		}
		if matches {
			keys = append(keys, plan.aliases...)
		}
		for _, subterm := range plan.subterms {
			if tokens[subterm.term] {
				keys = append(keys, subterm.key)
			}
		}
	}
	keys = append(keys, structuredIndexKeysFromText(job, searchText)...)
	keys = append(keys, classificationIndexKeys(job)...)
	return uniqueIndexMembers(keys)
}

func uniqueIndexMembers(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

// ReindexPersistedJobs reloads documents from the Valkey job store and
// rebuilds inverted indexes. It does not repeat external collection.
func ReindexPersistedJobs(
	ctx context.Context,
	store *jobstore.Store,
	rdb *redis.Client,
	ids []string,
	keywords []string,
	batchSize int,
) error {
	return reindexPersistedJobs(ctx, store, rdb, ids, keywords, batchSize, nil)
}

func reindexPersistedJobs(
	ctx context.Context,
	store *jobstore.Store,
	rdb *redis.Client,
	ids []string,
	keywords []string,
	batchSize int,
	session *indexSession,
) error {
	if rdb == nil {
		return fmt.Errorf("reindex: valkey client is required")
	}
	if store == nil {
		return fmt.Errorf("reindex: persisted job store is required")
	}
	if len(ids) == 0 {
		return fmt.Errorf("reindex: no job ids")
	}
	jobs, err := store.GetByIDs(ctx, ids)
	if err != nil {
		return err
	}
	if len(jobs) == 0 {
		return fmt.Errorf("reindex: no persisted jobs found for %d ids", len(ids))
	}
	_, err = indexJobsInValkeyBatched(ctx, rdb, jobs, keywords, batchSize, session)
	return err
}

// IndexKeys is the existing search-index projection reused by maintenance.
func IndexKeys(job domain.Job, keywords []string) []string { return invertedIndexKeys(job, keywords) }
