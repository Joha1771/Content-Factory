import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { NextResponse } from "next/server";
import { spendTokens, refundTokens } from "@/lib/ai/tokens";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ─── Ниша → ключевые слова для определения категории ───────────────────────
function detectNicheCategory(niche: string): string {
  const n = (niche ?? "").toLowerCase();
  if (/ресторан|кафе|еда|food|питание|блюд|кулинар|фастфуд|доставк/.test(n)) return "food";
  if (/одежд|мода|fashion|одяг|boutique|магазин|retail|интернет.магаз/.test(n)) return "retail";
  if (/красот|салон|барбер|ноготь|ногти|спа|spa|маникюр|beauty/.test(n)) return "beauty";
  if (/фитнес|спорт|gym|здоровь|тренер|йога|wellness/.test(n)) return "fitness";
  if (/недвижим|жилье|квартир|дом|ЖК|строительств|аренд/.test(n)) return "realestate";
  if (/образован|курс|школ|учёб|репетитор|обучен|университет|edu/.test(n)) return "education";
  if (/авто|автомобил|машин|car|dealer|сервис|шиномонтаж/.test(n)) return "auto";
  if (/отель|гостиниц|туризм|тур|путешеств|resort|hotel/.test(n)) return "travel";
  if (/клиник|стоматолог|медицин|врач|здравоохранен/.test(n)) return "medical";
  return "default";
}

