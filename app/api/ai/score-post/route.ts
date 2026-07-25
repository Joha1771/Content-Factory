import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { NextResponse } from "next/server";
import { spendTokens, refundTokens } from "@/lib/ai/tokens";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await spendTokens(user.id, "project_ai");
  if (!gate.ok) return NextResponse.json({ error: "insufficient_tokens", remaining: gate.remaining, required: gate.required }, { status: 402 });

  const { contentId } = await request.json();

  const content = await queryOne<any>(
    `SELECT c.*, p.name as project_name, p.niche as project_niche, p.tone as project_tone
     FROM contents c
     LEFT JOIN projects p ON c.project_id = p.id
     WHERE c.id = $1 AND (c.user_id = $2 OR p.user_id = $2)`,
    [contentId, user.id]
  );

  if (!content) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const prompt = `Оцени этот пост для Instagram/Telegram от 0 до 100 по четырём критериям.

БРЕНД: ${content.project_name}, Ниша: ${content.project_niche}, Тон: ${content.project_tone}

ПОСТ:
Хук: ${content.hook || "—"}
Текст: ${content.caption || "—"}
CTA: ${content.cta || "—"}
Хэштеги: ${(content.hashtags || []).join(", ")}

Ответь ТОЛЬКО JSON:
{
  "virality": число от 0 до 100,
  "tone_match": число от 0 до 100,
  "brand_match": число от 0 до 100,
  "overall": число от 0 до 100,
  "tip": "одна конкретная рекомендация как улучшить пост"
}`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { text: string }).text;
    const clean = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const score = JSON.parse(clean);

    return NextResponse.json({ score });
  } catch (err: any) {
    await refundTokens(user.id, "project_ai");
    console.error("[ai/score-post]", err?.message || err);
    return NextResponse.json({ error: err?.message || "AI error" }, { status: 500 });
  }
}
