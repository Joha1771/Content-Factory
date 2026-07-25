import { getCurrentUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { queryOne, query } from "@/lib/db";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function tashkentTime(): string {
  return new Date().toLocaleString("ru-RU", {
    timeZone: "Asia/Tashkent",
    weekday: "long", hour: "2-digit", minute: "2-digit",
  });
}

async function buildContext(userId: string, pathname: string): Promise<string> {
  const lines: string[] = [`Время: ${tashkentTime()} (Ташкент)`];

  // ── Campaign page ──────────────────────────────────────────────────────────
  const campaignMatch = pathname.match(/\/campaigns\/([a-f0-9-]{36})/);
  if (campaignMatch) {
    const campaign = await queryOne<any>(
      `SELECT ac.*, p.name AS project_name, p.niche, p.audience, p.description
       FROM ad_campaigns ac
       LEFT JOIN projects p ON ac.project_id = p.id
       WHERE ac.id = $1 AND ac.user_id = $2`,
      [campaignMatch[1], userId]
    );
    if (campaign) {
      const creativesCount = await queryOne<{ cnt: string }>(
        "SELECT COUNT(*) AS cnt FROM ad_creatives WHERE campaign_id = $1",
        [campaign.id]
      );
      const platforms = Array.isArray(campaign.platforms)
        ? campaign.platforms.join(", ")
        : typeof campaign.platforms === "string"
          ? campaign.platforms
          : "не указаны";
      const daysLeft = campaign.date_to
        ? Math.max(0, Math.ceil((new Date(campaign.date_to).getTime() - Date.now()) / 86400000))
        : null;

      lines.push(`Страница: Кампания "${campaign.name}"`);
      lines.push(`Цель: ${campaign.goal || "не указана"}`);
      lines.push(`Платформы: ${platforms}`);
      if (campaign.budget) lines.push(`Бюджет: ${campaign.budget}`);
      if (daysLeft !== null) lines.push(`До конца кампании: ${daysLeft} дн.`);
      lines.push(`Создано контента: ${creativesCount?.cnt ?? 0} шт.`);
      if (campaign.product) lines.push(`Продукт: ${campaign.product}`);
      if (campaign.audience) lines.push(`Аудитория: ${campaign.audience}`);
      if (campaign.project_name) lines.push(`Проект: ${campaign.project_name} (${campaign.niche || "без ниши"})`);
      return lines.join("\n");
    }
  }

  // ── Single project page ────────────────────────────────────────────────────
  const projectMatch = pathname.match(/\/projects\/([a-f0-9-]{36})/);
  if (projectMatch) {
    const project = await queryOne<any>(
      "SELECT * FROM projects WHERE id = $1 AND user_id = $2",
      [projectMatch[1], userId]
    );
    if (project) {
      const postsCount = await queryOne<{ cnt: string }>(
        "SELECT COUNT(*) AS cnt FROM contents WHERE project_id = $1 AND status = 'published'",
        [project.id]
      );
      lines.push(`Страница: Проект "${project.name}"`);
      lines.push(`Ниша: ${project.niche || "не указана"}`);
      if (project.audience) lines.push(`Аудитория: ${project.audience}`);
      if (project.description) lines.push(`О проекте: ${project.description}`);
      lines.push(`Опубликовано постов: ${postsCount?.cnt ?? 0}`);
      return lines.join("\n");
    }
  }

  // ── Create content page ────────────────────────────────────────────────────
  if (pathname.includes("/create")) {
    const project = await queryOne<any>(
      "SELECT * FROM projects WHERE user_id = $1 AND is_active = true ORDER BY updated_at DESC LIMIT 1",
      [userId]
    );
    const recentPosts = await queryOne<{ cnt: string; last_date: string }>(
      `SELECT COUNT(*) AS cnt, MAX(created_at::text) AS last_date
       FROM contents WHERE user_id = $1 AND status = 'published'`,
      [userId]
    );
    lines.push("Страница: Создание контента");
    if (project) {
      lines.push(`Активный проект: ${project.name} (${project.niche || "без ниши"})`);
      if (project.audience) lines.push(`Аудитория: ${project.audience}`);
    }
    if (recentPosts) {
      lines.push(`Всего опубликовано постов: ${recentPosts.cnt}`);
      if (recentPosts.last_date) {
        const daysAgo = Math.floor((Date.now() - new Date(recentPosts.last_date).getTime()) / 86400000);
        if (daysAgo >= 0) lines.push(`Последний пост: ${daysAgo === 0 ? "сегодня" : `${daysAgo} дн. назад`}`);
      }
    }
    return lines.join("\n");
  }

  // ── Projects list ─────────────────────────────────────────────────────────
  if (pathname.includes("/projects")) {
    const projects = await query<any>(
      "SELECT id, name, niche, is_active FROM projects WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 5",
      [userId]
    );
    lines.push("Страница: Проекты");
    if (projects.length > 0) {
      lines.push(`Проектов всего: ${projects.length}`);
      lines.push(`Последние: ${projects.slice(0, 3).map((p: any) => `"${p.name}" (${p.niche || "без ниши"})`).join(", ")}`);
    }
    return lines.join("\n");
  }

  // ── Campaigns list ────────────────────────────────────────────────────────
  if (pathname.includes("/campaigns")) {
    const campaigns = await query<any>(
      "SELECT id, name, goal, status FROM ad_campaigns WHERE user_id = $1 ORDER BY created_at DESC LIMIT 3",
      [userId]
    );
    lines.push("Страница: Кампании");
    if (campaigns.length > 0) {
      lines.push(`Активных кампаний: ${campaigns.filter((c: any) => c.status === "active").length}`);
      lines.push(`Последние: ${campaigns.map((c: any) => `"${c.name}"`).join(", ")}`);
    }
    return lines.join("\n");
  }

  // ── Landings ──────────────────────────────────────────────────────────────
  if (pathname.includes("/landings")) {
    const landings = await query<any>(
      "SELECT id, title, published FROM landings WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5",
      [userId]
    );
    const leads = await queryOne<{ cnt: string }>(
      "SELECT COUNT(*) AS cnt FROM leads WHERE user_id = $1",
      [userId]
    );
    lines.push("Страница: Лендинги");
    lines.push(`Лендингов создано: ${landings.length} (опубликовано: ${landings.filter((l: any) => l.published).length})`);
    lines.push(`Всего заявок получено: ${leads?.cnt ?? 0}`);
    return lines.join("\n");
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  const project = await queryOne<any>(
    "SELECT name, niche FROM projects WHERE user_id = $1 AND is_active = true ORDER BY updated_at DESC LIMIT 1",
    [userId]
  );
  lines.push(`Страница: ${pathname.split("/").pop() || "дашборд"}`);
  if (project) lines.push(`Активный проект: ${project.name} (${project.niche || "бизнес"})`);
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch {}
  const pathname: string = body.pathname ?? body.page ?? "";

  let context = `Страница: ${pathname.split("/").filter(Boolean).pop() ?? "дашборд"}`;
  try {
    context = await buildContext(user.id, pathname);
  } catch (err: any) {
    console.error("[page-advice] buildContext error:", err?.message);
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `Ты — AI-советник по маркетингу и SMM для владельца бизнеса в Узбекистане.

ВАЖНО: Ты советуешь ВЛАДЕЛЬЦУ БИЗНЕСА как продвигать его компанию в соцсетях.
НЕ советуй как улучшить платформу, добавить функции или изменить интерфейс.
НЕ говори про фильтры, кнопки, колонки, UI — это не твоя задача.
Твои советы — про КОНТЕНТ, МАРКЕТИНГ, РЕКЛАМУ, АУДИТОРИЮ.

ДАННЫЕ О БИЗНЕСЕ:
${context}

ЗАДАЧА:
Дай 3 конкретных маркетинговых совета, основываясь на данных выше.
Примеры правильных советов:
- "У тебя 0 постов за последние 5 дней — опубликуй фото блюда сегодня пока есть время"
- "В кампании 'Летняя акция' осталось 23 дня — пора запустить второй этап со скидкой"
- "Ресторан вав ещё не выкладывал Reels — попробуй 30-секундное видео про кухню, ресторанные Reels набирают в 4х больше охвата"

Говори как наставник: конкретно, коротко, про их бизнес.
Называй название проекта/кампании если оно есть в данных.

Верни ТОЛЬКО валидный JSON (без markdown):
{"tips":[{"icon":"эмодзи","text":"совет","task":"краткое название задачи (до 60 символов)"},{"icon":"эмодзи","text":"совет","task":"задача"},{"icon":"эмодзи","text":"совет","task":"задача"}]}`,
      }],
    });

    const raw = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = raw.replace(/^```json\s*/m, "").replace(/```\s*$/m, "").trim();
    const parsed = JSON.parse(cleaned);
    const contextLabel = context.split("\n").find(l => l.startsWith("Страница:"))?.replace("Страница: ", "") ?? "";
    return NextResponse.json({ tips: parsed.tips ?? [], context: contextLabel });
  } catch (err: any) {
    console.error("[page-advice] error:", err?.message);
    return NextResponse.json({ tips: [], context: "" }, { status: 500 });
  }
}