// ─── Поля по нише и типу поста ─────────────────────────────────────────────
// Используется на фронтенде для отображения нужных полей
export const NICHE_FIELDS: Record<string, Record<string, { key: string; label: string; placeholder: string; multiline?: boolean }[]>> = {
  food: {
    product: [
      { key: "name",        label: "Название блюда",         placeholder: "Плов с бараниной" },
      { key: "details",     label: "Состав / особенность",   placeholder: "Баранина от местных фермеров, рис девзира, жёлтая морковь...", multiline: true },
      { key: "price",       label: "Цена",                   placeholder: "45 000 сум" },
      { key: "extra",       label: "Дополнительно",          placeholder: "Порция на 2, подаётся с лепёшкой" },
    ],
    promo: [
      { key: "offer",       label: "Акция",                  placeholder: "Скидка 20% на все блюда с 12:00 до 15:00" },
      { key: "condition",   label: "Условие",                placeholder: "При заказе от 2 блюд" },
      { key: "until",       label: "До когда",               placeholder: "До 31 июля" },
    ],
    announcement: [
      { key: "what",        label: "Что происходит",         placeholder: "Открываем новый зал на 2 этаже" },
      { key: "when",        label: "Когда",                  placeholder: "В эту субботу, 26 июля" },
      { key: "details",     label: "Детали",                 placeholder: "Живая музыка, специальное меню..." },
    ],
  },
  retail: {
    product: [
      { key: "name",        label: "Название товара",        placeholder: "Летнее платье из льна" },
      { key: "details",     label: "Материал / особенность", placeholder: "100% лён, не мнётся, дышит", multiline: true },
      { key: "sizes",       label: "Размеры / варианты",     placeholder: "XS, S, M, L, XL — в 4 цветах" },
      { key: "price",       label: "Цена",                   placeholder: "280 000 сум" },
    ],
    promo: [
      { key: "offer",       label: "Акция",                  placeholder: "Скидка 30% на летнюю коллекцию" },
      { key: "condition",   label: "Условие",                placeholder: "При покупке от 2 вещей" },
      { key: "until",       label: "До когда",               placeholder: "Только эти выходные" },
    ],
    announcement: [
      { key: "what",        label: "Что происходит",         placeholder: "Новая коллекция осень-зима уже в магазине" },
      { key: "when",        label: "Когда",                  placeholder: "С 25 июля" },
      { key: "details",     label: "Что нового",             placeholder: "60+ моделей, размеры 42-58..." },
    ],
  },
  beauty: {
    product: [
      { key: "name",        label: "Услуга",                 placeholder: "Ламинирование ресниц" },
      { key: "details",     label: "Что включает",           placeholder: "Состав, укладка, ботокс", multiline: true },
      { key: "duration",    label: "Длительность",           placeholder: "1.5 часа" },
      { key: "price",       label: "Цена",                   placeholder: "180 000 сум" },
    ],
    promo: [
      { key: "offer",       label: "Акция",                  placeholder: "Стрижка + укладка за 120 000" },
      { key: "condition",   label: "Условие",                placeholder: "При записи онлайн" },
      { key: "until",       label: "До когда",               placeholder: "В июле" },
    ],
    announcement: [
      { key: "what",        label: "Что происходит",         placeholder: "Новый мастер — Малика, специалист по окрашиванию" },
      { key: "when",        label: "Когда",                  placeholder: "Принимает с 28 июля" },
      { key: "details",     label: "Детали",                 placeholder: "Опыт 7 лет, сертификат L'Oreal..." },
    ],
  },
  fitness: {
    product: [
      { key: "name",        label: "Услуга / программа",     placeholder: "Персональные тренировки" },
      { key: "details",     label: "Для кого / что даёт",    placeholder: "Для тех кто хочет похудеть за 3 месяца", multiline: true },
      { key: "duration",    label: "Формат",                 placeholder: "3 раза в неделю по 60 мин" },
      { key: "price",       label: "Цена",                   placeholder: "500 000 сум / месяц" },
    ],
    promo: [
      { key: "offer",       label: "Акция",                  placeholder: "Первая тренировка бесплатно" },
      { key: "condition",   label: "Условие",                placeholder: "При покупке абонемента на 3 месяца" },
      { key: "until",       label: "До когда",               placeholder: "До конца июля" },
    ],
    announcement: [
      { key: "what",        label: "Что происходит",         placeholder: "Открываем новый зал с бассейном" },
      { key: "when",        label: "Когда",                  placeholder: "1 августа" },
      { key: "details",     label: "Детали",                 placeholder: "25-метровый бассейн, 6 дорожек..." },
    ],
  },
  realestate: {
    product: [
      { key: "name",        label: "Объект",                 placeholder: "3-комнатная квартира в ЖК Новый город" },
      { key: "details",     label: "Характеристики",         placeholder: "85 м², 12 этаж из 16, евроремонт", multiline: true },
      { key: "location",    label: "Район / адрес",          placeholder: "Юнусабад, 5 минут от метро" },
      { key: "price",       label: "Цена",                   placeholder: "320 000 $ или в ипотеку от 2.8 млн/мес" },
    ],
    promo: [
      { key: "offer",       label: "Акция",                  placeholder: "Паркинг в подарок при покупке до 31 июля" },
      { key: "condition",   label: "Условие",                placeholder: "100% оплата или ипотека" },
      { key: "until",       label: "До когда",               placeholder: "Осталось 5 квартир" },
    ],
    announcement: [
      { key: "what",        label: "Что происходит",         placeholder: "Старт продаж 2-й очереди ЖК Садовый" },
      { key: "when",        label: "Когда",                  placeholder: "28 июля" },
      { key: "details",     label: "Детали",                 placeholder: "120 квартир, сдача Q2 2026..." },
    ],
  },
  education: {
    product: [
      { key: "name",        label: "Курс / программа",       placeholder: "Курс английского с нуля до B2" },
      { key: "details",     label: "Что даёт / для кого",    placeholder: "За 6 месяцев — разговорный уровень для работы", multiline: true },
      { key: "format",      label: "Формат",                 placeholder: "2 раза в неделю, онлайн или офлайн" },
      { key: "price",       label: "Цена",                   placeholder: "350 000 сум / месяц" },
    ],
    promo: [
      { key: "offer",       label: "Акция",                  placeholder: "Первый месяц за полцены" },
      { key: "condition",   label: "Условие",                placeholder: "При записи в июле" },
      { key: "until",       label: "До когда",               placeholder: "Набор до 1 августа" },
    ],
    announcement: [
      { key: "what",        label: "Что происходит",         placeholder: "Новый набор на курс Python" },
      { key: "when",        label: "Когда",                  placeholder: "Старт 5 августа" },
      { key: "details",     label: "Детали",                 placeholder: "Группа до 8 человек, преподаватель из Google..." },
    ],
  },
  auto: {
    product: [
      { key: "name",        label: "Авто / услуга",          placeholder: "Chevrolet Tracker 2024" },
      { key: "details",     label: "Характеристики",         placeholder: "1.5 турбо, автомат, полный привод", multiline: true },
      { key: "color",       label: "Цвета / комплектация",   placeholder: "4 цвета, базовая и премиум" },
      { key: "price",       label: "Цена",                   placeholder: "от 38 000 $ или рассрочка" },
    ],
    promo: [
      { key: "offer",       label: "Акция",                  placeholder: "Trade-in: сдай старую, доплати разницу" },
      { key: "condition",   label: "Условие",                placeholder: "Авто не старше 2018 года" },
      { key: "until",       label: "До когда",               placeholder: "Акция в августе" },
    ],
    announcement: [
      { key: "what",        label: "Что происходит",         placeholder: "Новая модель Kia EV6 поступила в салон" },
      { key: "when",        label: "Когда",                  placeholder: "Уже доступна для тест-драйва" },
      { key: "details",     label: "Детали",                 placeholder: "Запас хода 490 км, зарядка 30 мин..." },
    ],
  },
  travel: {
    product: [
      { key: "name",        label: "Тур / направление",      placeholder: "Стамбул на 5 дней" },
      { key: "details",     label: "Что включено",           placeholder: "Перелёт, отель 4*, завтраки, экскурсии", multiline: true },
      { key: "dates",       label: "Даты",                   placeholder: "15-20 августа" },
      { key: "price",       label: "Цена",                   placeholder: "от 1 200 $ на человека" },
    ],
    promo: [
      { key: "offer",       label: "Акция",                  placeholder: "Раннее бронирование -15%" },
      { key: "condition",   label: "Условие",                placeholder: "При оплате до 1 августа" },
      { key: "until",       label: "До когда",               placeholder: "Осталось 4 места" },
    ],
    announcement: [
      { key: "what",        label: "Что происходит",         placeholder: "Новое направление — Батуми от нас" },
      { key: "when",        label: "Когда",                  placeholder: "Туры каждые 2 недели с августа" },
      { key: "details",     label: "Детали",                 placeholder: "4 дня / 3 ночи, отели у моря..." },
    ],
  },
  medical: {
    product: [
      { key: "name",        label: "Услуга",                 placeholder: "Имплантация зуба под ключ" },
      { key: "details",     label: "Что включает",           placeholder: "Имплант, коронка, установка — всё в одном", multiline: true },
      { key: "duration",    label: "Длительность / этапы",   placeholder: "2 визита, 3-4 месяца до финального результата" },
      { key: "price",       label: "Цена",                   placeholder: "от 1 500 $ за имплант" },
    ],
    promo: [
      { key: "offer",       label: "Акция",                  placeholder: "Консультация + снимок бесплатно" },
      { key: "condition",   label: "Условие",                placeholder: "При записи онлайн" },
      { key: "until",       label: "До когда",               placeholder: "В июле" },
    ],
    announcement: [
      { key: "what",        label: "Что происходит",         placeholder: "Новый аппарат КТ — диагностика за 15 минут" },
      { key: "when",        label: "Когда",                  placeholder: "Уже принимаем" },
      { key: "details",     label: "Детали",                 placeholder: "3D-снимок всей челюсти, точность 0.1мм..." },
    ],
  },
  default: {
    product: [
      { key: "name",        label: "Товар / услуга",         placeholder: "Название" },
      { key: "details",     label: "Описание / особенность", placeholder: "Что это, чем отличается...", multiline: true },
      { key: "price",       label: "Цена",                   placeholder: "Цена или диапазон" },
    ],
    promo: [
      { key: "offer",       label: "Акция",                  placeholder: "Что предлагаем" },
      { key: "condition",   label: "Условие",                placeholder: "При каком условии" },
      { key: "until",       label: "До когда",               placeholder: "Срок акции" },
    ],
    announcement: [
      { key: "what",        label: "Что происходит",         placeholder: "Событие / новость" },
      { key: "when",        label: "Когда",                  placeholder: "Дата / время" },
      { key: "details",     label: "Детали",                 placeholder: "Подробности" },
    ],
  },
};

