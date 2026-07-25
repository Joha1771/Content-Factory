import { query } from "@/lib/db";

export function getClientIp(req: Request): string {
  return (
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfter: number;
}

export async function rateLimit(
  bucket: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  try {
    const rows = await query<{ count: number; reset_at: string }>(
      `INSERT INTO rate_limits (bucket, count, reset_at)
       VALUES ($1, 1, NOW() + make_interval(secs => $2))
       ON CONFLICT (bucket) DO UPDATE SET
         count = CASE WHEN rate_limits.reset_at < NOW() THEN 1
                      ELSE rate_limits.count + 1 END,
         reset_at = CASE WHEN rate_limits.reset_at < NOW()
                         THEN NOW() + make_interval(secs => $2)
                         ELSE rate_limits.reset_at END
       RETURNING count, reset_at`,
      [bucket, windowSec]
    );

    const row = rows[0];
    const resetMs = new Date(row.reset_at).getTime() - Date.now();
    const retryAfter = Math.ceil(resetMs / 1000);
    const remaining = Math.max(0, limit - row.count);

    return { ok: row.count <= limit, remaining, retryAfter };
  } catch {
    // fail-open: rate limiter failure must not break auth/generation
    return { ok: true, remaining: limit, retryAfter: 0 };
  }
}
