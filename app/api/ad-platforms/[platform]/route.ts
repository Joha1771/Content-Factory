import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { platform: id } = await params;
  const body = await request.json();
  const allowed = ["is_active", "status", "monthly_spend", "account_id", "label"];
  const sets: string[] = [];
  const vals: any[] = [];
  for (const key of allowed) {
    if (key in body) { vals.push(body[key]); sets.push(`${key} = $${vals.length}`); }
  }
  if (!sets.length) return NextResponse.json({ error: "No fields" }, { status: 400 });
  vals.push(id, user.id);
  const row = await queryOne(
    `UPDATE ad_platforms SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${vals.length - 1} AND user_id = $${vals.length} RETURNING *`,
    vals
  );
  return NextResponse.json(row);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ platform: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { platform: id } = await params;
  await query("DELETE FROM ad_platforms WHERE id = $1 AND user_id = $2", [id, user.id]);
  return NextResponse.json({ ok: true });
}
