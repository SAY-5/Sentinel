import { createHmac, timingSafeEqual } from "crypto";

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;

export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string | null
): boolean {
  if (!WEBHOOK_SECRET) {
    throw new Error("GITHUB_WEBHOOK_SECRET not configured");
  }

  if (!signature || !signature.startsWith("sha256=")) {
    return false;
  }

  const expected =
    "sha256=" +
    createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");

  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
