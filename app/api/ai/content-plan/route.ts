import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { spendTokens, refundTokens } from "@/lib/ai/tokens";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

async function searchTrends(niche: string, platform: string): Promise<string> {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return "";

  const platformNames: Record<string, string> = {
    instagram: "Instagram",
    telegram: "Telegram",
    tiktok: "TikTok",
    youtube: "YouTube",
    meta: "Facebook реклама Meta Ads",
    google: "Google Ads",
    yandex: "Яндекс Директ",
  };

  const q = `${niche} ${platformNames[platform] ?? platform} контент тренды 2025 Узбекистан`;

  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q, gl: "uz", hl: "ru", num: 5 }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const snippets = (data.organic ?? [])
      .slice(0, 4)
      .map((r: any) => `• ${r.title}: ${r.snippet}`)
      .join("\n");
    return snippets ? `[${platform.toUpperCase()}]\n${snippets}` : "";
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await spendTokens(user.id, "content_plan");
  if (!gate.ok) return NextResponse.json({ error: "insufficient_tokens", remaining: gate.remaining, required: gate.required }, { status: 402 });

  const { niche, goal, product, audience, budget, dateFrom, dateTo, platforms } = await request.json();

  const socialPlatforms = (platforms ?? []).filter((p: string) =>
    ["instagram", "telegram", "tiktok", "youtube"].includes(p)
  );
  const adPlatforms = (platforms ?? []).filter((p: string) =>
    ["meta", "google", "yandex"].includes(p)
  );

  const trendResults = await Promise.all(
    (platforms ?? []).map((p: string) => searchTrends(niche ?? "бизнес", p))
  );
  const trendsBlock = trendResults.filter(Boolean).join("\n\n");

  const days =
    dateFrom && dateTo
      ? Math.max(1, Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000))
      : 14;

  const prompt = `Ты опытный SMM-стратег и медиапланер для рынка Узбекистана/СНГ.

ПАРАМЕТРЫ КАМПАНИИ:
- Ниша: ${niche ?? "бизнес"}
- Продукт/услуга: ${product ?? "не указан"}
- Цель кампании: ${goal ?? "продажи"}
- Целевая аудитория: ${audience ?? "широкая"}
- Бюджет: ${budget ?? "не указан"}
- Длительность: ${days} дней (с ${dateFrom ?? "сегодня"} по ${dateTo ?? "через 2 недели"})
- Соцсети: ${socialPlatforms.join(", ") || "не выбраны"}
- Рекламные кабинеты: ${adPlatforms.join(", ") || "не выбраны"}

АКТУАЛЬНЫЕ ТРЕНДЫ (из поиска):
${trendsBlock || "данные недоступны — опирайся на общие знания о рынке"}

ЗАДАЧА:
Составь план контента СТРОГО только для платформ из списка. Если соцсети не указаны — socialMedia должен быть {}. Если рекламные кабинеты не указаны — adPlatforms должен быть {}. НЕ добавляй платформы которых нет в списке.
Для каждой выбранной платформы укажи:
1. Какие форматы использовать и сколько штук каждого
2. Краткое объяснение почему именно так (1-2 предложения)

Форматы по платформам:
- instagram: post (фото/карусель), reels, stories
- telegram: post, video
- tiktok: video
- youtube: video, shorts
- meta: image_ad, video_ad, carousel_ad
- google: search_ad, display_ad
- yandex: search_ad, banner

Отвечай ТОЛЬКО валидным JSON без markdown:
{
  "strategy": "2-3 предложения об общей стратегии кампании",
  "socialMedia": {
    "instagram": {
      "post": 2,
      "reels": 4,
      "stories": 6,
      "reasoning": "почему такие форматы и количество"
    }
  },
  "adPlatforms": {
    "meta": {
      "image_ad": 3,
      "video_ad": 2,
      "reasoning": "почему"
    }
  },
  "postingSchedule": "краткое описание как распределить посты по времени"
}

Включай в ответ ТОЛЬКО те платформы которые есть в списке выше. Не придумывай лишнего.`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { text: string }).text;
    const clean = raw.replace(/```json\n?|```/g, "").trim();

    try {
      const plan = JSON.parse(clean);

      if (plan.socialMedia && Array.isArray(platforms)) {
        plan.socialMedia = Object.fromEntries(
          Object.entries(plan.socialMedia).filter(([k]) => platforms.includes(k))
        );
      }
      if (plan.adPlatforms && Array.isArray(platforms)) {
        plan.adPlatforms = Object.fromEntries(
          Object.entries(plan.adPlatforms).filter(([k]) => platforms.includes(k))
        );
      }

      const PLATFORM_DEFAULTS: Record<string, Record<string, number>> = {
        google:    { search_ad: 3, display_ad: 2 },
        yandex:    { search_ad: 2, banner: 1 },
        meta:      { image_ad: 2, video_ad: 1, carousel_ad: 1 },
        instagram: { post: 2, reels: 3, stories: 4 },
        telegram:  { post: 3, video: 1 },
        tiktok:    { video: 3 },
        youtube:   { video: 1, shorts: 2 },
      };
      const socialKeys = ["instagram", "telegram", "tiktok", "youtube"];
      const adKeys = ["meta", "google", "yandex"];
      for (const p of (platforms ?? [])) {
        if (socialKeys.includes(p) && !plan.socialMedia?.[p] && PLATFORM_DEFAULTS[p]) {
          plan.socialMedia = plan.socialMedia ?? {};
          plan.socialMedia[p] = { ...PLATFORM_DEFAULTS[p], reasoning: "Базовый набор форматов" };
        }
        if (adKeys.includes(p) && !plan.adPlatforms?.[p] && PLATFORM_DEFAULTS[p]) {
          plan.adPlatforms = plan.adPlatforms ?? {};
          plan.adPlatforms[p] = { ...PLATFORM_DEFAULTS[p], reasoning: "Базовый набор форматов" };
        }
      }

      return NextResponse.json(plan);
    } catch {
      return NextResponse.json({ error: "AI вернул невалидный JSON", raw }, { status: 500 });
    }
  } catch (err: any) {
    await refundTokens(user.id, "content_plan");
    console.error("[ai/content-plan]", err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
