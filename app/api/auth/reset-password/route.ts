import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { query, queryOne } from "@/lib/db";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = await rateLimit(`reset:${ip}`, 10, 3600);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "too_many_requests", retryAfter: rl.retryAfter },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Токен и пароль обязательны" }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Пароль минимум 6 символов" }, { status: 400 });
    }

    const row = await queryOne<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
      "SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token = $1",
      [token]
    );

    if (!row) {
      return NextResponse.json({ error: "Ссылка недействительна" }, { status: 400 });
    }

    if (row.used_at) {
      return NextResponse.json({ error: "Ссылка уже была использована" }, { status: 400 });
    }

    if (new Date(row.expires_at) < new Date()) {
      return NextResponse.json({ error: "Ссылка устарела. Запросите новую." }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 12);

    await query("UPDATE users SET password_hash = $1 WHERE id = $2", [hashed, row.user_id]);
    await query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1", [row.id]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("reset-password error:", err);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
