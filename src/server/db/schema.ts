import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  bigint,
  decimal,
  timestamp,
  date,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================================
// Enums
// ============================================================================

export const orgPlanEnum = pgEnum("org_plan", ["free", "team", "enterprise"]);

export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const githubAccountTypeEnum = pgEnum("github_account_type", [
  "organization",
  "user",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "commit",
  "pr_opened",
  "pr_reviewed",
  "pr_merged",
  "deploy",
  "incident",
]);

export const detectionMethodEnum = pgEnum("detection_method", [
  "heuristic",
  "ml_model",
  "manual_override",
]);

export const riskTierEnum = pgEnum("risk_tier", [
  "T1_boilerplate",
  "T2_glue",
  "T3_core",
  "T4_novel",
]);

export const timePeriodEnum = pgEnum("time_period", ["day", "week", "month"]);

export const incidentSeverityEnum = pgEnum("incident_severity", [
  "sev1",
  "sev2",
  "sev3",
  "sev4",
]);

export const incidentStatusEnum = pgEnum("incident_status", [
  "investigating",
  "identified",
  "resolved",
]);

// ============================================================================
// Tables
// ============================================================================

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 63 }).notNull().unique(),
  plan: orgPlanEnum("plan").notNull().default("free"),
  settings: jsonb("settings").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const organizationMembers = pgTable(
  "organization_members",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: varchar("user_id", { length: 64 }).notNull(),
    role: memberRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.orgId, table.userId] })]
);

export const githubInstallations = pgTable(
  "github_installations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    installationId: bigint("installation_id", { mode: "number" })
      .notNull()
      .unique(),
    accountLogin: varchar("account_login", { length: 255 }).notNull(),
    accountType: githubAccountTypeEnum("account_type").notNull(),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    installedAt: timestamp("installed_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("github_installations_org_id_idx").on(table.orgId)]
);

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    installationId: bigint("installation_id", { mode: "number" })
      .notNull()
      .references(() => githubInstallations.installationId),
    githubId: bigint("github_id", { mode: "number" }).notNull(),
    owner: varchar("owner", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    defaultBranch: varchar("default_branch", { length: 255 })
      .notNull()
      .default("main"),
    isActive: boolean("is_active").notNull().default(true),
    settings: jsonb("settings").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("repositories_installation_github_id_idx").on(
      table.installationId,
      table.githubId
    ),
    index("repositories_org_id_idx").on(table.orgId),
  ]
);

export const codeEvents = pgTable(
  "code_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    eventType: eventTypeEnum("event_type").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    commitSha: varchar("commit_sha", { length: 40 }),
    prNumber: integer("pr_number"),
    authorLogin: varchar("author_login", { length: 255 }).notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("code_events_repo_timestamp_idx").on(table.repoId, table.timestamp),
    index("code_events_commit_sha_idx")
      .on(table.commitSha)
      .where(sql`commit_sha IS NOT NULL`),
    index("code_events_repo_type_timestamp_idx").on(
      table.repoId,
      table.eventType,
      table.timestamp
    ),
  ]
);

export const codeAttribution = pgTable(
  "code_attribution",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    commitSha: varchar("commit_sha", { length: 40 }).notNull(),
    filePath: text("file_path").notNull(),
    aiConfidence: decimal("ai_confidence", { precision: 3, scale: 2 }).notNull(),
    detectionMethod: detectionMethodEnum("detection_method").notNull(),
    detectionSignals: jsonb("detection_signals").notNull().default({}),
    complexityCyclomatic: integer("complexity_cyclomatic"),
    complexityCognitive: integer("complexity_cognitive"),
    riskTier: riskTierEnum("risk_tier").notNull(),
    riskScore: decimal("risk_score", { precision: 3, scale: 2 }).notNull(),
    riskExplanation: text("risk_explanation"),
    linesAdded: integer("lines_added").notNull().default(0),
    linesDeleted: integer("lines_deleted").notNull().default(0),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("code_attribution_commit_file_idx").on(
      table.commitSha,
      table.filePath
    ),
    index("code_attribution_repo_confidence_idx").on(
      table.repoId,
      table.aiConfidence
    ),
    index("code_attribution_repo_risk_created_idx").on(
      table.repoId,
      table.riskTier,
      table.createdAt
    ),
  ]
);

