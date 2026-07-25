import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { spendTokens, refundTokens } from "@/lib/ai/tokens";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const TONE_MAP: Record<string, string> = {
  friendly: "дружелюбный и неформальный",
  professional: "профессиональный и деловой",
  humorous: "юмористический и лёгкий",
  formal: "официальный и строгий",
  inspiring: "вдохновляющий и мотивирующий",
};

const VARIATION_ANGLES = [
  { label: "боль/проблема", instruction: "Начни с конкретной боли или проблемы аудитории — опиши ситуацию которую они узнают, потом предложи решение через продукт." },
  { label: "результат/трансформация", instruction: "Покажи конкретный результат ПОСЛЕ использования продукта — цифры, факты, до/после. Не говори о проблеме — сразу о победе." },
  { label: "социальное доказательство", instruction: "Напиши мини-кейс или отзыв с реальными деталями (имя/ситуацию придумай реалистичные). Покажи как конкретный человек решил задачу." },
  { label: "срочность/оффер", instruction: "Сделай упор на ограниченное предложение, дедлайн или уникальный оффер. Конкретные цифры скидки или бонуса." },
  { label: "любопытство/вопрос", instruction: "Начни с неожиданного вопроса или факта который заставит остановиться. Потом раскрой связь с продуктом нестандартно." },
];

