import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const projectId = url.searchParams.get("project_id");
  let sql = "SELECT * FROM project_files WHERE user_id = $1";
  const vals: any[] = [user.id];
  if (projectId) { vals.push(projectId); sql += ` AND project_id = $${vals.length}`; }
  sql += " ORDER BY created_at DESC";

  try {
    const rows = await query(sql, vals);
    return NextResponse.json(rows);
  } catch (err: any) {
    console.error("[project-files GET]", err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { project_id, name, file_url, file_type, size_bytes, storage_key } = await request.json();
    if (!file_url || !name) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const row = await queryOne(
      `INSERT INTO project_files (user_id, project_id, name, size, type, url, storage_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [user.id, project_id || null, name, size_bytes || 0, file_type || "document", file_url, storage_key || file_url]
    );
    return NextResponse.json(row, { status: 201 });
  } catch (err: any) {
    console.error("[project-files POST]", err?.message || err);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }
}
