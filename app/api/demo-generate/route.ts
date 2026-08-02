import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM = `Ты — профессиональный SMM-копирайтер. Создаёшь вирусный контент для соцсетей.
Правила:
- Отвечай ТОЛЬКО валидным JSON без markdown и пояснений
- Хук должен цеплять с первой строки
- Caption адаптируй под платформу`;

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const rlHr = await rateLimit(`demo-hr:${ip}`, 5, 3600);
    if (!rlHr.ok) {
      return NextResponse.json(
        { error: "too_many_requests", retryAfter: rlHr.retryAfter },
        { status: 429, headers: { "Retry-After": String(rlHr.retryAfter) } }
      );
    }
    const rlDay = await rateLimit(`demo-day:${ip}`, 20, 86400);
    if (!rlDay.ok) {
      return NextResponse.json(
        { error: "too_many_requests", retryAfter: rlDay.retryAfter },
        { status: 429, headers: { "Retry-After": String(rlDay.retryAfter) } }
      );
    }

    const { niche, tone, platform } = await req.json();

    if (!niche || !platform) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const toneMap: Record<string, string> = {
      expert: "экспертном и профессиональном",
      friendly: "дружелюбном и разговорном",
      viral: "вирусном и эмоциональном",
      selling: "продающем с призывом к действию",
    };

    const platformMap: Record<string, string> = {
      instagram: "Instagram (короче, с эмодзи, визуальный)",
      telegram: "Telegram (подробнее, информативно)",
      vk: "VKontakte (разговорный стиль)",
      tiktok: "TikTok (динамично, молодёжно)",
    };

    const prompt = `НИША: ${niche}
ТОН: ${toneMap[tone] || "дружелюбном"}
ПЛАТФОРМА: ${platformMap[platform] || platform}

Придумай идею поста и напиши его. Ответь ТОЛЬКО в JSON:
{
  "title": "короткое название поста",
  "hook": "цепляющее начало (1-2 предложения)",
  "caption": "готовый текст поста для ${platform} (3-5 абзацев)",
  "hashtags": ["хэштег1", "хэштег2", "хэштег3", "хэштег4", "хэштег5"],
  "cta": "призыв к действию"
}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { text: string }).text;
    const clean = raw
      .replace(/```json\s*/gi, "")
      .replace(/```/g, "")
      .trim();
    const result = JSON.parse(clean);

    return NextResponse.json(result);
  } catch (err) {
    console.error("Demo generate error:", err);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
