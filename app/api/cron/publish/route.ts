import { query, queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
const BOT_TOKEN = process.env.BOT_TOKEN!;
const CRON_SECRET = process.env.CRON_SECRET;
const ADMIN_CHAT_ID = process.env.ADMIN_TELEGRAM_CHAT_ID;
const MAX_ATTEMPTS = 3;

export async function POST(req: NextRequest) {
  if (CRON_SECRET) {
    const secret = req.headers.get("x-cron-secret");
    if (secret !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Atomic claim: grabs pending posts AND stale 'publishing' ones (>10 min = prior run died).
  // FOR UPDATE SKIP LOCKED prevents two concurrent cron runs from claiming the same row.
  const duePosts = await query<{
    id: string;
    content_id: string;
    platform: string;
    attempts: number;
    caption: string | null;
    hashtags: string[] | null;
    source_image_url: string | null;
    user_id: string;
  }>(
    `WITH claimed AS (
       UPDATE scheduled_posts sp
       SET status = 'processing', claimed_at = NOW()
       WHERE sp.id IN (
         SELECT id FROM scheduled_posts
         WHERE scheduled_at <= NOW()
           AND (status = 'pending'
                OR (status = 'processing' AND claimed_at < NOW() - INTERVAL '10 minutes'))
         ORDER BY scheduled_at
         LIMIT 50
         FOR UPDATE SKIP LOCKED
       )
       RETURNING sp.id, sp.content_id, sp.platform, sp.attempts
     )
     SELECT cl.id, cl.content_id, cl.platform, cl.attempts,
            c.caption, c.hashtags, c.source_image_url, c.user_id
     FROM claimed cl JOIN contents c ON cl.content_id = c.id`
  );

  let published = 0;
  let retrying = 0;
  let failed = 0;
  const failedFinal: Array<{ id: string; content_id: string; error: string }> = [];

  for (const post of duePosts) {
    let errorMsg: string | null = null;
    let succeeded = false;

    try {
      const integration = await queryOne<{ token: string; channel_id: string }>(
        "SELECT token, channel_id FROM integrations WHERE platform = 'telegram' AND is_active = true AND user_id = $1 LIMIT 1",
        [post.user_id]
      );

      if (post.platform === "telegram" && integration) {
        const text = `${post.caption || ""}\n\n${(post.hashtags || []).join(" ")}`.trim();
        const imageUrl = post.source_image_url;
        const endpoint = imageUrl ? "sendPhoto" : "sendMessage";
        const body = imageUrl
          ? { chat_id: integration.channel_id, photo: imageUrl, caption: text, parse_mode: "HTML" }
          : { chat_id: integration.channel_id, text, parse_mode: "HTML" };

        const res = await fetch(
          `https://api.telegram.org/bot${integration.token || BOT_TOKEN}/${endpoint}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
        );
        const tgData = await res.json();

        if (tgData.ok) {
          await query(
            "UPDATE scheduled_posts SET status = 'published', published_at = NOW(), telegram_message_id = $1 WHERE id = $2",
            [tgData.result.message_id, post.id]
          );
          await query(
            "UPDATE contents SET status = 'published', published_at = NOW() WHERE id = $1",
            [post.content_id]
          );
          succeeded = true;
        } else {
          errorMsg = tgData.description ?? "Telegram error";
        }
      } else {
        if (MAKE_WEBHOOK_URL) {
          await fetch(MAKE_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contentId: post.content_id,
              platform: post.platform,
              caption: post.caption,
              hashtags: post.hashtags,
              image_url: post.source_image_url,
            }),
          });
        }
        await query(
          "UPDATE scheduled_posts SET status = 'published', published_at = NOW() WHERE id = $1",
          [post.id]
        );
        await query(
          "UPDATE contents SET status = 'published', published_at = NOW() WHERE id = $1",
          [post.content_id]
        );
        succeeded = true;
      }
    } catch (err: any) {
      errorMsg = err?.message ?? "Unknown error";
    }

    if (succeeded) {
      published++;
      continue;
    }

    const next = post.attempts + 1;
    const nextStatus = next >= MAX_ATTEMPTS ? "failed" : "pending";
    await query(
      "UPDATE scheduled_posts SET status = $1, attempts = $2, last_error = $3 WHERE id = $4",
      [nextStatus, next, errorMsg, post.id]
    );

    if (nextStatus === "failed") {
      failedFinal.push({ id: post.id, content_id: post.content_id, error: errorMsg ?? "Unknown error" });
      failed++;
    } else {
      retrying++;
    }
  }

  // Single alert for all final failures — only after MAX_ATTEMPTS exhausted, not on retries.
  if (failedFinal.length > 0 && ADMIN_CHAT_ID && BOT_TOKEN) {
    try {
      const lines = failedFinal
        .slice(0, 10)
        .map((f) => `• ${f.content_id}: ${f.error}`)
        .join("\n");
      const text =
        `⚠️ Публикация: ${failedFinal.length} пост(ов) не опубликованы после ${MAX_ATTEMPTS} попыток.\n` +
        lines;
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text }),
      });
    } catch {
      // alert failure must not affect cron response
    }
  }

  return NextResponse.json({ published, retrying, failed });
}
