import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { hashPassword, createToken, COOKIE_NAME } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rl = await rateLimit(`register:${ip}`, 5, 3600);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "too_many_requests", retryAfter: rl.retryAfter },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const { email, password, full_name } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email и пароль обязательны" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Пароль минимум 6 символов" }, { status: 400 });
    }

    const existing = await queryOne("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing) {
      return NextResponse.json({ error: "Пользователь с таким email уже существует" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);
    const [user] = await query<{ id: string; email: string }>(
      `INSERT INTO users (email, password_hash, full_name, created_at)
       VALUES ($1, $2, $3, NOW()) RETURNING id, email`,
      [email.toLowerCase(), passwordHash, full_name || null]
    );

    // Create default workspace and add owner as member
    const [workspace] = await query<{ id: string }>(
      `INSERT INTO workspaces (name, owner_id, created_at) VALUES ($1, $2, NOW()) RETURNING id`,
      ["Мой воркспейс", user.id]
    );
    if (workspace) {
      await query(
        `INSERT INTO workspace_members (workspace_id, user_id, email, role, status) VALUES ($1, $2, $3, 'owner', 'active') ON CONFLICT DO NOTHING`,
        [workspace.id, user.id, user.email]
      );
    }

    // Create token_balance row
    await query(
      `INSERT INTO user_tokens (user_id, plan, tokens_total, tokens_used) VALUES ($1, 'free', 10000, 0) ON CONFLICT DO NOTHING`,
      [user.id]
    );

    const token = createToken(user.id, user.email);
    const res = NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
    return res;
  } catch (e: any) {
    console.error("Register error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
