import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const campaign = await queryOne<{ landing_id: string | null }>(
    "SELECT landing_id FROM ad_campaigns WHERE id = $1 AND user_id = $2",
    [id, user.id]
  );
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!campaign.landing_id) return NextResponse.json({ landing_id: null, total: 0, breakdown: [] });

  const totalRow = await queryOne<{ count: string }>(
    "SELECT COUNT(*) FROM leads WHERE landing_id = $1 AND user_id = $2",
    [campaign.landing_id, user.id]
  );
  const total = Number(totalRow?.count ?? 0);

  const rows = await query<{ src: string | null; cnt: string }>(
    `SELECT source->>'utm_source' AS src, COUNT(*) AS cnt
     FROM leads
     WHERE landing_id = $1 AND user_id = $2
     GROUP BY source->>'utm_source'
     ORDER BY cnt DESC`,
    [campaign.landing_id, user.id]
  );

  return NextResponse.json({
    landing_id: campaign.landing_id,
    total,
    breakdown: rows.map((r) => ({ source: r.src || "прямой", count: Number(r.cnt) })),
  });
}
