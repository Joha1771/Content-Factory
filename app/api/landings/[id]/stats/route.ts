import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const row = await queryOne<{ views: number }>(
    "SELECT COALESCE(views, 0) AS views FROM landings WHERE id = $1 AND user_id = $2",
    [id, user.id]
  );
  return NextResponse.json({ views: row?.views ?? 0 });
}
