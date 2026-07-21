ALTER TABLE "users" ADD COLUMN "technology_experiences_encrypted" text;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "career_checklist" jsonb DEFAULT '[]'::jsonb;