function buildContext(p: Record<string, any>) {
  const toneDesc = TONE_MAP[p.tone] || p.tone || "дружелюбный";
  const lines = [
    `ПРОЕКТ: ${p.projectName}`,
    `НИША: ${p.niche || "бизнес"}`,
    `ПРОДУКТ/УСЛУГА: ${p.product || p.projectName}`,
    `ЦЕЛЬ КАМПАНИИ: ${p.goal}`,
    `АУДИТОРИЯ: ${p.audience || "широкая"}`,
    `ТОН: ${toneDesc}`,
  ];
  if (p.keywords) lines.push(`КЛЮЧЕВЫЕ СЛОВА (используй органично): ${p.keywords}`);
  if (p.budget) lines.push(`БЮДЖЕТ: ${p.budget} — можешь упомянуть оффер/цену если уместно`);
  return lines.join("\n");
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await spendTokens(user.id, "creative_gen");
  if (!gate.ok) return NextResponse.json({ error: "insufficient_tokens", remaining: gate.remaining, required: gate.required }, { status: 402 });

  const params = await request.json();
  const { platform, subtype, variationIndex = 0 } = params;
  const angle = VARIATION_ANGLES[variationIndex % VARIATION_ANGLES.length];
  const ctx = buildContext(params);
  const angleBlock = `УГОЛ ПОДАЧИ: "${angle.label}"\n${angle.instruction}`;

  let prompt = "";

  if (platform === "google") {
    prompt = `Ты эксперт по Google Ads для рынка Узбекистана/СНГ.

${ctx}

${angleBlock}

Создай поисковое объявление Google Ads. СТРОГО соблюдай лимиты:
- headlines: ровно 3 заголовка, каждый СТРОГО до 30 символов (включая пробелы). Считай символы!
- descriptions: ровно 2 описания, каждое СТРОГО до 90 символов

Заголовки по смыслу: 1й — цепляющий крюк, 2й — главная выгода/УТП, 3й — CTA или доверие.
НЕ используй шаблоны. Пиши конкретно под нишу и продукт.

Ответ ТОЛЬКО JSON без markdown:
{"headlines":["...","...","..."],"descriptions":["...","..."]}`;

  } else if (platform === "yandex") {
    prompt = `Ты эксперт по Яндекс Директ.

${ctx}

${angleBlock}

Создай объявление для Яндекс Директ. СТРОГО соблюдай лимиты:
- headline: до 56 символов
- text: до 81 символа

Ответ ТОЛЬКО JSON без markdown:
{"headline":"...","text":"..."}`;

  } else if (platform === "meta") {
    prompt = `Ты эксперт по Meta Ads (Facebook/Instagram реклама) для рынка Узбекистана.

${ctx}

${angleBlock}

Создай рекламное объявление Meta Ads:
- primary_text: основной текст 100-200 символов (показывается над изображением), живой язык
- headline: заголовок до 40 символов (жирный под изображением), конкретный оффер
- description: до 30 символов (серый текст под заголовком), уточнение или CTA

Ответ ТОЛЬКО JSON без markdown:
{"primary_text":"...","headline":"...","description":"..."}`;

  } else if (platform === "telegram") {
    if (subtype === "video") {
      prompt = `Ты эксперт по Telegram-контенту для рынка Узбекистана.

${ctx}

${angleBlock}

Создай сценарий видео для Telegram:
- hook: что говорим/показываем в первые 5 секунд — должен ОСТАНОВИТЬ просмотр
- script: сценарий с блоками (0-5с: крюк | 5-30с: проблема/контекст | 30-60с: решение | 60-90с: CTA)
- caption: подпись под видео 100-200 символов с CTA

Ответ ТОЛЬКО JSON без markdown:
{"hook":"...","script":"...","caption":"..."}`;
    } else {
      prompt = `Ты эксперт по Telegram-каналам для рынка Узбекистана.

${ctx}

${angleBlock}

Создай пост для Telegram канала:
- caption: 200-500 символов
- Используй **жирный** для ключевых фраз и эмодзи для структуры
- Заканчивай чётким CTA (написать, перейти, ссылка)
- Живой язык, не рекламный шаблон
- Структура: зацепка → суть → выгода → CTA

Ответ ТОЛЬКО JSON без markdown:
{"caption":"..."}`;
    }

  } else if (platform === "instagram") {
    if (subtype === "reels") {
      prompt = `Ты эксперт по Instagram Reels для рынка Узбекистана.

${ctx}

${angleBlock}

Создай сценарий Reels (15-60 сек):
- hook: что делаем/говорим в первые 3 секунды — должен ОСТАНОВИТЬ прокрутку (до 15 слов)
- script: сценарий с тайм-метками: [0-3с] крюк | [3-15с] контекст/проблема | [15-45с] решение/демо | [45-60с] CTA
- caption: подпись под видео 100-200 символов с эмодзи
- hashtags: 5 хэштегов — популярных в Узбекистане (русские + узбекские)

Ответ ТОЛЬКО JSON без markdown:
{"hook":"...","script":"...","caption":"...","hashtags":["...","...","...","...","..."]}`;

    } else if (subtype === "stories") {
      prompt = `Ты эксперт по Instagram Stories для рынка Узбекистана.

${ctx}

${angleBlock}

Создай Stories (один слайд):
- text: текст для слайда до 80 символов, с эмодзи, крупно и ёмко
- cta: текст кнопки/стикера (Узнать больше / Заказать / Написать нам / Получить скидку...)
- hashtags: 3 хэштега для Stories

Ответ ТОЛЬКО JSON без markdown:
{"text":"...","cta":"...","hashtags":["...","...","..."]}`;

    } else {
      prompt = `Ты эксперт по Instagram для рынка Узбекистана.

${ctx}

${angleBlock}

Создай пост для Instagram ленты:
- caption: 150-300 символов, живой язык, уместные эмодзи, заканчивается вопросом или CTA
- hashtags: 7 хэштегов — mix популярных в Узбекистане (русские и узбекские)

Ответ ТОЛЬКО JSON без markdown:
{"caption":"...","hashtags":["...","...","...","...","...","...","..."]}`;
    }

  } else if (platform === "tiktok") {
    prompt = `Ты эксперт по TikTok для рынка Узбекистана (аудитория 16-28 лет).

${ctx}

${angleBlock}

Создай видео-сценарий для TikTok:
- hook: первые 3 секунды — что делаем/говорим чтобы НЕ пролистали (до 15 слов)
- script: сценарий с тайм-метками: [0-3с] крюк | [3-15с] контекст | [15-45с] решение/демо | [45-60с] CTA
- caption: подпись под видео до 150 символов
- hashtags: 3 хэштега (узбекистанские + нишевые)

Ответ ТОЛЬКО JSON без markdown:
{"hook":"...","script":"...","caption":"...","hashtags":["...","...","..."]}`;

  } else {
    // Fallback для остальных платформ
    prompt = `Ты опытный SMM-копирайтер для рынка Узбекистана/СНГ. Создай рекламный текст для платформы ${platform}.

${ctx}

${angleBlock}

Ответ ТОЛЬКО JSON без markdown:
{"title":"заголовок до 8 слов","hook":"первые 1-2 предложения","caption":"полный текст с CTA"}`;
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { text: string }).text;
    const clean = raw.replace(/```json\n?|```/g, "").trim();

    try {
      const result = JSON.parse(clean);
      return NextResponse.json(result);
    } catch {
      return NextResponse.json({ caption: raw });
    }
  } catch (err: any) {
    await refundTokens(user.id, "creative_gen");
    console.error("[ai/generate-creative]", err?.message || err);
    return NextResponse.json({ error: err?.message || "AI error" }, { status: 500 });
  }
}
