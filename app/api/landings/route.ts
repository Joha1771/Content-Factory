import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const landings = await query(
    `SELECT l.id, l.title, l.slug, l.published,
       l.content,
       l.content->>'template_id'        AS template_id,
       l.content->'settings'->>'logoUrl' AS logo_url,
       l.created_at, l.updated_at,
       COALESCE(l.views, 0)::int         AS views,
       COUNT(ld.id)::int                 AS leads_count
     FROM landings l
     LEFT JOIN leads ld ON ld.landing_id = l.id
     WHERE l.user_id = $1
     GROUP BY l.id
     ORDER BY l.created_at DESC`,
    [user.id]
  );
  return NextResponse.json(landings);
}
