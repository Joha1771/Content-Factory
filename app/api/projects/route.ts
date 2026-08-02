import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projects = await query(
    "SELECT * FROM projects WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC",
    [user.id]
  );
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { name, niche, description, audience, tone, language, logo_url, country, phone, website, keywords } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const duplicate = await queryOne(
      "SELECT id FROM projects WHERE user_id = $1 AND lower(name) = lower($2) AND is_active = true",
      [user.id, name.trim()]
    );
    if (duplicate) return NextResponse.json({ error: "Проект с таким названием уже существует" }, { status: 409 });

    const project = await queryOne(
      `INSERT INTO projects (user_id, name, niche, description, audience, tone, language, logo_url, country, phone, website, keywords, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true) RETURNING *`,
      [user.id, name.trim(), niche || null, description || null, audience || null, tone || "friendly", language || "ru", logo_url || null, country || null, phone || null, website || null, keywords || null]
    );
    return NextResponse.json(project, { status: 201 });
  } catch (err: any) {
    console.error("[projects POST]", err?.message || err);
    return NextResponse.json({ error: err?.message || "Save failed" }, { status: 500 });
  }
}