// ─── Промпты ────────────────────────────────────────────────────────────────
const FORBIDDEN =
  "ЗАПРЕЩЕНО использовать: «вкусный», «доступный», «качественный», «лучший в городе», «спешите», «не упустите», «высокое качество», «широкий ассортимент», «профессиональная команда», «индивидуальный подход». Эти слова — признак шаблонного текста.";

const TONE_MAP: Record<string, string> = {
  friendly:     "дружелюбный, как будто пишешь знакомому",
  professional: "уверенный и чёткий — факты без лишних слов",
  humorous:     "с лёгким юмором, но без клоунады",
  formal:       "официальный, сдержанный",
  inspiring:    "вдохновляющий, мотивирует действовать",
};

function buildPrompt(
  postType: string,
  platform: "telegram" | "instagram" | "both",
  fields: Record<string, string>,
  project: any,
  nicheCategory: string
): string {
  const tone = TONE_MAP[project.tone ?? "friendly"] ?? "дружелюбный";
  const ctx = [
    `Бизнес: ${project.name}`,
    project.niche     ? `Ниша: ${project.niche}` : "",
    project.description ? `О компании: ${project.description}` : "",
    project.audience  ? `Аудитория: ${project.audience}` : "",
    `Тон: ${tone}`,
  ].filter(Boolean).join("\n");

  const platformInstruction =
    platform === "telegram"
      ? `Напиши пост для Telegram-канала. Длина 100-250 символов. Можно 1-2 эмодзи. Без хэштегов.`
      : platform === "instagram"
      ? `Напиши пост для Instagram. Caption 150-300 символов + 5-7 хэштегов для Узбекистана. Эмодзи уместны.`
      : `Напиши ДВА варианта — сначала для Telegram (100-250 символов, без хэштегов), потом для Instagram (150-300 символов + 5-7 хэштегов). Разделяй их строкой "===INSTAGRAM===".`;

  const fieldsText = Object.entries(fields)
    .filter(([, v]) => v?.trim())
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  const typeInstruction =
    postType === "product"
      ? `Расскажи об этом конкретно и живо. Не описывай общими словами — используй детали из данных. Покажи ценность через конкретику, а не прилагательные.`
      : postType === "promo"
      ? `Напиши про акцию так чтобы человек понял выгоду за 5 секунд. Конкретные цифры, чёткое условие, срок. Без искусственной срочности.`
      : `Сообщи о событии/новости как будто рассказываешь другу. Факты + почему это важно для читателя.`;

  return `Ты SMM-копирайтер для бизнеса в Узбекистане. Пишешь живые тексты — как человек, не как ChatGPT.

${FORBIDDEN}

ДАННЫЕ О БИЗНЕСЕ:
${ctx}

ДАННЫЕ ДЛЯ ПОСТА:
${fieldsText}

ЗАДАЧА: ${typeInstruction}

${platformInstruction}

Пиши только текст поста. Никаких пояснений, заголовков типа "Вот пост:", кавычек вокруг текста.`;
}

