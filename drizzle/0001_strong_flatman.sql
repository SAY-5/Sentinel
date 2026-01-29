CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repo_id" uuid NOT NULL,
	"rule_name" varchar(100) NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"title" varchar(500) NOT NULL,
	"message" text NOT NULL,
	"metric_value" numeric(10, 2),
	"threshold" numeric(10, 2),
	"channels" text[] NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_repo_triggered_idx" ON "alerts" USING btree ("repo_id","triggered_at");--> statement-breakpoint
CREATE INDEX "alerts_rule_triggered_idx" ON "alerts" USING btree ("rule_name","triggered_at");--> statement-breakpoint
CREATE INDEX "alerts_severity_idx" ON "alerts" USING btree ("severity","triggered_at");