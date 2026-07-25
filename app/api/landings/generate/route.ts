import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { spendTokens, refundTokens } from "@/lib/ai/tokens";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function toSlug(name: string): string {
  const map: Record<string, string> = {
    а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"zh",з:"z",и:"i",
    й:"y",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",
    у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ъ:"",ы:"y",ь:"",
    э:"e",ю:"yu",я:"ya",
  };
  const base = name.toLowerCase().split("").map(c => map[c] ?? c).join("")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const uid = Math.random().toString(36).slice(2, 8);
  return `${base}-${uid}`;
}

// ── Shared quality rules injected into every prompt ──────────────────────────
const QUALITY_RULES = `
ПРАВИЛА КАЧЕСТВА (обязательно соблюдать):
- Заголовки: конкретные и сильные. НЕ "Профессиональные услуги" — а "Ремонт кухни за 14 дней с гарантией 2 года".
- Используй цифры, факты, временные рамки, гарантии.
- Текст должен звучать как реальный бизнес, а не как шаблон конструктора сайтов.
- Тон: уверенный, конкретный. Каждое предложение должно нести ценность.
- visual: одно подходящее эмодзи, которое визуально представляет продукт/услугу.
`;

function buildPrompt(body: Record<string, string>): string {
  const {
    businessName, niche, city, offer, audience, pain,
    advantages, tone, oldPrice, newPrice, productEmoji,
  } = body;

  const hasPrice = !!(oldPrice || newPrice);
  const priceNote = hasPrice
    ? `\nЦена: ${newPrice || "по запросу"}${oldPrice ? `, старая цена: ${oldPrice}` : ""}. Эмодзи товара: ${productEmoji || "🛒"}.`
    : "";

  return `Бизнес: "${businessName}". Ниша: ${niche}. Город: ${city || "не указан"}.
Оффер: ${offer}. Целевая аудитория: ${audience}.
Боль клиента: ${pain || "не указана"}. Преимущества: ${advantages || "не указаны"}.
Тон общения: ${tone}.${priceNote}

${QUALITY_RULES}

На основе контекста бизнеса АВТОМАТИЧЕСКИ выбери наиболее подходящий тип лендинга:
- product — продажа товара: ниша "товары" ИЛИ указана цена (newPrice/oldPrice)
- form — заявка на услугу: услуги, консалтинг, строительство, медицина (без явной цены)
- appointment — запись на приём: врачи, салоны красоты, мастера, репетиторы
- event — мероприятие: вебинар, тренинг, конференция, событие
- menu — каталог/меню: рестораны, доставка еды, кафе
- callback — обратный звонок: главное CTA — перезвонить клиенту

Создай лендинг выбранного типа. Верни ТОЛЬКО валидный JSON {"title":"...","blocks":[...]}.

Доступные типы блоков (используй точно такую структуру):
hero: {"type":"hero","badge":"метка 3-5 слов","headline":"заголовок 6-9 слов","subheadline":"1-2 предл. с выгодой","cta":"текст кнопки","visual":"🎯"}
social_proof: {"type":"social_proof","stats":[{"value":"число","label":"описание"},{"value":"...","label":"..."},{"value":"...","label":"..."}]}
price: {"type":"price","badge":"Акция — выгода X%","emoji":"${productEmoji || "🛒"}","oldPrice":"${oldPrice || ""}","newPrice":"${newPrice || "по запросу"}","features":["хар-ка 1","хар-ка 2","гарантия","бонус"],"cta":"Заказать сейчас"}
benefits: {"type":"benefits","title":"...","items":[{"icon":"emoji","title":"...","desc":"1-2 предл."},{"icon":"emoji","title":"...","desc":"..."},{"icon":"emoji","title":"...","desc":"..."}]}
showcase: {"type":"showcase","title":"...","subtitle":"...","items":[{"icon":"emoji","title":"...","desc":"..."},{"icon":"emoji","title":"...","desc":"..."},{"icon":"emoji","title":"...","desc":"..."},{"icon":"emoji","title":"...","desc":"..."}]}
faq: {"type":"faq","title":"...","items":[{"q":"вопрос","a":"ответ"},{"q":"...","a":"..."},{"q":"...","a":"..."}]}
form: {"type":"form","title":"...","subtitle":"...","button":"...","note":"..."}
cta: {"type":"cta","title":"...","subtitle":"...","cta":"...","note":"..."}

Набор блоков по типу лендинга:
- product: hero → social_proof → price → benefits → faq → form
- form: hero → social_proof → benefits → showcase → form → faq → cta
- appointment: hero → social_proof → showcase(title="Как проходит запись", 3 шага с иконками 1️⃣2️⃣3️⃣) → benefits → form → faq
- event: hero(badge = дата+место) → social_proof(добавить поле note="Осталось X мест") → showcase(title="Программа", 4 пункта) → form → cta
- menu: hero → social_proof → showcase(title="Популярные позиции", 4 пункта с полем badge="Хит"/"Новинка") → form
- callback: hero → social_proof → benefits(title="Что вы узнаете на звонке") → form → cta

ВАЖНО: все тексты конкретные с цифрами и фактами (не "качественный сервис", а "ремонт за 14 дней с гарантией 2 года"). Верни только JSON без markdown и пояснений.`;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let userId = "";
  let gateOk = false;
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = user.id;

    const gate = await spendTokens(user.id, "landing_gen");
    if (!gate.ok) return NextResponse.json({ error: "insufficient_tokens", remaining: gate.remaining, required: gate.required }, { status: 402 });
    gateOk = true;

    const body = await req.json();
    const { businessName, offer, audience, brandColor, bgImage, heroImage, tone, autoCloseDays, routing } = body;

    if (!businessName || !offer || !audience) {
      return NextResponse.json({ error: "Заполните обязательные поля" }, { status: 400 });
    }

    const prompt = buildPrompt(body);

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    // Strip any markdown code fences
    const cleaned = raw.replace(/^```json\s*/m, "").replace(/^```\s*/m, "").replace(/```\s*$/m, "").trim();

    let parsed: { title?: string; blocks?: unknown[] };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      await refundTokens(userId, "landing_gen");
      console.error("[landings/generate] JSON parse error:", cleaned.slice(0, 500));
      return NextResponse.json({ error: "AI вернул некорректный JSON. Попробуйте ещё раз." }, { status: 500 });
    }

    const slug = toSlug(businessName);

    // Inject heroImage into the first hero block if provided
    let blocks = (parsed.blocks || []) as any[];
    if (heroImage) {
      const heroIdx = blocks.findIndex((b: any) => b.type === "hero");
      if (heroIdx !== -1) {
        blocks = blocks.map((b: any, i: number) =>
          i === heroIdx ? { ...b, visual: heroImage } : b
        );
      }
    }

    const landing = await queryOne<{ id: string }>(
      `INSERT INTO landings (user_id, title, slug, content, published)
       VALUES ($1, $2, $3, $4, false) RETURNING id`,
      [
        user.id,
        parsed.title || businessName,
        slug,
        JSON.stringify({
          blocks,
          template_id: "auto",
          bg_image: bgImage || null,
          settings: { brandColor: brandColor || "#4F46E5", tone, autoCloseDays: autoCloseDays ?? null, routing: routing ?? { aiCallback: true, crm: true, payments: false }, logoUrl: body.logoUrl || null },
        }),
      ]
    );

    return NextResponse.json({ id: landing?.id, slug });
  } catch (err: any) {
    if (gateOk) await refundTokens(userId, "landing_gen");
    console.error("[landings/generate]", err);
    return NextResponse.json({ error: err.message || "Внутренняя ошибка" }, { status: 500 });
  }
}
