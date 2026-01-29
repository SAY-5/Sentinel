import { Worker, Job } from "bullmq";
import { redis, scheduledQueue } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { processWebhook } from "./webhook.worker";
import { processAnalysis } from "./analysis.worker";
import { processNotification } from "./notifications.worker";
import { computeMetricsJob, type ComputeMetricsJobData } from "@/jobs/compute-metrics";
import { trackSurvivalJob, type TrackSurvivalJobData } from "@/jobs/track-survival";
import { monitorSaturationJob, type MonitorSaturationJobData } from "@/jobs/monitor-saturation";
import type { NotificationJobData } from "@/lib/queue";

const log = logger.child({ module: "workers" });

log.info("starting workers");

const webhookWorker = new Worker("webhooks", processWebhook, {
  connection: redis,
  concurrency: 5,
});

const analysisWorker = new Worker("analysis", processAnalysis, {
  connection: redis,
  concurrency: 3,
});

const notificationWorker = new Worker(
  "notifications",
  (job: Job<NotificationJobData>) => processNotification(job),
  {
    connection: redis,
    concurrency: 5,
  }
);

type ScheduledJobData = ComputeMetricsJobData | TrackSurvivalJobData | MonitorSaturationJobData;

const scheduledWorker = new Worker(
  "scheduled-jobs",
  async (job: Job<ScheduledJobData>) => {
    switch (job.name) {
      case "compute-metrics-daily":
        return await computeMetricsJob(job.data as ComputeMetricsJobData);
      case "track-survival-weekly":
        return await trackSurvivalJob(job.data as TrackSurvivalJobData);
      case "monitor-saturation-hourly":
        return await monitorSaturationJob(job.data as MonitorSaturationJobData);
      default:
        log.warn({ jobName: job.name }, "unknown scheduled job");
    }
  },
  {
    connection: redis,
    concurrency: 1,
  }
);

interface RepeatableJobConfig {
  name: string;
  pattern: string;
}

const REPEATABLE_JOBS: RepeatableJobConfig[] = [
  { name: "compute-metrics-daily", pattern: "0 2 * * *" },
  { name: "track-survival-weekly", pattern: "0 3 * * 0" },
  { name: "monitor-saturation-hourly", pattern: "0 9-18 * * 1-5" },
];

async function registerRepeatableJobs() {
  const existingJobs = await scheduledQueue.getRepeatableJobs();
  const existingNames = new Set(existingJobs.map((j) => j.name));

  let registered = 0;
  let skipped = 0;

  for (const job of REPEATABLE_JOBS) {
    if (existingNames.has(job.name)) {
      log.debug({ jobName: job.name }, "repeatable job already registered");
      skipped++;
      continue;
    }

    await scheduledQueue.add(
      job.name,
      {},
      {
        repeat: { pattern: job.pattern },
        jobId: job.name,
      }
    );
    registered++;
  }

  log.info({ registered, skipped }, "repeatable jobs initialized");
}

registerRepeatableJobs().catch((err) => {
  log.error({ err: err.message }, "failed to register repeatable jobs");
});

webhookWorker.on("completed", (job) => {
  log.debug({ jobId: job.id, queue: "webhooks" }, "job completed");
});

webhookWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, queue: "webhooks", err: err.message }, "job failed");
});

analysisWorker.on("completed", (job) => {
  log.debug({ jobId: job.id, queue: "analysis" }, "job completed");
});

analysisWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, queue: "analysis", err: err.message }, "job failed");
});

scheduledWorker.on("completed", (job) => {
  log.info({ jobId: job.id, jobName: job.name, queue: "scheduled" }, "scheduled job completed");
});

scheduledWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, jobName: job?.name, queue: "scheduled", err: err.message }, "scheduled job failed");
});

notificationWorker.on("completed", (job) => {
  log.debug({ jobId: job.id, queue: "notifications" }, "notification sent");
});

notificationWorker.on("failed", (job, err) => {
  log.error({ jobId: job?.id, queue: "notifications", err: err.message }, "notification failed");
});

async function shutdown() {
  log.info("shutting down workers");
  await webhookWorker.close();
  await analysisWorker.close();
  await notificationWorker.close();
  await scheduledWorker.close();
  await redis.quit();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

log.info("workers running");
