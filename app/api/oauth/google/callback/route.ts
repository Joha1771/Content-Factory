import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${REDIRECT_BASE}/ru/integrations?error=no_code`);

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${REDIRECT_BASE}/ru/auth/login`);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI ?? "",
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    return NextResponse.redirect(`${REDIRECT_BASE}/ru/integrations?error=google_failed`);
  }

  await query(
    `INSERT INTO ad_platforms (user_id, platform_key, name, color, abbr, access_token, refresh_token, token_expires_at, is_active, status, updated_at)
     VALUES ($1, 'google', 'Google Ads', '#34A853', 'G', $2, $3, $4, true, 'active', NOW())
     ON CONFLICT (user_id, platform_key) DO UPDATE SET access_token = $2, refresh_token = $3, token_expires_at = $4, is_active = true, updated_at = NOW()`,
    [user.id, tokens.access_token, tokens.refresh_token ?? null,
      tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null]
  );

  let returnTo = "/ru/integrations?tab=ads&success=google";
  try {
    const rawState = req.nextUrl.searchParams.get("state") ?? "";
    const parsed = JSON.parse(rawState);
    if (typeof parsed.returnTo === "string" && parsed.returnTo.startsWith("/")) {
      returnTo = parsed.returnTo;
    }
  } catch { /* no state — keep default */ }
  return NextResponse.redirect(`${REDIRECT_BASE}${returnTo}`);
}
