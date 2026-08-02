import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const landing = await queryOne<Record<string, any>>(
    "SELECT * FROM landings WHERE id = $1 AND user_id = $2",
    [id, user.id]
  );
  if (!landing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Unpack content JSONB into flat fields expected by the editor
  const content = (typeof landing.content === "object" && landing.content !== null)
    ? landing.content as Record<string, any>
    : {};
  return NextResponse.json({
    ...landing,
    blocks: content.blocks ?? [],
    bg_image: content.bg_image ?? null,
    settings: content.settings ?? {},
    template_id: content.template_id ?? "classic",
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const allowed = ["title", "slug", "content", "published", "template_id", "meta"];
  const sets: string[] = [];
  const vals: any[] = [];
  for (const key of allowed) {
    if (key in body) { vals.push(body[key]); sets.push(`${key} = $${vals.length}`); }
  }
  if (!sets.length) return NextResponse.json({ error: "No fields" }, { status: 400 });
  vals.push(id, user.id);
  const landing = await queryOne(
    `UPDATE landings SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${vals.length - 1} AND user_id = $${vals.length} RETURNING *`,
    vals
  );
  return NextResponse.json(landing);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await query("DELETE FROM landings WHERE id = $1 AND user_id = $2", [id, user.id]);
  return NextResponse.json({ ok: true });
}
