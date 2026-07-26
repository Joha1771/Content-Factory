import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { NextResponse } from "next/server";

function generateToken() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = generateToken();
  await query(
    `INSERT INTO profiles (id, role, telegram_link_token) VALUES ($1, 'user', $2)
     ON CONFLICT (id) DO UPDATE SET telegram_link_token = EXCLUDED.telegram_link_token`,
    [user.id, token]
  );

  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "mvi_ra_bot";
  return NextResponse.json({
    token,
    instruction: `Напишите боту @${botUsername} команду:\n/link ${token}`,
    bot_url: `https://t.me/${botUsername}?start=link_${token}`,
  });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true });
}
