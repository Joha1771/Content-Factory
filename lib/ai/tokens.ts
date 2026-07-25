import { query, queryOne } from "@/lib/db";

export const TOKEN_COSTS: Record<string, number> = {
  post_generate:  10,
  content_plan:   30,
  creative_gen:   15,
  campaign_ai:    10,
  landing_gen:    15,
  image_gen:      20,
  field_expand:    3,
  project_ai:      5,
  // legacy keys (kept for /api/tokens/spend backward compat)
  ai_chat:         5,
  ai_description:  5,
  infographic_gen: 50,
};

type SpendResult =
  | { ok: true;  remaining: number; required: number }
  | { ok: false; remaining: number; required: number };

export async function spendTokens(userId: string, action: string): Promise<SpendResult> {
  const cost = TOKEN_COSTS[action];
  if (!cost) throw new Error(`Unknown token action: ${action}`);

  // Ensure row exists
  await query(
    `INSERT INTO user_tokens (user_id, plan, tokens_total, tokens_used)
     VALUES ($1, 'free', 10000, 0)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );

  // Atomic debit: only succeeds when balance is sufficient
  const rows = await query<{ remaining: number }>(
    `UPDATE user_tokens
     SET tokens_used = tokens_used + $2, updated_at = NOW()
     WHERE user_id = $1 AND (tokens_total - tokens_used) >= $2
     RETURNING (tokens_total - tokens_used) AS remaining`,
    [userId, cost]
  );

  if (rows.length === 0) {
    const bal = await queryOne<{ tokens_total: number; tokens_used: number }>(
      "SELECT tokens_total, tokens_used FROM user_tokens WHERE user_id = $1",
      [userId]
    );
    const remaining = bal ? bal.tokens_total - bal.tokens_used : 0;
    return { ok: false, remaining, required: cost };
  }

  // Log the transaction — failure here must NOT roll back the debit
  try {
    await query(
      `INSERT INTO token_transactions (user_id, action, amount, description, meta)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, -cost, action, JSON.stringify({})]
    );
  } catch {
    // intentionally swallowed
  }

  return { ok: true, remaining: rows[0].remaining, required: cost };
}

export async function refundTokens(userId: string, action: string): Promise<void> {
  const cost = TOKEN_COSTS[action];
  if (!cost) return;

  await query(
    `UPDATE user_tokens
     SET tokens_used = GREATEST(0, tokens_used - $2), updated_at = NOW()
     WHERE user_id = $1`,
    [userId, cost]
  );

  try {
    await query(
      `INSERT INTO token_transactions (user_id, action, amount, description, meta)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, cost, `refund:${action}`, JSON.stringify({})]
    );
  } catch {
    // intentionally swallowed
  }
}
