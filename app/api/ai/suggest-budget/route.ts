import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { spendTokens, refundTokens } from "@/lib/ai/tokens";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await spendTokens(user.id, "project_ai");
  if (!gate.ok) return NextResponse.json({ error: "insufficient_tokens", remaining: gate.remaining, required: gate.required }, { status: 402 });

  const { goal, niche, audience, platforms, days } = await request.json();

  const prompt = `Ты специалист по рекламе в СНГ. Порекомендуй бюджет для рекламной кампании и объясни почему именно такая сумма.

Цель: ${goal || "Продажи / заявки"}
Ниша: ${niche || "не указана"}
Аудитория: ${audience || "не указана"}
Платформы: ${(platforms || []).join(", ") || "не указаны"}
Период: ${days || 30} дней

Верни ТОЛЬКО JSON без markdown:
{
  "min": число (минимальный бюджет в рублях),
  "recommended": число (рекомендованный бюджет в рублях),
  "max": число (максимальный бюджет в рублях),
  "explanation": "2-3 предложения: почему именно эта сумма — учти платформу (средняя стоимость клика/показа), нишу, конкуренцию, период и цель. Конкретно и по делу, без воды."
}`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (message.content[0] as { text: string }).text;
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return NextResponse.json(parsed);
  } catch (err: any) {
    await refundTokens(user.id, "project_ai");
    console.error("[ai/suggest-budget]", err?.message || err);
    return NextResponse.json({ error: err?.message || "Generation failed" }, { status: 500 });
  }
}
