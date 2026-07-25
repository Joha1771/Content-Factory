import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
import { NextResponse } from "next/server";
import { spendTokens, refundTokens } from "@/lib/ai/tokens";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const SYSTEM_PROMPT = `Ты — профессиональный SMM-копирайтер. Отвечай ТОЛЬКО валидным JSON без markdown.`;

type Field = "hook" | "caption" | "hashtags" | "cta";

const FIELD_PROMPTS: Record<Field, (ctx: Record<string, string>) => string> = {
  hook: (ctx) => `Напиши новый цепляющий хук для этого поста.
Бренд: ${ctx.projectName}, Ниша: ${ctx.niche}, Тема: ${ctx.topic}, Тон: ${ctx.tone}
Текущий caption: ${ctx.caption}
Ответь JSON: { "hook": "новый хук" }`,

  caption: (ctx) => `Перепиши текст поста лучше.
Бренд: ${ctx.projectName}, Ниша: ${ctx.niche}, Тема: ${ctx.topic}, Тон: ${ctx.tone}, Платформа: ${ctx.platform}
Хук: ${ctx.hook}
Ответь JSON: { "caption": "новый текст" }`,

  hashtags: (ctx) => `Придумай 5-7 новых хэштегов для этого поста.
Бренд: ${ctx.projectName}, Ниша: ${ctx.niche}, Платформа: ${ctx.platform}
Caption: ${ctx.caption}
Ответь JSON: { "hashtags": ["хэштег1", "хэштег2", "хэштег3", "хэштег4", "хэштег5"] }`,

  cta: (ctx) => `Придумай новый призыв к действию.
Бренд: ${ctx.projectName}, Цель: ${ctx.goal}, Тон: ${ctx.tone}
Caption: ${ctx.caption}
Ответь JSON: { "cta": "новый призыв" }`,
};

export async function POST(request: Request) {
  let userId = "";
  let gateOk = false;
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = user.id;

    const gate = await spendTokens(user.id, "post_generate");
    if (!gate.ok) return NextResponse.json({ error: "insufficient_tokens", remaining: gate.remaining, required: gate.required }, { status: 402 });
    gateOk = true;

    const { contentId, field } = (await request.json()) as { contentId: string; field: Field };

    if (!contentId || !field || !FIELD_PROMPTS[field])
      return NextResponse.json({ error: "Missing contentId or invalid field" }, { status: 400 });

    const content = await queryOne<any>(
      `SELECT c.*, p.name as project_name, p.niche as project_niche, p.tone as project_tone
       FROM contents c
       LEFT JOIN projects p ON c.project_id = p.id
       WHERE c.id = $1 AND (c.user_id = $2 OR p.user_id = $2)`,
      [contentId, user.id]
    );

    if (!content) return NextResponse.json({ error: "Content not found" }, { status: 404 });

    const ctx = {
      projectName: content.project_name,
      niche: content.project_niche || "",
      tone: content.project_tone || "friendly",
      topic: content.goal || "",
      goal: content.goal || "",
      platform: content.platform || "telegram",
      hook: content.hook || "",
      caption: content.caption || "",
    };

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: FIELD_PROMPTS[field](ctx) }],
    });

    const raw = (message.content[0] as { text: string }).text;
    const clean = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(clean);

    await query(
      `UPDATE contents SET ${field} = $1, updated_at = NOW() WHERE id = $2`,
      [parsed[field], contentId]
    );

    return NextResponse.json({ ok: true, field, value: parsed[field] });
  } catch (error: unknown) {
    if (gateOk) await refundTokens(userId, "post_generate");
    const msg = error instanceof Error ? error.message : "Regeneration failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
