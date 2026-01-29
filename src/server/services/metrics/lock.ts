import { randomUUID } from "crypto";
import { redis } from "@/lib/queue";

const LOCK_TTL_SECONDS = 3600;

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export interface LockHandle {
  key: string;
  token: string;
}

export async function acquireLock(
  jobName: string,
  repoId: string,
  date: string
): Promise<LockHandle | null> {
  const key = `lock:${jobName}:${repoId}:${date}`;
  const token = randomUUID();

  const result = await redis.set(key, token, "EX", LOCK_TTL_SECONDS, "NX");

  if (result === "OK") {
    return { key, token };
  }

  return null;
}

export async function releaseLock(handle: LockHandle): Promise<boolean> {
  const result = await redis.eval(
    RELEASE_SCRIPT,
    1,
    handle.key,
    handle.token
  );

  return result === 1;
}
