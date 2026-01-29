import { Queue } from "bullmq";
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  throw new Error("REDIS_URL environment variable is required");
}

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 1000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};

export const webhookQueue = new Queue("webhooks", {
  connection: redis,
  defaultJobOptions,
});

export const analysisQueue = new Queue("analysis", {
  connection: redis,
  defaultJobOptions: {
    ...defaultJobOptions,
    backoff: { type: "exponential" as const, delay: 2000 },
  },
});

export const scheduledQueue = new Queue("scheduled-jobs", {
  connection: redis,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 1,
  },
});

export const notificationQueue = new Queue("notifications", {
  connection: redis,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 3,
    backoff: { type: "exponential" as const, delay: 5000 },
  },
});

export interface NotificationJobData {
  alertId: string;
}

export type GitHubEventType =
  | "push"
  | "pull_request"
  | "pull_request_review"
  | "deployment_status";

export interface WebhookJobData {
  deliveryId: string;
  event: GitHubEventType;
  installationId: number;
  repoId: string;
  payload: unknown;
  receivedAt: string;
}

export interface AnalysisJobData {
  repoId: string;
  commitSha: string;
  eventId: string;
  installationId: number;
  owner: string;
  repo: string;
}
