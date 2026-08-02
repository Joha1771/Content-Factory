import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { comparePassword, createToken, COOKIE_NAME } from "@/lib/auth";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rlIp = await rateLimit(`login-ip:${ip}`, 10, 900);
    if (!rlIp.ok) {
      return NextResponse.json(
        { error: "too_many_requests", retryAfter: rlIp.retryAfter },
        { status: 429, headers: { "Retry-After": String(rlIp.retryAfter) } }
      );
    }

    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email и пароль обязательны" }, { status: 400 });
    }

    const rlEmail = await rateLimit(`login-email:${String(email).toLowerCase()}`, 5, 900);
    if (!rlEmail.ok) {
      return NextResponse.json(
        { error: "too_many_requests", retryAfter: rlEmail.retryAfter },
        { status: 429, headers: { "Retry-After": String(rlEmail.retryAfter) } }
      );
    }

    const user = await queryOne<{ id: string; email: string; password_hash: string; full_name: string }>(
      "SELECT id, email, password_hash, full_name FROM users WHERE email = $1",
      [email.toLowerCase()]
    );

    if (!user) {
      return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
    }

    const token = createToken(user.id, user.email);
    const res = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, full_name: user.full_name } });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return res;
  } catch (e: any) {
    console.error("Login error:", e);
    return NextResponse.json({ error: "Ошибка сервера" }, { status: 500 });
  }
}
