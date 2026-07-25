import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const BOT_TOKEN = process.env.BOT_TOKEN;

// Fire-and-forget уведомление владельцу лендинга о новом лиде.
// Никогда не бросает исключение — сохранение лида важнее доставки пинга.
async function notifyOwner(
  ownerId: string | null,
  lead: { name?: string; phone?: string; email?: string; message?: string; title?: string }
) {
  if (!ownerId || !BOT_TOKEN) return;

  const owner = await queryOne<{ telegram_chat_id: string | null }>(
    "SELECT telegram_chat_id FROM profiles WHERE id = $1",
    [ownerId]
  );
  if (!owner?.telegram_chat_id) return;

  const text = [
    "🔔 Новый лид!",
    lead.title ? `Лендинг: ${lead.title}` : null,
    lead.name ? `Имя: ${lead.name}` : null,
    lead.phone ? `Телефон: ${lead.phone}` : null,
    lead.email ? `Email: ${lead.email}` : null,
    lead.message ? `Сообщение: ${lead.message}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: owner.telegram_chat_id, text }),
  });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const landingId = searchParams.get("landing_id");

  if (landingId) {
    const rows = await query(
      "SELECT * FROM leads WHERE landing_id = $1 ORDER BY created_at DESC",
      [landingId]
    );
    return NextResponse.json(rows);
  }

  const rows = await query(
    `SELECT l.*, la.title AS landing_title, la.slug AS landing_slug
     FROM leads l
     LEFT JOIN landings la ON la.id = l.landing_id
     WHERE la.user_id = $1
     ORDER BY l.created_at DESC
     LIMIT 200`,
    [user.id]
  );
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rlMin = await rateLimit(`leads-min:${ip}`, 10, 60);
    if (!rlMin.ok) {
      return NextResponse.json(
        { error: "too_many_requests", retryAfter: rlMin.retryAfter },
        { status: 429, headers: { "Retry-After": String(rlMin.retryAfter) } }
      );
    }
    const rlHr = await rateLimit(`leads-hr:${ip}`, 60, 3600);
    if (!rlHr.ok) {
      return NextResponse.json(
        { error: "too_many_requests", retryAfter: rlHr.retryAfter },
        { status: 429, headers: { "Retry-After": String(rlHr.retryAfter) } }
      );
    }

    const { landing_id, name, phone, email, message } = await request.json();
    if (!landing_id) return NextResponse.json({ error: "Missing landing_id" }, { status: 400 });

    const landing = await queryOne<{ user_id: string; title: string; content: any }>(
      "SELECT user_id, title, content FROM landings WHERE id = $1",
      [landing_id]
    );

    const routing = landing?.content?.settings?.routing ?? {};
    const crmEnabled      = routing.crm      !== false; // default true
    const aiCallback      = routing.aiCallback !== false; // default true

    if (crmEnabled) {
      await query(
        `INSERT INTO leads (landing_id, user_id, name, phone, email, message, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'new')`,
        [landing ? landing_id : null, landing?.user_id ?? null, name ?? null, phone ?? null, email ?? null, message ?? null]
      );
    }

    if (aiCallback) {
      notifyOwner(landing?.user_id ?? null, { name, phone, email, message, title: landing?.title }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[leads POST]", err?.message || err);
    return NextResponse.json({ error: err?.message || "Ошибка сервера" }, { status: 500 });
  }
}