export const repoMetrics = pgTable(
  "repo_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    period: timePeriodEnum("period").notNull(),
    totalCommits: integer("total_commits").notNull().default(0),
    aiCommits: integer("ai_commits").notNull().default(0),
    humanCommits: integer("human_commits").notNull().default(0),
    aiCodePercentage: decimal("ai_code_percentage", {
      precision: 5,
      scale: 2,
    }).notNull(),
    avgReviewTimeMins: decimal("avg_review_time_mins", {
      precision: 10,
      scale: 2,
    }),
    highRiskFileCount: integer("high_risk_file_count").notNull().default(0),
    incidentCount: integer("incident_count").notNull().default(0),
    verificationTaxHours: decimal("verification_tax_hours", {
      precision: 10,
      scale: 2,
    }),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("repo_metrics_repo_date_period_idx").on(
      table.repoId,
      table.date,
      table.period
    ),
    index("repo_metrics_repo_date_idx").on(table.repoId, table.date),
  ]
);

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    externalId: varchar("external_id", { length: 255 }),
    title: text("title").notNull(),
    severity: incidentSeverityEnum("severity").notNull(),
    status: incidentStatusEnum("status").notNull().default("investigating"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    suspectedCommitSha: varchar("suspected_commit_sha", { length: 40 }),
    affectedFiles: text("affected_files").array(),
    aiAttributed: boolean("ai_attributed"),
    rootCause: text("root_cause"),
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("incidents_repo_detected_idx").on(table.repoId, table.detectedAt),
    index("incidents_commit_sha_idx")
      .on(table.suspectedCommitSha)
      .where(sql`suspected_commit_sha IS NOT NULL`),
  ]
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    scopes: text("scopes").array().notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("api_keys_key_hash_idx").on(table.keyHash),
    index("api_keys_org_id_idx").on(table.orgId),
  ]
);

export const alertSeverityEnum = pgEnum("alert_severity", [
  "info",
  "warning",
  "critical",
]);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: uuid("repo_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    ruleName: varchar("rule_name", { length: 100 }).notNull(),
    severity: alertSeverityEnum("severity").notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    message: text("message").notNull(),
    metricValue: decimal("metric_value", { precision: 10, scale: 2 }),
    threshold: decimal("threshold", { precision: 10, scale: 2 }),
    channels: text("channels").array().notNull(),
    metadata: jsonb("metadata").notNull().default({}),
    triggeredAt: timestamp("triggered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    acknowledgedBy: varchar("acknowledged_by", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("alerts_repo_triggered_idx").on(table.repoId, table.triggeredAt),
    index("alerts_rule_triggered_idx").on(table.ruleName, table.triggeredAt),
    index("alerts_severity_idx").on(table.severity, table.triggeredAt),
  ]
);

// ============================================================================
// Type Exports
// ============================================================================

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;

export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type NewOrganizationMember = typeof organizationMembers.$inferInsert;

export type GithubInstallation = typeof githubInstallations.$inferSelect;
export type NewGithubInstallation = typeof githubInstallations.$inferInsert;

export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;

export type CodeEvent = typeof codeEvents.$inferSelect;
export type NewCodeEvent = typeof codeEvents.$inferInsert;

export type CodeAttribution = typeof codeAttribution.$inferSelect;
export type NewCodeAttribution = typeof codeAttribution.$inferInsert;

export type RepoMetric = typeof repoMetrics.$inferSelect;
export type NewRepoMetric = typeof repoMetrics.$inferInsert;

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type Alert = typeof alerts.$inferSelect;
export type NewAlert = typeof alerts.$inferInsert;
