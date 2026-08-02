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

  const { name, goal, platforms, budget, audience } = await request.json();

  const prompt = `Ты маркетолог-эксперт. Объясни рекламную кампанию простым языком — что она делает и почему такая стратегия правильная.

Название: ${name || "Без названия"}
Цель: ${goal || "Продажи / заявки"}
Платформы: ${(platforms || []).join(", ") || "не указаны"}
Бюджет: ${budget ? `${Number(budget).toLocaleString("ru")} ₽` : "не указан"}
Аудитория: ${audience || "не указана"}

Напиши 3-4 коротких предложения: что делает кампания, почему выбраны эти платформы, на кого нацелена и чего стоит ожидать. Пиши по-русски, конкретно, без шаблонных фраз. Верни только текст объяснения.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const explanation = (message.content[0] as { text: string }).text.trim();
    return NextResponse.json({ explanation });
  } catch (err: any) {
    await refundTokens(user.id, "campaign_ai");
    console.error("[ai/explain-campaign]", err?.message || err);
    return NextResponse.json({ error: err?.message || "Generation failed" }, { status: 500 });
  }
}
