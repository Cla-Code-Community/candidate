import {
  bigint,
  check,
  pgSequence,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

export const jobCatalogRevisionSequence = pgSequence(
  "job_catalog_revision_seq",
);

// Exact Processor Job payload, including classification. No user/saved-job FK:
// stable Processor IDs remain independent of users and collection runs.
export const jobCatalog = pgTable(
  "job_catalog",
  {
    id: text("id").primaryKey(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revision: bigint("revision", { mode: "number" })
      .default(sql`nextval('job_catalog_revision_seq')`)
      .notNull(),
    indexedRevision: bigint("indexed_revision", { mode: "number" })
      .default(0)
      .notNull(),
  },
  (table) => [
    index("job_catalog_expires_id_idx").on(table.expiresAt, table.id),
    index("job_catalog_pending_idx")
      .on(table.id)
      .where(sql`${table.indexedRevision} < ${table.revision}`),
    check(
      "job_catalog_payload_object",
      sql`jsonb_typeof(${table.payload}) = 'object'`,
    ),
    check("job_catalog_payload_id", sql`${table.payload}->>'id' = ${table.id}`),
    check("job_catalog_cycle", sql`${table.expiresAt} >= ${table.lastSeenAt}`),
  ],
);
