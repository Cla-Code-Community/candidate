ALTER TABLE "credentials" ADD COLUMN "email_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_name_encrypted" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name_encrypted" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_name_encrypted" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_encrypted" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone_encrypted" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cpf_encrypted" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cpf_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_hash_unique" ON "users" USING btree ("email_hash");--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_email_hash_unique" UNIQUE("email_hash");
