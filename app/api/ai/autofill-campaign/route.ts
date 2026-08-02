import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { spendTokens, refundTokens } from "@/lib/ai/tokens";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await spendTokens(user.id, "campaign_ai");
  if (!gate.ok) return NextResponse.json({ error: "insufficient_tokens", remaining: gate.remaining, required: gate.required }, { status: 402 });

  const { projectName, niche, description, audience } = await request.json();

  const prompt = `Ты помогаешь создать рекламную кампанию для проекта. На основе данных проекта предложи конкретные значения для полей кампании.

Проект: ${projectName}
Ниша: ${niche ?? "не указана"}
Описание проекта: ${description ?? "не указано"}
Целевая аудитория проекта: ${audience ?? "не указана"}

Верни ТОЛЬКО JSON без markdown и пояснений:
{
  "name": "краткое конкретное название кампании (3-5 слов, включай название проекта или продукта)",
  "goal": "одно значение из списка: Продажи / заявки | Трафик на сайт | Охват | Подписчики",
  "product": "описание продукта/услуги для рекламы (2-3 предложения, конкретные преимущества и УТП)",
  "audience": "целевая аудитория (возраст, интересы, гео если очевидно из ниши)"
}`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (message.content[0] as { text: string }).text;
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    const validGoals = ["Продажи / заявки", "Трафик на сайт", "Охват", "Подписчики"];
    if (!validGoals.includes(parsed.goal)) parsed.goal = "Продажи / заявки";

    return NextResponse.json(parsed);
  } catch (err: any) {
    await refundTokens(user.id, "campaign_ai");
    console.error("[ai/autofill-campaign]", err?.message || err);
    return NextResponse.json({ error: err?.message || "Generation failed" }, { status: 500 });
  }
}
