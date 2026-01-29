# Sentinel - Project Plan

## Overview

Sentinel is an AI Code Safety observability platform for engineering teams shipping AI-generated code at scale.

---

## Phase 1: Database Schema & Core Types ✅

**Status:** Complete  
**Completed:** 2026-01-27

### Deliverables
- [x] PostgreSQL schema with Drizzle ORM (9 tables)
- [x] Connection pooling and database client
- [x] Migration system with drizzle-kit
- [x] Seed script with realistic test data
- [x] Database documentation

### Tables Created
- `organizations` - Multi-tenant root
- `organization_members` - User→Org mapping (Clerk user IDs)
- `github_installations` - GitHub App installs
- `repositories` - Tracked repos
- `code_events` - Raw webhook telemetry
- `code_attribution` - AI detection results
- `repo_metrics` - Pre-computed aggregates
- `incidents` - Production issues
- `api_keys` - Programmatic access

---

## Phase 2: GitHub Integration ✅

**Status:** Complete  
**Completed:** 2026-01-27

### Deliverables
- [x] Webhook receiver (POST /api/webhooks/github)
- [x] BullMQ job queue setup
- [x] Event processor workers
- [x] AI detection heuristics
- [x] GitHub API client (Octokit wrapper)

### Files Created
- `src/app/api/webhooks/github/route.ts` - Webhook endpoint
- `src/lib/queue.ts` - BullMQ queue definitions
- `src/lib/github.ts` - Octokit wrapper with token caching
- `src/lib/crypto.ts` - Webhook signature verification
- `src/lib/logger.ts` - Pino structured logging
- `src/workers/index.ts` - Worker entrypoint
- `src/workers/webhook.worker.ts` - Webhook processing
- `src/workers/analysis.worker.ts` - AI detection processing
- `src/analysis/detector.ts` - Detection orchestrator
- `src/analysis/risk.ts` - Risk classification
- `src/analysis/signals/*.ts` - Individual detection signals

---

## Phase 3: Dashboard & Frontend ✅

**Status:** Complete  
**Completed:** 2026-01-27

### Deliverables
- [x] tRPC setup (server + client + providers)
- [x] Dashboard layout with sidebar navigation
- [x] Overview page (metrics + charts)
- [x] Events page (paginated event feed)
- [x] Risk Analysis page (files sorted by risk)
- [x] Incidents page (with AI attribution)

### Files Created
- `src/server/trpc.ts` - tRPC initialization
- `src/server/routers/metrics.ts` - Metrics queries
- `src/server/routers/events.ts` - Events queries
- `src/server/routers/incidents.ts` - Incidents queries
- `src/app/api/trpc/[trpc]/route.ts` - HTTP handler
- `src/app/providers.tsx` - React Query + tRPC providers
- `src/app/dashboard/layout.tsx` - Dashboard layout
- `src/app/dashboard/page.tsx` - Overview page
- `src/app/dashboard/events/page.tsx` - Events page
- `src/app/dashboard/risk/page.tsx` - Risk page
- `src/app/dashboard/incidents/page.tsx` - Incidents page
- `src/components/dashboard/*.tsx` - Reusable components

---

## Phase 4: Metrics Computation Engine ✅

**Status:** Complete  
**Completed:** 2026-01-27

### Deliverables
- [x] Daily metrics computation (cron 2am)
- [x] Code survival rate tracking (weekly)
- [x] Review saturation monitoring (hourly weekdays)
- [x] Service layer with proper separation
- [x] Redis locking for idempotency
- [x] Admin API for manual triggers
- [x] BullMQ repeatable jobs

### Files Created
- `src/server/services/metrics/daily.ts` - Daily metrics computation
- `src/server/services/metrics/survival.ts` - Survival tracking
- `src/server/services/metrics/saturation.ts` - Saturation monitoring
- `src/jobs/compute-metrics.ts` - Metrics job wrapper
- `src/jobs/track-survival.ts` - Survival job wrapper
- `src/jobs/monitor-saturation.ts` - Saturation job wrapper
- `src/app/api/admin/metrics/[action]/route.ts` - Admin endpoints

---

## Phase 5: Alerting & Notifications ✅

**Status:** Complete  
**Completed:** 2026-01-27

### Deliverables
- [x] Alert rules engine (7 rules)
- [x] Slack integration
- [x] Notification worker + queue
- [x] Alerts dashboard page
- [x] Acknowledge endpoint
- [x] Integration with metrics job

### Alert Rules
1. `ai_code_high` - AI code >70% (warning)
2. `ai_code_critical` - AI code >90% (critical)
3. `verification_tax_spike` - Tax >1.5x last week (warning)
4. `verification_tax_absolute` - Tax >80h/week (critical)
5. `review_saturation_high` - Saturation >0.8 (warning)
6. `high_risk_deployed` - Deploy with T4 files (critical)
7. `incident_ai_attributed` - AI incident (critical)

### Files Created
- `src/server/db/schema.ts` - Added alerts table
- `src/alerts/types.ts` - Alert type definitions
- `src/alerts/rules.ts` - 7 alert rule implementations
- `src/alerts/evaluator.ts` - Alert evaluation + deduplication
- `src/integrations/slack.ts` - Slack webhook integration
- `src/workers/notifications.worker.ts` - Notification worker
- `src/server/routers/alerts.ts` - Alerts tRPC router
- `src/app/dashboard/alerts/page.tsx` - Alerts dashboard page
- `src/app/dashboard/alerts/alerts-table.tsx` - Alerts table component
- `src/components/dashboard/severity-badge.tsx` - Severity badge
- `src/app/api/alerts/[id]/acknowledge/route.ts` - Acknowledge endpoint

---

## Phase 6: API & CLI

**Status:** Not Started

### Deliverables
- [ ] Public REST API
- [ ] API key authentication
- [ ] CLI tool for CI/CD integration
- [ ] SDK for custom integrations

---

## Phase 7: Production Readiness

**Status:** Not Started

### Deliverables
- [ ] Authentication with Clerk
- [ ] Multi-organization support
- [ ] Email notifications (SendGrid)
- [ ] PagerDuty integration
- [ ] Performance optimization
- [ ] Error monitoring (Sentry)
