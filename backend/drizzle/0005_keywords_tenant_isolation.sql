DELETE FROM "keywords";--> statement-breakpoint
DROP INDEX IF EXISTS "keywords_keyword_unique";--> statement-breakpoint
ALTER TABLE "keywords" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "keywords_user_keyword_unique" ON "keywords" USING btree ("user_id","keyword");
