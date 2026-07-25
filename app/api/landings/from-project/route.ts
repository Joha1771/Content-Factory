import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { spendTokens, refundTokens } from "@/lib/ai/tokens";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const TONE_MAP: Record<string, string> = {
  professional: "профессиональный",
  friendly: "дружелюбный",
  humorous: "молодёжный",
  formal: "экспертный",
  expert: "экспертный",
  viral: "молодёжный",
  premium: "профессиональный",
};

const LANDING_NICHES = [
  "недвижимость", "медицина", "образование", "услуги", "товары",
  "IT / технологии", "красота и уход", "строительство", "питание", "другое",
];

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await spendTokens(user.id, "landing_gen");
  if (!gate.ok) return NextResponse.json({ error: "insufficient_tokens", remaining: gate.remaining, required: gate.required }, { status: 402 });

  const { projectId } = await req.json();
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const project = await queryOne<{
    name: string; niche: string | null; description: string | null;
    audience: string | null; tone: string; language: string;
    keywords: string | null; country: string | null;
  }>(
    "SELECT name, niche, description, audience, tone, language, keywords, country FROM projects WHERE id = $1 AND user_id = $2",
    [projectId, user.id]
  );

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const prompt = `Ты эксперт по маркетингу и созданию продающих лендингов.
На основе данных о бренде заполни поля для создания профессионального лендинга.

Данные бренда:
- Название: ${project.name}
- Ниша: ${project.niche || "не указана"}
- Описание: ${project.description || "не указано"}
- Целевая аудитория: ${project.audience || "не указана"}
- Ключевые слова: ${project.keywords || "не указаны"}
- Страна/регион: ${project.country || "Узбекистан"}

Доступные ниши для лендинга: ${LANDING_NICHES.join(", ")}

Задача: преобразуй данные бренда в конкретные продающие тексты для лендинга.
- "offer" должен быть конкретным оффером (что именно получает клиент), не общим описанием
- "pain" — главная проблема которую решает бизнес
- "advantages" — три конкретных выгоды (не "качество", а "получите результат за 3 дня")

Верни ТОЛЬКО JSON без markdown и пояснений:
{
  "businessName": "${project.name}",
  "niche": "наиболее подходящая ниша из списка выше",
  "city": "город или страна (из данных или 'Ташкент, Узбекистан')",
  "offer": "главный оффер — что конкретно получит клиент (до 100 символов, сильный глагол + результат)",
  "audience": "целевая аудитория: кто, возраст, что их волнует (1-2 предложения)",
  "pain": "главная боль или проблема клиента которую решает этот бренд (1 предложение)",
  "advantages": "три конкретных преимущества через запятую (реальные выгоды, не шаблонные слова)"
}`;

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (msg.content[0] as { text: string }).text;
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    return NextResponse.json({
      ...parsed,
      tone: TONE_MAP[project.tone] || "профессиональный",
    });
  } catch (err: any) {
    await refundTokens(user.id, "landing_gen");
    console.error("[landings/from-project]", err?.message);
    return NextResponse.json({ error: err?.message || "Generation failed" }, { status: 500 });
  }
}
