CREATE TABLE "permission_rules" (
	"resource" varchar(50) NOT NULL,
	"action" varchar(50) NOT NULL,
	"min_role" "user_role" NOT NULL,
	"reason" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "permission_rules_resource_action_pk" PRIMARY KEY("resource","action")
);
