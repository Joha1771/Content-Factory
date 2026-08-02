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

  const { projectId, goal, duration = "month" } = await request.json();

  const project = await queryOne<any>(
    "SELECT * FROM projects WHERE id = $1 AND user_id = $2",
    [projectId, user.id]
  );
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const postsCount = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM contents WHERE project_id = $1",
    [projectId]
  );

  const period = duration === "week" ? "неделю" : duration === "quarter" ? "квартал" : "месяц";
  const today = new Date().toLocaleDateString("ru-RU", { month: "long", year: "numeric" });

  const prompt = `Ты AI Creative Director — генеришь стратегию контент-кампаний.

БРЕНД: ${project.name}
НИША: ${project.niche || "не указана"}
АУДИТОРИЯ: ${project.audience || "не указана"}
ТОН: ${project.tone}
ЦЕЛЬ КАМПАНИИ: ${goal || "рост аудитории и вовлечённость"}
ПЕРИОД: ${period} (${today})
УЖЕ СОЗДАНО ПОСТОВ: ${postsCount?.count ?? 0}

Разработай полную концепцию контент-кампании.

Ответь ТОЛЬКО JSON:
{
  "campaign_name": "название кампании",
  "tagline": "слоган",
  "concept": "главная идея кампании (2-3 предложения)",
  "target_emotion": "эмоция которую хотим вызвать",
  "content_pillars": [
    { "name": "название столпа", "percent": 30, "description": "о чём постить", "examples": ["пример1", "пример2"] }
  ],
  "content_formats": [
    { "format": "формат", "frequency": "частота", "goal": "зачем" }
  ],
  "campaign_phases": [
    { "phase": "Фаза 1", "week": "1-2 неделя", "focus": "фокус", "posts": 4 }
  ],
  "key_messages": ["ключевое сообщение 1", "ключевое сообщение 2", "ключевое сообщение 3"],
  "success_metrics": ["метрика 1", "метрика 2", "метрика 3"],
  "creative_hooks": ["нестандартная идея 1", "нестандартная идея 2"],
  "estimated_reach": "прогноз охвата"
}`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { text: string }).text;
    const clean = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const campaign = JSON.parse(clean);

    return NextResponse.json({ campaign });
  } catch (err: any) {
    await refundTokens(user.id, "creative_gen");
    console.error("[ai/creative-director]", err?.message || err);
    return NextResponse.json({ error: err?.message || "AI error" }, { status: 500 });
  }
}
