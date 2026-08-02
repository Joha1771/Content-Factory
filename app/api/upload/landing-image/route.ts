import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { base64, name } = await request.json();
    if (!base64 || !name) return NextResponse.json({ error: "No file" }, { status: 400 });

    const [, data] = base64.split(",");
    if (!data) return NextResponse.json({ error: "Invalid image data" }, { status: 400 });

    const ext = (name as string).split(".").pop()?.toLowerCase() || "jpg";
    const filename = `${user.id}_${Date.now()}.${ext}`;
    const uploadDir = path.join(process.cwd(), "public", "uploads", "landings");

    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const buffer = Buffer.from(data, "base64");
    fs.writeFileSync(path.join(uploadDir, filename), buffer);

    return NextResponse.json({ url: `/uploads/landings/${filename}` });
  } catch (err: any) {
    console.error("[upload/landing-image]", err?.message || err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
