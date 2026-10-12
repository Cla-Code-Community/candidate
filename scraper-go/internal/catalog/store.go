// Package catalog implements the Processor's PostgreSQL persistence port.
package catalog

import (
	"bytes"
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"log/slog"
	"reflect"
	"sort"
	"time"

	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/config"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/domain"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/jobstore"
	"github.com/Benevanio/Jobs_Scraper_Global/scraper-go/internal/metrics"
	"github.com/lib/pq"
)

const DefaultLifetime = config.DefaultCatalogLifetime
const MaintenanceLock int64 = 125001

type Store struct {
	DB       *sql.DB
	Lifetime time.Duration
	Now      func() time.Time
}

func New(db *sql.DB, lifetime time.Duration) *Store {
	return &Store{DB: db, Lifetime: lifetime, Now: time.Now}
}

func (s *Store) SaveBatch(ctx context.Context, jobs []domain.Job) (jobstore.SaveResult, error) {
	return s.save(ctx, jobs, false)
}

// Import preserves IDs and the remaining lifetime observed in legacy Valkey.
// ON CONFLICT DO NOTHING prevents an old backfill from overwriting new collection.
func (s *Store) Import(ctx context.Context, jobs []domain.Job) (jobstore.SaveResult, error) {
	return s.save(ctx, jobs, true)
}
func (s *Store) save(ctx context.Context, jobs []domain.Job, importing bool) (result jobstore.SaveResult, returnErr error) {
	started := time.Now()
	var preparation, begin, lock, readExisting, decode, mergeCompare, serialization, refreshUpdate, upsert, returningDecode, commit time.Duration
	defer func() {
		slog.Info("catalog persist attempt", "stage", "catalog_persist", "importing", importing,
			"received", len(jobs), "created", result.Inserted, "real_updated", result.RealUpdated,
			"refreshed", result.Refreshed, "reactivated", result.Reactivated,
			"status", metrics.BatchStatus(returnErr), "preparation_duration", preparation,
			"begin_duration", begin, "lock_duration", lock, "read_existing_duration", readExisting,
			"decode_duration", decode, "merge_compare_duration", mergeCompare,
			"serialization_duration", serialization, "refresh_update_duration", refreshUpdate,
			"upsert_duration", upsert, "returning_decode_duration", returningDecode,
			"commit_duration", commit, "duration", time.Since(started))
	}()
	defer func() {
		metrics.ObservePersistence(started, len(jobs), result.Inserted, result.Updated, len(jobs)-len(result.Persisted), returnErr)
	}()
	if len(jobs) > 2500 {
		return result, fmt.Errorf("catalog batch exceeds 2500")
	}
	if s.Lifetime <= 0 {
		return result, fmt.Errorf("catalog lifetime must be positive")
	}
	byID := map[string]domain.Job{}
	for _, job := range jobs {
		id := jobstore.StableID(&job)
		if importing {
			id = job.ID
		}
		if id == "" || (job.Title == "" && job.URL == "") {
			result.Invalid++
			continue
		}
		job.ID = id
		if old, ok := byID[id]; ok {
			job = jobstore.MergeStored(old, job)
		}
		byID[id] = job
	}
	if len(byID) == 0 {
		return result, nil
	}
	ids := make([]string, 0, len(byID))
	for id := range byID {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	preparation = time.Since(started)
	phase := time.Now()
	tx, err := s.DB.BeginTx(ctx, nil)
	begin = time.Since(phase)
	if err != nil {
		return result, fmt.Errorf("catalog begin: %w", err)
	}
	defer tx.Rollback()
	defer func() {
		if returnErr != nil {
			metrics.PersistenceRollbacks.WithLabelValues(metrics.PersistenceErrorReason(returnErr)).Inc()
		}
	}()
	phase = time.Now()
	// Fence absent IDs as well, so concurrent inserts preserve merge semantics.
	_, err = tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(hashtextextended(id,125)) FROM (SELECT unnest($1::text[]) AS id ORDER BY 1) AS ordered_ids`, pq.Array(ids))
	lock = time.Since(phase)
	if err != nil {
		return result, err
	}
	phase = time.Now()
	// Sorted locking avoids deadlocks between overlapping collection batches.
	rows, err := tx.QueryContext(ctx, `SELECT id,payload,expires_at FROM job_catalog WHERE id=ANY($1) ORDER BY id FOR UPDATE`, pq.Array(ids))
	readExisting = time.Since(phase)
	if err != nil {
		return result, fmt.Errorf("catalog read batch: %w", err)
	}
	existing := map[string]domain.Job{}
	comparable := map[string]bool{}
	for {
		phase = time.Now()
		more := rows.Next()
		readExisting += time.Since(phase)
		if !more {
			break
		}
		var id string
		var raw []byte
		var expires time.Time
		phase = time.Now()
		if err = rows.Scan(&id, &raw, &expires); err != nil {
			rows.Close()
			return result, err
		}
		readExisting += time.Since(phase)
		phase = time.Now()
		var j domain.Job
		decoder := json.NewDecoder(bytes.NewReader(raw))
		decoder.DisallowUnknownFields()
		comparable[id] = decoder.Decode(&j) == nil
		// Unknown persisted fields must force a full rewrite, never a false refresh.
		if !comparable[id] {
			err = json.Unmarshal(raw, &j)
		} else {
			err = nil
		}
		if err != nil {
			rows.Close()
			return result, fmt.Errorf("catalog decode: %w", err)
		}
		decode += time.Since(phase)
		j.CatalogExpiresAt = expires
		existing[id] = j
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return result, err
	}
	now := s.Now().UTC()
	payloads := make([]json.RawMessage, 0, len(ids))
	expiry := make([]string, 0, len(ids))
	refreshIDs := make([]string, 0, len(ids))
	changes := make(map[string]string, len(ids))
	for _, id := range ids {
		phase = time.Now()
		job := byID[id]
		change := "job_created"
		if old, ok := existing[id]; ok && !importing {
			job = jobstore.MergeStored(old, job)
			change = "job_updated"
			if !old.CatalogExpiresAt.After(now) {
				change = "job_reactivated"
			} else if comparable[id] && sameContent(old, job) {
				change = "job_refreshed"
			}
		}
		mergeCompare += time.Since(phase)
		changes[id] = change
		if change == "job_refreshed" {
			byID[id] = job
			refreshIDs = append(refreshIDs, id)
			continue
		}
		end := now.Add(s.Lifetime)
		if importing {
			end = job.CatalogExpiresAt
			if end.IsZero() || !end.After(now) {
				result.Invalid++
				continue
			}
		}
		phase = time.Now()
		raw, e := json.Marshal(job)
		serialization += time.Since(phase)
		if e != nil {
			return result, e
		}
		payloads = append(payloads, raw)
		expiry = append(expiry, end.Format(time.RFC3339Nano))
	}
	// Refresh keeps a new mutation revision (and durable pending checkpoint),
	// but neither serializes nor assigns payload. updated_at retains its existing
	// meaning: time of the latest catalog mutation, including freshness.
	persisted := make([]domain.Job, 0, len(ids))
	if len(refreshIDs) > 0 {
		phase = time.Now()
		rows, err = tx.QueryContext(ctx, `UPDATE job_catalog SET last_seen_at=$2,updated_at=$2,expires_at=$3,revision=nextval('job_catalog_revision_seq') WHERE id=ANY($1) RETURNING id,revision,expires_at`, pq.Array(refreshIDs), now, now.Add(s.Lifetime))
		if err != nil {
			refreshUpdate = time.Since(phase)
			return result, fmt.Errorf("catalog refresh: %w", err)
		}
		for rows.Next() {
			var id string
			var revision int64
			var end time.Time
			if err = rows.Scan(&id, &revision, &end); err != nil {
				rows.Close()
				return result, err
			}
			job := byID[id]
			job.CatalogRevision, job.CatalogExpiresAt = revision, end
			persisted = append(persisted, job)
		}
		err = rows.Err()
		rows.Close()
		refreshUpdate = time.Since(phase)
		if err != nil {
			return result, err
		}
		if len(persisted) != len(refreshIDs) {
			return result, fmt.Errorf("catalog refresh returned incomplete batch")
		}
	}
	if len(payloads) > 0 {
		phase = time.Now()
		raw, e := json.Marshal(payloads)
		serialization += time.Since(phase)
		if e != nil {
			return result, e
		}
		conflict := `DO UPDATE SET payload=EXCLUDED.payload,last_seen_at=EXCLUDED.last_seen_at,updated_at=EXCLUDED.updated_at,expires_at=EXCLUDED.expires_at,revision=nextval('job_catalog_revision_seq')`
		if importing {
			conflict = `DO NOTHING`
		}
		phase = time.Now()
		rows, err = tx.QueryContext(ctx, `INSERT INTO job_catalog(id,payload,first_seen_at,last_seen_at,updated_at,expires_at)
 SELECT p->>'id',p,$2,$2,$2,e::timestamptz FROM jsonb_array_elements($1::jsonb) WITH ORDINALITY AS t(p,n) JOIN unnest($3::text[]) WITH ORDINALITY AS x(e,n) USING(n)
 ON CONFLICT(id) `+conflict+` RETURNING payload,revision,expires_at`, string(raw), now, pq.Array(expiry))
		upsert = time.Since(phase)
		if err != nil {
			return result, fmt.Errorf("catalog upsert: %w", err)
		}
		phase = time.Now()
		applied, e := decodeRows(rows)
		returningDecode = time.Since(phase)
		if e != nil {
			return result, e
		}
		persisted = append(persisted, applied...)
	}
	phase = time.Now()
	err = tx.Commit()
	commit = time.Since(phase)
	if err != nil {
		return jobstore.SaveResult{Invalid: result.Invalid}, fmt.Errorf("catalog commit: %w", err)
	}
	result.ContentChangeDetectionAvailable = !importing
	for i, j := range persisted {
		change := changes[j.ID]
		persisted[i].CatalogChange = change
		switch change {
		case "job_created":
			result.Inserted++
		case "job_updated":
			result.Updated++
			result.RealUpdated++
		case "job_refreshed":
			result.Updated++
			result.Refreshed++
		case "job_reactivated":
			result.Updated++
			result.Reactivated++
		}
	}
	// Keep a deterministic batch result independent of SQL RETURNING order.
	sort.Slice(persisted, func(i, j int) bool { return persisted[i].ID < persisted[j].ID })
	result.Persisted = persisted
	return result, nil
}

// sameContent compares all modeled JSON content after MergeStored. Only the
// json:"-" catalog metadata is excluded. Sources/Keywords (including nil vs
// empty) and every classification array retain order: no sorting or dedup of
// semantic contributions. Empty omitempty classification arrays serialize alike.
// The strict reader above forces updates for unknown persisted JSON fields.
func sameContent(a, b domain.Job) bool {
	a.CatalogChange, b.CatalogChange = "", ""
	a.CatalogRevision, b.CatalogRevision = 0, 0
	a.CatalogExpiresAt, b.CatalogExpiresAt = time.Time{}, time.Time{}
	canonical := func(c *domain.Classification) *domain.Classification {
		if c == nil {
			return nil
		}
		copy := *c
		if len(copy.RelatedFamilies) == 0 {
			copy.RelatedFamilies = nil
		}
		if len(copy.Technologies) == 0 {
			copy.Technologies = nil
		}
		if len(copy.Reasons) == 0 {
			copy.Reasons = nil
		}
		return &copy
	}
	a.Classification, b.Classification = canonical(a.Classification), canonical(b.Classification)
	return reflect.DeepEqual(a, b)
}

func decodeRows(rows *sql.Rows) ([]domain.Job, error) {
	defer rows.Close()
	jobs := []domain.Job{}
	for rows.Next() {
		var raw []byte
		var job domain.Job
		if err := rows.Scan(&raw, &job.CatalogRevision, &job.CatalogExpiresAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(raw, &job); err != nil {
			return nil, err
		}
		jobs = append(jobs, job)
	}
	return jobs, rows.Err()
}
func (s *Store) GetByIDs(ctx context.Context, ids []string) ([]domain.Job, error) {
	rows, err := s.DB.QueryContext(ctx, `SELECT payload,revision,expires_at FROM job_catalog WHERE id=ANY($1) AND expires_at>$2 ORDER BY id`, pq.Array(ids), s.Now().UTC())
	if err != nil {
		return nil, err
	}
	return decodeRows(rows)
}

// Batch uses a stable keyset cursor and the rebuild's fixed activity instant.
func (s *Store) Batch(ctx context.Context, after string, limit int, at time.Time) ([]domain.Job, error) {
	if limit < 1 || limit > 2500 {
		return nil, fmt.Errorf("catalog batch limit must be 1..2500")
	}
	rows, err := s.DB.QueryContext(ctx, `SELECT payload,revision,expires_at FROM job_catalog WHERE id>$1 AND expires_at>$2 ORDER BY id LIMIT $3`, after, at, limit)
	if err != nil {
		return nil, err
	}
	return decodeRows(rows)
}
func (s *Store) Sample(ctx context.Context, limit int) ([]domain.Job, error) {
	if limit < 1 || limit > 2500 {
		return nil, fmt.Errorf("bounded sample limit must be 1..2500; use streaming for full catalog")
	}
	return s.Batch(ctx, "", limit, s.Now().UTC())
}
func (s *Store) Count(ctx context.Context) (int64, error) {
	var n int64
	err := s.DB.QueryRowContext(ctx, `SELECT count(*) FROM job_catalog WHERE expires_at>$1`, s.Now().UTC()).Scan(&n)
	return n, err
}
func (s *Store) MarkIndexed(ctx context.Context, jobs []domain.Job) error {
	ids := make([]string, len(jobs))
	revisions := make([]int64, len(jobs))
	for i, j := range jobs {
		ids[i] = j.ID
		revisions[i] = j.CatalogRevision
	}
	_, err := s.DB.ExecContext(ctx, `UPDATE job_catalog c SET indexed_revision=GREATEST(indexed_revision,t.r) FROM unnest($1::text[],$2::bigint[]) AS t(id,r) WHERE c.id=t.id AND c.revision=t.r AND c.indexed_revision<t.r`, pq.Array(ids), pq.Array(revisions))
	return err
}

// Dedicated maintenance fencing is independent of scraper execution locks.
// Processing keeps a shared session lease through commit AND indexing;
// maintenance holds an exclusive lease through rebuild and pointer publication.
func (s *Store) lease(ctx context.Context, exclusive bool) (func(), error) {
	conn, err := s.DB.Conn(ctx)
	if err != nil {
		return nil, err
	}
	command := `SELECT pg_advisory_lock_shared($1)`
	unlock := `SELECT pg_advisory_unlock_shared($1)`
	if exclusive {
		command = `SELECT pg_advisory_lock($1)`
		unlock = `SELECT pg_advisory_unlock($1)`
	}
	if _, err = conn.ExecContext(ctx, command, MaintenanceLock); err != nil {
		conn.Raw(func(any) error { return driver.ErrBadConn })
		conn.Close()
		return nil, err
	}
	return func() {
		cleanup, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
		defer cancel()
		if _, err := conn.ExecContext(cleanup, unlock, MaintenanceLock); err != nil {
			conn.Raw(func(any) error { return driver.ErrBadConn })
		}
		conn.Close()
	}, nil
}
func (s *Store) ProcessingLease(ctx context.Context) (func(), error)  { return s.lease(ctx, false) }
func (s *Store) MaintenanceLease(ctx context.Context) (func(), error) { return s.lease(ctx, true) }

// Deactivate retains the historical record and produces a committed tombstone.
func (s *Store) Deactivate(ctx context.Context, ids []string) ([]domain.Job, error) {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	rows, err := tx.QueryContext(ctx, `UPDATE job_catalog SET expires_at=$2,updated_at=$2,revision=nextval('job_catalog_revision_seq') WHERE id=ANY($1) AND expires_at>$2 RETURNING payload,revision,expires_at`, pq.Array(ids), s.Now().UTC())
	if err != nil {
		return nil, err
	}
	jobs, err := decodeRows(rows)
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}
	for i := range jobs {
		jobs[i].CatalogChange = "job_removed"
	}
	return jobs, nil
}

// InactiveBatch preserves historical rows; expiration maintenance only removes
// their Valkey projection. The committed expiry itself is the lifecycle rule.
func (s *Store) InactiveBatch(ctx context.Context, after string, limit int, at time.Time) ([]domain.Job, error) {
	if limit < 1 || limit > 2500 {
		return nil, fmt.Errorf("catalog batch limit must be 1..2500")
	}
	rows, err := s.DB.QueryContext(ctx, `SELECT payload,revision,expires_at FROM job_catalog WHERE id>$1 AND expires_at<=$2 ORDER BY id LIMIT $3`, after, at, limit)
	if err != nil {
		return nil, err
	}
	return decodeRows(rows)
}

// ReclassifyBatch updates processed payloads without pretending the job was
// seen in a new collection. Lifetime and collection timestamps are preserved.
func (s *Store) ReclassifyBatch(ctx context.Context, jobs []domain.Job) ([]domain.Job, error) {
	if len(jobs) > 2500 {
		return nil, fmt.Errorf("catalog batch exceeds 2500")
	}
	if len(jobs) == 0 {
		return nil, nil
	}
	raw, err := json.Marshal(jobs)
	if err != nil {
		return nil, err
	}
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	rows, err := tx.QueryContext(ctx, `UPDATE job_catalog c SET payload=t.p,updated_at=$2,revision=nextval('job_catalog_revision_seq') FROM jsonb_array_elements($1::jsonb) AS t(p) WHERE c.id=t.p->>'id' RETURNING c.payload,c.revision,c.expires_at`, string(raw), s.Now().UTC())
	if err != nil {
		return nil, err
	}
	persisted, err := decodeRows(rows)
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, fmt.Errorf("catalog commit: %w", err)
	}
	for i := range persisted {
		persisted[i].CatalogChange = "job_reclassified"
	}
	return persisted, nil
}

// StreamActive preserves the existing administrative listing contract. A
// read-only SQL snapshot supplies count and rows; database/sql streams rows
// incrementally instead of building an unbounded []Job in the Processor.
func (s *Store) StreamActive(ctx context.Context, limit int, begin func(int64) error, emit func(domain.Job) error) error {
	tx, err := s.DB.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	if err != nil {
		return err
	}
	defer tx.Rollback()
	at := s.Now().UTC()
	var total int64
	if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM job_catalog WHERE expires_at>$1`, at).Scan(&total); err != nil {
		return err
	}
	query := `SELECT payload,revision,expires_at FROM job_catalog WHERE expires_at>$1 ORDER BY id`
	args := []any{at}
	if limit > 0 {
		query += ` LIMIT $2`
		args = append(args, limit)
	}
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return err
	}
	defer rows.Close()
	if err = begin(total); err != nil {
		return err
	}
	for rows.Next() {
		var raw []byte
		var j domain.Job
		if err = rows.Scan(&raw, &j.CatalogRevision, &j.CatalogExpiresAt); err != nil {
			return err
		}
		if err = json.Unmarshal(raw, &j); err != nil {
			return err
		}
		if err = emit(j); err != nil {
			return err
		}
	}
	if err = rows.Err(); err != nil {
		return err
	}
	return tx.Commit()
}
