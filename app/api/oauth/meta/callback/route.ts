import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const REDIRECT_BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return NextResponse.redirect(`${REDIRECT_BASE}/ru/integrations?error=no_code`);

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(`${REDIRECT_BASE}/ru/auth/login`);

  const tokenRes = await fetch("https://graph.facebook.com/v18.0/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.NEXT_PUBLIC_META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: process.env.NEXT_PUBLIC_META_REDIRECT_URI,
      code,
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    return NextResponse.redirect(`${REDIRECT_BASE}/ru/integrations?error=meta_failed`);
  }

  const accountRes = await fetch(`https://graph.facebook.com/me/adaccounts?access_token=${tokens.access_token}&fields=id,name`);
  const accountData = await accountRes.json();
  const firstAccount = accountData.data?.[0];

  await query(
    `INSERT INTO ad_platforms (user_id, platform_key, name, color, abbr, access_token, account_id, is_active, status, updated_at)
     VALUES ($1, 'meta', 'Meta Ads', '#1877F2', 'M', $2, $3, true, 'active', NOW())`,
    [user.id, tokens.access_token, firstAccount?.id ?? null]
  );

  let returnTo = "/ru/integrations?tab=ads&success=meta";
  try {
    const rawState = req.nextUrl.searchParams.get("state") ?? "";
    const parsed = JSON.parse(rawState);
    if (typeof parsed.returnTo === "string" && parsed.returnTo.startsWith("/")) {
      returnTo = parsed.returnTo;
    }
  } catch { /* state is a plain string — keep default */ }
  return NextResponse.redirect(`${REDIRECT_BASE}${returnTo}`);
}
