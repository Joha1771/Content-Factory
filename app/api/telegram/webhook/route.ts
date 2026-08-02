import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.BOT_TOKEN!;

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body?.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId: number = message.chat.id;
    const text: string = message.text || "";

    if (text.startsWith("/start")) {
      await sendMessage(chatId, `👋 Привет! Я бот *MVI Content Factory*.\n\nЯ буду отправлять тебе уведомления когда:\n🔔 Клиент оставил заявку на твоём лендинге\n📊 Еженедельный отчёт по лидам\n\nЧтобы подключить уведомления:\n1. Зайди в *Профиль* → вкладка *Telegram*\n2. Нажми *"Привязать Telegram"*\n3. Получи код и отправь мне: \`/link КОД\``);
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith("/link ")) {
      const token = text.replace("/link ", "").trim();
      if (!token) {
        await sendMessage(chatId, "❌ Укажи код. Пример: `/link ABC123`");
        return NextResponse.json({ ok: true });
      }

      const profile = await queryOne<{ id: string; telegram_chat_id: string | null }>(
        "SELECT id, telegram_chat_id FROM profiles WHERE telegram_link_token = $1",
        [token]
      );

      if (!profile) {
        await sendMessage(chatId, "❌ Неверный или устаревший код. Получи новый в Профиле на сайте.");
        return NextResponse.json({ ok: true });
      }

      if (profile.telegram_chat_id) {
        await sendMessage(chatId, "✅ Telegram уже привязан к этому аккаунту!");
        return NextResponse.json({ ok: true });
      }

      await query(
        "UPDATE profiles SET telegram_chat_id = $1, telegram_link_token = NULL WHERE id = $2",
        [String(chatId), profile.id]
      );

      await sendMessage(chatId, `✅ *Telegram успешно привязан!*\n\nТеперь ты будешь мгновенно получать уведомления:\n🔔 Новая заявка с лендинга — имя и телефон клиента\n📊 Еженедельный отчёт по лидам\n\nУправляй уведомлениями в настройках каждого лендинга.`);
      return NextResponse.json({ ok: true });
    }

    await sendMessage(chatId, "Используй /start для начала или /link КОД для привязки аккаунта.");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
