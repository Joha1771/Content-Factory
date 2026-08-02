import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const creatives = await query(
    `SELECT ac.* FROM ad_creatives ac
     JOIN ad_campaigns c ON ac.campaign_id = c.id
     WHERE ac.campaign_id = $1 AND c.user_id = $2
     ORDER BY ac.created_at DESC`,
    [id, user.id]
  );
  return NextResponse.json(creatives);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { creatives } = body;

  if (!Array.isArray(creatives) || creatives.length === 0) {
    return NextResponse.json({ error: "No creatives" }, { status: 400 });
  }

  const inserted: any[] = [];
  for (const c of creatives) {
    const rows = await query<any>(
      `INSERT INTO ad_creatives (campaign_id, user_id, platform, format, content, status, ai_generated)
       VALUES ($1, $2, $3, $4, $5::jsonb, 'draft', true)
       RETURNING *`,
      [id, user.id, c.platform ?? null, c.subtype ?? c.format ?? null, JSON.stringify(c)]
    );
    inserted.push(...rows);
  }
  return NextResponse.json(inserted, { status: 201 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: campaignId } = await params;
  const url = new URL(request.url);
  const creativeId = url.searchParams.get("creativeId");
  if (!creativeId) return NextResponse.json({ error: "Missing creativeId" }, { status: 400 });

  const body = await request.json();
  const creative = await queryOne(
    `UPDATE ad_creatives SET status = $1 WHERE id = $2 AND campaign_id = $3 RETURNING *`,
    [body.status, creativeId, campaignId]
  );
  return NextResponse.json(creative);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { section } = body;

  const SOCIAL_KEYS = ["instagram", "telegram", "tiktok", "youtube"];
  const AD_KEYS = ["meta", "google", "yandex"];
  const platformKeys = section === "social" ? SOCIAL_KEYS : section === "ads" ? AD_KEYS : null;

  if (platformKeys) {
    await query(
      `DELETE FROM ad_creatives WHERE campaign_id = $1 AND user_id = $2 AND platform = ANY($3::text[])`,
      [id, user.id, platformKeys]
    );
  } else {
    await query(
      `DELETE FROM ad_creatives WHERE campaign_id = $1 AND user_id = $2 AND ai_generated = true`,
      [id, user.id]
    );
  }
  return NextResponse.json({ ok: true });
}
