import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { query, queryOne } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/mailer";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rlIp = await rateLimit(`forgot-ip:${ip}`, 5, 3600);
    if (!rlIp.ok) {
      return NextResponse.json(
        { error: "too_many_requests", retryAfter: rlIp.retryAfter },
        { status: 429, headers: { "Retry-After": String(rlIp.retryAfter) } }
      );
    }

    const { email, locale = "ru" } = await req.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email обязателен" }, { status: 400 });
    }

    const rlEmail = await rateLimit(`forgot-email:${email.toLowerCase().trim()}`, 3, 3600);
    if (!rlEmail.ok) {
      return NextResponse.json(
        { error: "too_many_requests", retryAfter: rlEmail.retryAfter },
        { status: 429, headers: { "Retry-After": String(rlEmail.retryAfter) } }
      );
    }

    const user = await queryOne<{ id: string; email: string }>(
      "SELECT id, email FROM users WHERE email = $1",
      [email.toLowerCase().trim()]
    );

    // Always return success to not reveal whether email exists
    if (!user) {
      return NextResponse.json({ ok: true });
    }

    // Invalidate old tokens for this user
    await query(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
      [user.id]
    );

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await query(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
      [user.id, token, expiresAt]
    );

    await sendPasswordResetEmail(user.email, token, locale);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("forgot-password error:", err);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
