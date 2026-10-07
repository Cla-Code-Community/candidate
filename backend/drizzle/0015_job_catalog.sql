CREATE SEQUENCE "job_catalog_revision_seq";
--> statement-breakpoint
CREATE TABLE "job_catalog" (
  "id" text PRIMARY KEY NOT NULL,
  "payload" jsonb NOT NULL,
  "first_seen_at" timestamptz DEFAULT now() NOT NULL,
  "last_seen_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "revision" bigint DEFAULT nextval('job_catalog_revision_seq') NOT NULL,
  "indexed_revision" bigint DEFAULT 0 NOT NULL,
  CONSTRAINT "job_catalog_payload_object" CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT "job_catalog_payload_id" CHECK (payload->>'id' = id),
  CONSTRAINT "job_catalog_cycle" CHECK (expires_at >= last_seen_at)
);
--> statement-breakpoint
CREATE INDEX "job_catalog_expires_id_idx" ON "job_catalog" ("expires_at", "id");
--> statement-breakpoint
CREATE INDEX "job_catalog_pending_idx" ON "job_catalog" ("id") WHERE indexed_revision < revision;
