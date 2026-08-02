import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${REDIRECT_BASE}/ru/integrations?error=no_code`);

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${REDIRECT_BASE}/ru/auth/login`);

  const tokenRes = await fetch("https://oauth.yandex.ru/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.NEXT_PUBLIC_YANDEX_CLIENT_ID ?? "",
      client_secret: process.env.YANDEX_CLIENT_SECRET ?? "",
      redirect_uri: process.env.NEXT_PUBLIC_YANDEX_REDIRECT_URI ?? "",
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    return NextResponse.redirect(`${REDIRECT_BASE}/ru/integrations?error=yandex_failed`);
  }

  await query(
    `INSERT INTO ad_platforms (user_id, platform_key, name, color, abbr, access_token, refresh_token, is_active, status, updated_at)
     VALUES ($1, 'yandex', 'Яндекс Директ', '#FFDB4D', 'Я', $2, $3, true, 'active', NOW())`,
    [user.id, tokens.access_token, tokens.refresh_token ?? null]
  );

  let returnTo = "/ru/integrations?tab=ads&success=yandex";
  try {
    const rawState = req.nextUrl.searchParams.get("state") ?? "";
    const parsed = JSON.parse(rawState);
    if (typeof parsed.returnTo === "string" && parsed.returnTo.startsWith("/")) {
      returnTo = parsed.returnTo;
    }
  } catch { /* no state — keep default */ }
  return NextResponse.redirect(`${REDIRECT_BASE}${returnTo}`);
}
