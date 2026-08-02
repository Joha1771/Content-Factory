import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const campaign = await queryOne(
    "SELECT * FROM ad_campaigns WHERE id = $1 AND user_id = $2",
    [id, user.id]
  );
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(campaign);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const allowed = ["name", "goal", "description", "status", "budget_total", "budget_spent",
    "impressions", "clicks", "leads", "sales", "revenue", "ctr", "cpl", "roas", "platforms", "landing_id"];
  const sets: string[] = [];
  const vals: any[] = [];
  for (const key of allowed) {
    if (key in body) { vals.push(body[key]); sets.push(`${key} = $${vals.length}`); }
  }
  if (!sets.length) return NextResponse.json({ error: "No fields" }, { status: 400 });
  vals.push(id, user.id);
  const campaign = await queryOne(
    `UPDATE ad_campaigns SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${vals.length - 1} AND user_id = $${vals.length} RETURNING *`,
    vals
  );
  return NextResponse.json(campaign);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await query("DELETE FROM ad_campaigns WHERE id = $1 AND user_id = $2", [id, user.id]);
  return NextResponse.json({ ok: true });
}
