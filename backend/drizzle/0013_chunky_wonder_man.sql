CREATE TABLE "application_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"saved_job_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"from_status" varchar(50) NOT NULL,
	"to_status" varchar(50) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_saved_job_id_saved_jobs_id_fk" FOREIGN KEY ("saved_job_id") REFERENCES "public"."saved_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_events_saved_job_id_created_at_idx" ON "application_events" USING btree ("saved_job_id","created_at");