import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Ты AI-ассистент поддержки платформы PostCentro (MVI Content Factory).

PostCentro — это платформа для автоматической генерации и публикации контента в социальных сетях с помощью AI.

Что умеет платформа:
- Генерация контента с помощью Claude AI (тексты, подписи, хэштеги)
- Автопостинг в Telegram каналы через бота @postcentro_bot
- Подключение Instagram через OAuth (требуется Business/Creator аккаунт)
- Планирование публикаций через календарь
- Управление проектами и брендами
- Аналитика публикаций
- История всех созданных материалов

Навигация по сайту:
- Главная (/dashboard) — обзор активности и статистика
- Проекты (/projects) — управление брендами/проектами
- Создать контент (/create) — генерация нового контента через AI
- Календарь (/calendar) — планирование публикаций
- История (/history) — все созданные материалы
- Аналитика (/analytics) — статистика публикаций
- Интеграции (/integrations) — подключение Telegram и Instagram

Как подключить Telegram:
1. Добавь бота @postcentro_bot в канал как администратора
2. Зайди в Интеграции → Добавить канал
3. Введи ID канала (@mychannel или числовой ID)
4. Нажми Проверить и сохрани

Как подключить Instagram:
1. Нужен Business или Creator аккаунт Instagram
2. Зайди в Интеграции → Подключить Instagram
3. Авторизуйся через Facebook (Instagram принадлежит Meta)
4. Выбери нужный аккаунт

Как создать контент:
1. Создай проект в разделе Проекты
2. Зайди в Создать контент
3. Выбери проект, опиши тему
4. AI сгенерирует текст, подписи и хэштеги
5. Можешь запланировать публикацию или опубликовать сразу

Отвечай кратко, по делу, на том языке на котором пишет пользователь. Если не знаешь ответа — честно скажи.`;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rl = await rateLimit(`support:${ip}`, 15, 3600);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "too_many_requests", retryAfter: rl.retryAfter },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
      );
    }

    const { messages } = await request.json();

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    return NextResponse.json({ text });
  } catch (error) {
    console.error("Support chat error:", error);
    return NextResponse.json({ error: "Ошибка" }, { status: 500 });
  }
}
