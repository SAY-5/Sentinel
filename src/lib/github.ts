import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { createLogger } from "./logger";

const log = createLogger({ module: "github" });

const APP_ID = process.env.GITHUB_APP_ID;
const PRIVATE_KEY = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!APP_ID || !PRIVATE_KEY) {
  log.warn("GitHub App credentials not configured");
}

interface CachedToken {
  token: string;
  expires: number;
}

const tokenCache = new Map<number, CachedToken>();

export async function getInstallationClient(
  installationId: number
): Promise<Octokit> {
  if (!APP_ID || !PRIVATE_KEY) {
    throw new Error("GitHub App not configured");
  }

  const cached = tokenCache.get(installationId);
  const now = Date.now();

  // Use cached token if valid for at least 1 more minute
  if (cached && cached.expires > now + 60_000) {
    return new Octokit({ auth: cached.token });
  }

  const auth = createAppAuth({
    appId: APP_ID,
    privateKey: PRIVATE_KEY,
    installationId,
  });

  const result = await auth({ type: "installation" });

  tokenCache.set(installationId, {
    token: result.token,
    expires: new Date(result.expiresAt).getTime(),
  });

  log.debug({ installationId }, "generated installation token");

  return new Octokit({ auth: result.token });
}

export interface CommitDetails {
  sha: string;
  message: string;
  author: string;
  timestamp: Date;
  files: Array<{
    filename: string;
    additions: number;
    deletions: number;
    patch?: string;
  }>;
}

export async function getCommit(
  installationId: number,
  owner: string,
  repo: string,
  sha: string
): Promise<CommitDetails> {
  const client = await getInstallationClient(installationId);

  const { data } = await client.repos.getCommit({
    owner,
    repo,
    ref: sha,
  });

  return {
    sha: data.sha,
    message: data.commit.message,
    author: data.author?.login || data.commit.author?.name || "unknown",
    timestamp: new Date(data.commit.author?.date || Date.now()),
    files:
      data.files?.map((f) => ({
        filename: f.filename,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      })) || [],
  };
}

export interface PRDetails {
  number: number;
  title: string;
  body: string | null;
  author: string;
}

export async function getPullRequest(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRDetails> {
  const client = await getInstallationClient(installationId);

  const { data } = await client.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });

  return {
    number: data.number,
    title: data.title,
    body: data.body,
    author: data.user?.login || "unknown",
  };
}

export async function listPRCommits(
  installationId: number,
  owner: string,
  repo: string,
  prNumber: number
): Promise<string[]> {
  const client = await getInstallationClient(installationId);

  const { data } = await client.pulls.listCommits({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });

  return data.map((c) => c.sha);
}
