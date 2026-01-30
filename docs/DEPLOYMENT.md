# Deployment Guide

How to deploy Sentinel to production.

## Overview

Sentinel has two components that need to run:

1. **Next.js App** — Dashboard and API endpoints
2. **Worker Process** — Background job processing

You can run both on one server or split them. This guide covers the split approach using managed services.

## Recommended Stack

| Component | Service | Why |
|-----------|---------|-----|
| Next.js | Vercel | Zero-config, great DX, automatic previews |
| Workers | Railway | Easy process management, good logs |
| Database | Supabase | Free tier is generous, managed Postgres |
| Redis | Upstash | Serverless Redis, pay-per-request |

Total cost for a small team: ~$20-50/month after free tiers.

## Database Setup (Supabase)

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Go to Settings → Database → Connection string
4. Copy the URI (use "Transaction" mode for pooling)

```
DATABASE_URL=postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres
```

Run migrations:

```bash
DATABASE_URL="your-supabase-url" pnpm db:push
```

## Redis Setup (Upstash)

1. Create account at [upstash.com](https://upstash.com)
2. Create new Redis database
3. Copy the connection URL

```
REDIS_URL=rediss://default:[password]@[region].upstash.io:6379
```

Note the `rediss://` (with double s) for TLS.

## GitHub App Configuration

Update your GitHub App settings:

1. Go to https://github.com/settings/apps/your-app
2. Update Webhook URL: `https://your-vercel-domain.com/api/webhooks/github`
3. Ensure webhook secret matches your environment

## Next.js Deployment (Vercel)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables:

```
DATABASE_URL=postgresql://...
REDIS_URL=rediss://...
GITHUB_APP_ID=123456
GITHUB_WEBHOOK_SECRET=your-secret
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
ADMIN_API_KEY=generate-a-random-string
NEXT_PUBLIC_APP_URL=https://your-domain.vercel.app
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
RESEND_API_KEY=re_...
ALERT_EMAIL_TO=alerts@company.com
```

4. Deploy

The Next.js app handles:
- Dashboard UI
- tRPC API
- Webhook receiver
- Admin endpoints

## Worker Deployment (Railway)

Workers need a long-running process, not serverless. Railway works well.

1. Create account at [railway.app](https://railway.app)
2. Create new project from GitHub
3. Add same environment variables as Vercel
4. Set start command: `pnpm workers`
5. Deploy

The worker process handles:
- Webhook job processing
- AI detection analysis
- Scheduled metrics jobs
- Alert evaluation
- Notification delivery

### Alternative: Same Server

If you prefer running everything on one VPS:

```bash
# PM2 for process management
npm install -g pm2

# Start Next.js
pm2 start "pnpm start" --name sentinel-web

# Start workers
pm2 start "pnpm workers" --name sentinel-workers

# Save and enable startup
pm2 save
pm2 startup
```

## Environment Variables

Complete list for production:

```bash
# Database (required)
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis (required)
REDIS_URL=rediss://user:pass@host:6379

# GitHub App (required)
GITHUB_APP_ID=123456
GITHUB_WEBHOOK_SECRET=your-webhook-secret
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...multi-line key...
-----END RSA PRIVATE KEY-----"

# Admin (required)
ADMIN_API_KEY=long-random-string

# App URL (required for notifications)
NEXT_PUBLIC_APP_URL=https://sentinel.yourcompany.com

# Notifications (configure what you need)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
RESEND_API_KEY=re_xxxxxxxxxxxx
ALERT_EMAIL_TO=alerts@company.com
ALERT_EMAIL_FROM=Sentinel <alerts@yourcompany.com>
PAGERDUTY_ROUTING_KEY=your-routing-key

# Logging
LOG_LEVEL=info
```

## Custom Domain

### Vercel

1. Go to Project Settings → Domains
2. Add your domain
3. Update DNS with provided records
4. SSL is automatic

### GitHub App

After domain setup, update webhook URL in GitHub App settings.

## Health Checks

### Web App

```bash
curl https://your-domain.com/api/health
# Should return 200
```

### Workers

Check Railway logs for:
```
INFO: Workers running
INFO: Registered repeatable job: compute-metrics-daily
```

### Database

```bash
curl -X POST "https://your-domain.com/api/admin/metrics/compute?date=2026-01-01" \
  -H "X-Admin-Key: your-key"
# Should return { success: true, ... }
```

## Monitoring

### Vercel

- Built-in analytics and logs
- Function invocation metrics
- Error tracking

### Railway

- Process logs
- Memory/CPU graphs
- Restart alerts

### Recommended Additions

**Sentry** — Error tracking with stack traces

```bash
pnpm add @sentry/nextjs
```

**BetterStack** (formerly Logtail) — Log aggregation

Both have generous free tiers.

## Backup Strategy

### Database

Supabase includes:
- Daily automatic backups (7 days retention on free)
- Point-in-time recovery (paid plans)

For extra safety:
```bash
# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
```

### Redis

Upstash includes persistence. For BullMQ, jobs are recoverable from the database if Redis dies — just re-queue based on `code_events` without `code_attribution`.

## Scaling

### When Database Gets Slow

1. Check slow query logs in Supabase
2. Add missing indexes (check ARCHITECTURE.md)
3. Consider read replica for dashboard queries

### When Workers Fall Behind

1. Check queue depths: `scheduledQueue.getJobCounts()`
2. Increase concurrency in `workers/index.ts`
3. Run multiple worker instances (Railway makes this easy)

### When Webhooks Time Out

1. Webhook handler should queue immediately and return
2. Check if signature verification is slow (shouldn't be)
3. Verify Redis connection is healthy

## Troubleshooting

### "Webhook signature verification failed"

- Check `GITHUB_WEBHOOK_SECRET` matches GitHub App settings
- Ensure raw body is preserved (Next.js API route config)

### "Database connection refused"

- Check `DATABASE_URL` format
- Verify IP allowlist in Supabase (Settings → Database → Network)
- Use connection pooler URL for serverless

### "Redis connection timeout"

- Verify `REDIS_URL` uses TLS (`rediss://`)
- Check Upstash dashboard for connection issues

### "Workers not processing jobs"

- Check Railway logs for errors
- Verify Redis connection in worker process
- Check job queue: `await webhookQueue.getJobCounts()`

### "Alerts not sending"

- Check notification worker logs
- Verify Slack/Resend/PagerDuty credentials
- Test webhook URLs manually with curl
