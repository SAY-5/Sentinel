CREATE TYPE "public"."detection_method" AS ENUM('heuristic', 'ml_model', 'manual_override');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('commit', 'pr_opened', 'pr_reviewed', 'pr_merged', 'deploy', 'incident');--> statement-breakpoint
CREATE TYPE "public"."github_account_type" AS ENUM('organization', 'user');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('sev1', 'sev2', 'sev3', 'sev4');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('investigating', 'identified', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."org_plan" AS ENUM('free', 'team', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."risk_tier" AS ENUM('T1_boilerplate', 'T2_glue', 'T3_core', 'T4_novel');--> statement-breakpoint
CREATE TYPE "public"."time_period" AS ENUM('day', 'week', 'month');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"scopes" text[] NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "code_attribution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"commit_sha" varchar(40) NOT NULL,
	"file_path" text NOT NULL,
	"ai_confidence" numeric(3, 2) NOT NULL,
	"detection_method" "detection_method" NOT NULL,
	"detection_signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"complexity_cyclomatic" integer,
	"complexity_cognitive" integer,
	"risk_tier" "risk_tier" NOT NULL,
	"risk_score" numeric(3, 2) NOT NULL,
	"risk_explanation" text,
	"lines_added" integer DEFAULT 0 NOT NULL,
	"lines_deleted" integer DEFAULT 0 NOT NULL,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "code_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"event_type" "event_type" NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"commit_sha" varchar(40),
	"pr_number" integer,
	"author_login" varchar(255) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"installation_id" bigint NOT NULL,
	"account_login" varchar(255) NOT NULL,
	"account_type" "github_account_type" NOT NULL,
	"suspended_at" timestamp with time zone,
	"installed_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_installations_installation_id_unique" UNIQUE("installation_id")
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"external_id" varchar(255),
	"title" text NOT NULL,
	"severity" "incident_severity" NOT NULL,
	"status" "incident_status" DEFAULT 'investigating' NOT NULL,
	"detected_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"suspected_commit_sha" varchar(40),
	"affected_files" text[],
	"ai_attributed" boolean,
	"root_cause" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"org_id" uuid NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_members_org_id_user_id_pk" PRIMARY KEY("org_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(63) NOT NULL,
	"plan" "org_plan" DEFAULT 'free' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "repo_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"date" date NOT NULL,
	"period" time_period NOT NULL,
	"total_commits" integer DEFAULT 0 NOT NULL,
	"ai_commits" integer DEFAULT 0 NOT NULL,
	"human_commits" integer DEFAULT 0 NOT NULL,
	"ai_code_percentage" numeric(5, 2) NOT NULL,
	"avg_review_time_mins" numeric(10, 2),
	"high_risk_file_count" integer DEFAULT 0 NOT NULL,
	"incident_count" integer DEFAULT 0 NOT NULL,
	"verification_tax_hours" numeric(10, 2),
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"installation_id" bigint NOT NULL,
	"github_id" bigint NOT NULL,
	"owner" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"default_branch" varchar(255) DEFAULT 'main' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_attribution" ADD CONSTRAINT "code_attribution_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_events" ADD CONSTRAINT "code_events_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repo_metrics" ADD CONSTRAINT "repo_metrics_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_installation_id_github_installations_installation_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."github_installations"("installation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE INDEX "api_keys_org_id_idx" ON "api_keys" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "code_attribution_commit_file_idx" ON "code_attribution" USING btree ("commit_sha","file_path");--> statement-breakpoint
CREATE INDEX "code_attribution_repo_confidence_idx" ON "code_attribution" USING btree ("repo_id","ai_confidence");--> statement-breakpoint
CREATE INDEX "code_attribution_repo_risk_created_idx" ON "code_attribution" USING btree ("repo_id","risk_tier","created_at");--> statement-breakpoint
CREATE INDEX "code_events_repo_timestamp_idx" ON "code_events" USING btree ("repo_id","timestamp");--> statement-breakpoint
CREATE INDEX "code_events_commit_sha_idx" ON "code_events" USING btree ("commit_sha") WHERE commit_sha IS NOT NULL;--> statement-breakpoint
CREATE INDEX "code_events_repo_type_timestamp_idx" ON "code_events" USING btree ("repo_id","event_type","timestamp");--> statement-breakpoint
CREATE INDEX "github_installations_org_id_idx" ON "github_installations" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "incidents_repo_detected_idx" ON "incidents" USING btree ("repo_id","detected_at");--> statement-breakpoint
CREATE INDEX "incidents_commit_sha_idx" ON "incidents" USING btree ("suspected_commit_sha") WHERE suspected_commit_sha IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "repo_metrics_repo_date_period_idx" ON "repo_metrics" USING btree ("repo_id","date","period");--> statement-breakpoint
CREATE INDEX "repo_metrics_repo_date_idx" ON "repo_metrics" USING btree ("repo_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_installation_github_id_idx" ON "repositories" USING btree ("installation_id","github_id");--> statement-breakpoint
CREATE INDEX "repositories_org_id_idx" ON "repositories" USING btree ("org_id");