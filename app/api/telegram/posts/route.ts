import { getCurrentUser } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
import { NextResponse } from "next/server";

const BOT_TOKEN = process.env.BOT_TOKEN!;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "30"), 50);

  const integration = await queryOne<{ channel_id: string; channel_name: string }>(
    "SELECT channel_id, channel_name FROM integrations WHERE user_id = $1 AND platform = 'telegram' AND is_active = true ORDER BY created_at DESC LIMIT 1",
    [user.id]
  );

  if (!integration) return NextResponse.json({ messages: [] });

  const logs = await query<any>(
    `SELECT pl.id, pl.created_at, pl.telegram_message_id, pl.platform, pl.status, pl.content_id,
            c.id as c_id, c.title, c.caption, c.source_image_url, c.platform as c_platform, c.type as content_type
     FROM publish_logs pl
     LEFT JOIN contents c ON pl.content_id = c.id
     WHERE pl.platform = 'telegram' AND pl.status = 'published' AND pl.content_id IS NOT NULL
     ORDER BY pl.created_at DESC LIMIT $1`,
    [limit]
  );

  if (!logs.length) return NextResponse.json({ messages: [], note: "no_posts_yet" });

  const { channel_id: channelId, channel_name: channelName } = integration;

  const messages = await Promise.all(
    logs.map(async (log: any) => {
      let views = 0;
      let forwards = 0;
      let reactions: Record<string, number> = {};

      if (log.telegram_message_id) {
        try {
          const statsRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMessageStatistics`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: channelId, message_id: log.telegram_message_id }),
          });
          const stats = await statsRes.json();
          if (stats.ok) {
            views = stats.result?.views ?? 0;
            forwards = stats.result?.forwards ?? 0;
          }

          const reactRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMessageReactionCount`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: channelId, message_id: log.telegram_message_id }),
          });
          const reactData = await reactRes.json();
          if (reactData.ok && reactData.result?.reactions) {
            for (const r of reactData.result.reactions) {
              const emoji = r.type?.emoji ?? "👍";
              reactions[emoji] = (reactions[emoji] ?? 0) + (r.count ?? 0);
            }
          }
        } catch {}
      }

      const text = log.body ?? log.caption ?? log.title ?? "";
      return {
        id: log.id,
        content_id: log.content_id,
        message_id: log.telegram_message_id,
        platform: "telegram",
        text,
        image_url: log.source_image_url ?? null,
        date: log.created_at,
        views,
        shares: forwards,
        reactions,
        url: log.telegram_message_id && channelName
          ? `https://t.me/${channelName.replace("@", "")}/${log.telegram_message_id}`
          : null,
        channel_name: channelName,
        type: log.content_type ?? "post",
      };
    })
  );

  return NextResponse.json({ messages });
}
