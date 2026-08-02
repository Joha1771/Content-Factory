import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
import { NextResponse } from "next/server";
import { spendTokens, refundTokens } from "@/lib/ai/tokens";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await spendTokens(user.id, "creative_gen");
  if (!gate.ok) return NextResponse.json({ error: "insufficient_tokens", remaining: gate.remaining, required: gate.required }, { status: 402 });

  const { projectId } = await request.json();

  const project = await queryOne<any>(
    "SELECT * FROM projects WHERE id = $1 AND user_id = $2",
    [projectId, user.id]
  );
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const recentContents = await query<any>(
    "SELECT title, platform, status, created_at FROM contents WHERE project_id = $1 ORDER BY created_at DESC LIMIT 10",
    [projectId]
  );

  const publishedCount = await queryOne<{ count: string }>(
    "SELECT COUNT(*) as count FROM contents WHERE project_id = $1 AND status = 'published'",
    [projectId]
  );

  const today = new Date().toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const prompt = `Ты AI SMM Manager для бренда.

БРЕНД: ${project.name}
НИША: ${project.niche || "не указана"}
АУДИТОРИЯ: ${project.audience || "не указана"}
ТОН: ${project.tone}
ЯЗЫК: ${project.language}
ОПУБЛИКОВАНО ПОСТОВ: ${publishedCount?.count ?? 0}
ПОСЛЕДНИЕ ТЕМЫ: ${recentContents.map((c: any) => c.title).filter(Boolean).join(", ") || "нет"}
СЕГОДНЯ: ${today}

Составь контент-план на 7 дней. Для каждого дня предложи:
- Тему поста
- Тип контента (пост/reels/stories)
- Лучшее время публикации
- Платформу

Ответь ТОЛЬКО JSON:
{
  "week_theme": "главная тема недели",
  "days": [
    {
      "day": "Понедельник",
      "date": "дата",
      "topic": "тема поста",
      "type": "post|reels|stories",
      "platform": "telegram|instagram",
      "best_time": "10:00",
      "goal": "вовлечённость|охват|продажи",
      "tip": "краткий совет"
    }
  ],
  "summary": "краткое резюме стратегии"
}`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { text: string }).text;
    const clean = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const plan = JSON.parse(clean);

    return NextResponse.json({ plan });
  } catch (err: any) {
    await refundTokens(user.id, "creative_gen");
    console.error("[ai/smm-manager]", err?.message || err);
    return NextResponse.json({ error: err?.message || "AI error" }, { status: 500 });
  }
}
