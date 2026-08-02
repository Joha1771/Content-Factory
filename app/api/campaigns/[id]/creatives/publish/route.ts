import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.BOT_TOKEN;
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
const IG_API = "https://graph.instagram.com/v22.0";

function extractText(platform: string, content: Record<string, any>): string {
  if (platform === "telegram") {
    const text = content.caption ?? content.text ?? "";
    return text;
  }
  if (platform === "instagram") {
    const parts = [content.caption ?? ""];
    if (Array.isArray(content.hashtags) && content.hashtags.length > 0) {
      parts.push(content.hashtags.map((h: string) => (h.startsWith("#") ? h : `#${h}`)).join(" "));
    }
    return parts.filter(Boolean).join("\n\n");
  }
  if (platform === "tiktok" || platform === "youtube") {
    return [content.hook ?? "", content.caption ?? "", content.description ?? ""].filter(Boolean).join("\n\n");
  }
  if (platform === "meta") {
    return [content.primary_text ?? content.caption ?? "", content.headline ?? "", content.description ?? ""].filter(Boolean).join("\n");
  }
  if (platform === "google") {
    const headlines = (content.headlines as string[] | undefined)?.join(" | ") ?? content.headline ?? "";
    const descs = (content.descriptions as string[] | undefined)?.join(" ") ?? "";
    return [headlines, descs].filter(Boolean).join("\n");
  }
  if (platform === "yandex") {
    return [content.headline ?? "", content.text ?? ""].filter(Boolean).join("\n");
  }
  return content.caption ?? content.text ?? content.headline ?? "";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: campaignId } = await params;
  const { creativeId } = await request.json();
  if (!creativeId) return NextResponse.json({ error: "Missing creativeId" }, { status: 400 });

  const creative = await queryOne<any>(
    `SELECT ac.* FROM ad_creatives ac
     JOIN ad_campaigns c ON ac.campaign_id = c.id
     WHERE ac.id = $1 AND ac.campaign_id = $2 AND c.user_id = $3`,
    [creativeId, campaignId, user.id]
  );
  if (!creative) return NextResponse.json({ error: "Creative not found" }, { status: 404 });

  const platform: string = creative.platform;
  const rawContent = typeof creative.content === "string"
    ? JSON.parse(creative.content)
    : (creative.content ?? {});

  const markPublished = () =>
    query("UPDATE ad_creatives SET status = 'published', updated_at = NOW() WHERE id = $1", [creativeId]);

  // ─── Telegram ───────────────────────────────────────────────────
  if (platform === "telegram") {
    if (!BOT_TOKEN) {
      return NextResponse.json({ error: "BOT_TOKEN не настроен на сервере" }, { status: 500 });
    }
    const integration = await queryOne<{ channel_id: string }>(
      "SELECT channel_id FROM integrations WHERE platform = 'telegram' AND is_active = true AND user_id = $1 LIMIT 1",
      [user.id]
    );
    if (!integration) {
      return NextResponse.json({ error: "Telegram канал не подключён. Зайди в Интеграции и подключи." }, { status: 400 });
    }

    const text = extractText("telegram", rawContent);
    if (!text) return NextResponse.json({ error: "Нет текста для публикации" }, { status: 400 });

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: integration.channel_id, text, parse_mode: "HTML" }),
    });
    const tgData = await res.json();
    if (!tgData.ok) {
      return NextResponse.json({ error: tgData.description ?? "Ошибка Telegram" }, { status: 500 });
    }
    await markPublished();
    return NextResponse.json({ ok: true, platform: "telegram", message_id: tgData.result?.message_id });
  }

  // ─── Instagram ──────────────────────────────────────────────────
  if (platform === "instagram") {
    const integration = await queryOne<{ token: string; channel_id: string }>(
      "SELECT token, channel_id FROM integrations WHERE user_id = $1 AND platform = 'instagram' AND is_active = true LIMIT 1",
      [user.id]
    );
    if (!integration) {
      return NextResponse.json({ error: "Instagram не подключён. Зайди в Интеграции." }, { status: 400 });
    }

    const caption = extractText("instagram", rawContent);
    const imageUrl: string | undefined = rawContent.image_url ?? rawContent.source_image_url;

    if (!imageUrl) {
      // Instagram требует медиа — если нет картинки, пробуем Make.com
      if (MAKE_WEBHOOK_URL) {
        await fetch(MAKE_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform: "instagram", caption, source: "campaign_creative", creativeId }),
        });
        await markPublished();
        return NextResponse.json({ ok: true, platform: "instagram", via: "make" });
      }
      return NextResponse.json({ error: "Instagram требует изображение. Добавь картинку к посту или настрой Make.com." }, { status: 400 });
    }

    try {
      const containerRes = await fetch(`${IG_API}/${integration.channel_id}/media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl, caption, access_token: integration.token }),
      });
      const containerData = await containerRes.json();
      if (containerData.error) throw new Error(containerData.error.message);

      const publishRes = await fetch(`${IG_API}/${integration.channel_id}/media_publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creation_id: containerData.id, access_token: integration.token }),
      });
      const publishData = await publishRes.json();
      if (publishData.error) throw new Error(publishData.error.message);

      await markPublished();
      return NextResponse.json({ ok: true, platform: "instagram", ig_media_id: publishData.id });
    } catch (err: any) {
      return NextResponse.json({ error: err.message ?? "Instagram error" }, { status: 500 });
    }
  }

  // ─── TikTok / YouTube / Meta / Google / Yandex via Make.com ────
  if (MAKE_WEBHOOK_URL) {
    const text = extractText(platform, rawContent);
    await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, text, rawContent, source: "campaign_creative", creativeId }),
    });
    await markPublished();
    return NextResponse.json({ ok: true, platform, via: "make" });
  }

  // ─── Нет интеграции ─────────────────────────────────────────────
  const PLATFORM_NAMES: Record<string, string> = {
    tiktok: "TikTok", youtube: "YouTube",
    meta: "Meta Ads", google: "Google Ads", yandex: "Яндекс Директ",
  };
  return NextResponse.json(
    { error: `Прямая публикация в ${PLATFORM_NAMES[platform] ?? platform} пока не поддерживается. Настрой Make.com webhook в .env для автоматизации.` },
    { status: 400 }
  );
}
