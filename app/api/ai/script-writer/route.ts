import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { NextResponse } from "next/server";
import { spendTokens, refundTokens } from "@/lib/ai/tokens";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await spendTokens(user.id, "creative_gen");
  if (!gate.ok) return NextResponse.json({ error: "insufficient_tokens", remaining: gate.remaining, required: gate.required }, { status: 402 });

  const { projectId, topic, duration = 30, platform = "instagram" } = await request.json();

  const project = await queryOne<any>(
    "SELECT * FROM projects WHERE id = $1 AND user_id = $2",
    [projectId, user.id]
  );
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const prompt = `Ты AI Script Writer. Пишешь сценарии для коротких видео.

БРЕНД: ${project.name}
НИША: ${project.niche || "общий бизнес"}
АУДИТОРИЯ: ${project.audience || "широкая"}
ТОН: ${project.tone}
ПЛАТФОРМА: ${platform} (Reels/TikTok)
ТЕМА: ${topic}
ДЛИТЕЛЬНОСТЬ: ${duration} секунд

Напиши готовый сценарий для видео.

Ответь ТОЛЬКО JSON:
{
  "title": "заголовок видео",
  "hook": "первые 3 секунды — самое важное",
  "scenes": [
    {
      "seconds": "0-5",
      "visual": "что показывать на экране",
      "voiceover": "текст за кадром",
      "text_on_screen": "текст на экране (если нужен)",
      "action": "что делать"
    }
  ],
  "cta": "призыв к действию в конце",
  "caption": "подпись к видео",
  "hashtags": ["хэштег1", "хэштег2", "хэштег3"],
  "filming_tips": ["совет по съёмке1", "совет2"],
  "estimated_duration": ${duration}
}`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { text: string }).text;
    const clean = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const script = JSON.parse(clean);

    return NextResponse.json({ script });
  } catch (err: any) {
    await refundTokens(user.id, "creative_gen");
    console.error("[ai/script-writer]", err?.message || err);
    return NextResponse.json({ error: err?.message || "AI error" }, { status: 500 });
  }
}
