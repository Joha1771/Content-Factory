import { query, queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
const BOT_TOKEN = process.env.BOT_TOKEN!;
const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(req: NextRequest) {
  if (CRON_SECRET) {
    const secret = req.headers.get("x-cron-secret");
    if (secret !== CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date().toISOString();

  const duePosts = await query<any>(
    `SELECT sp.id, sp.content_id, sp.platform, c.caption, c.hashtags, c.source_image_url, c.user_id
     FROM scheduled_posts sp
     JOIN contents c ON sp.content_id = c.id
     WHERE sp.status = 'pending' AND sp.scheduled_at <= $1
     LIMIT 50`,
    [now]
  );

  let published = 0;
  let failed = 0;

  for (const post of duePosts) {
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

        const res = await fetch(`https://api.telegram.org/bot${integration.token || BOT_TOKEN}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const tgData = await res.json();

        if (tgData.ok) {
          await query("UPDATE scheduled_posts SET status = 'published', published_at = NOW(), telegram_message_id = $1 WHERE id = $2", [tgData.result.message_id, post.id]);
          await query("UPDATE contents SET status = 'published', published_at = NOW() WHERE id = $1", [post.content_id]);
          published++;
        } else {
          await query("UPDATE scheduled_posts SET status = 'failed' WHERE id = $1", [post.id]);
          failed++;
        }
      } else {
        if (MAKE_WEBHOOK_URL) {
          await fetch(MAKE_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contentId: post.content_id, platform: post.platform, caption: post.caption, hashtags: post.hashtags, image_url: post.source_image_url }),
          });
        }
        await query("UPDATE scheduled_posts SET status = 'published', published_at = NOW() WHERE id = $1", [post.id]);
        await query("UPDATE contents SET status = 'published', published_at = NOW() WHERE id = $1", [post.content_id]);
        published++;
      }
    } catch {
      await query("UPDATE scheduled_posts SET status = 'failed' WHERE id = $1", [post.id]);
      failed++;
    }
  }

  return NextResponse.json({ published, failed, total: duePosts.length });
}