// ─── Route ──────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await spendTokens(user.id, "post_generate");
  if (!gate.ok) return NextResponse.json({ error: "insufficient_tokens", remaining: gate.remaining, required: gate.required }, { status: 402 });

  const { postType, platform, projectId, fields } = await request.json();

  const project = projectId
    ? await queryOne<any>("SELECT * FROM projects WHERE id = $1 AND user_id = $2", [projectId, user.id])
    : null;

  const nicheCategory = detectNicheCategory(project?.niche ?? "");
  const prompt = buildPrompt(postType, platform, fields ?? {}, project ?? {}, nicheCategory);

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = (message.content[0] as { text: string }).text.trim();

    if (platform === "both") {
      const parts = raw.split("===INSTAGRAM===");
      return NextResponse.json({
        telegram: parts[0]?.trim() ?? raw,
        instagram: parts[1]?.trim() ?? raw,
      });
    }

    return NextResponse.json({ [platform]: raw });
  } catch (err: any) {
    await refundTokens(user.id, "post_generate");
    console.error("[ai/generate-post]", err?.message);
    return NextResponse.json({ error: err?.message || "AI error" }, { status: 500 });
  }
}

// ─── GET — возвращает конфиг полей для фронтенда ────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const niche = searchParams.get("niche") ?? "";
  const category = detectNicheCategory(niche);
  return NextResponse.json({ category, fields: NICHE_FIELDS[category] ?? NICHE_FIELDS.default });
}
