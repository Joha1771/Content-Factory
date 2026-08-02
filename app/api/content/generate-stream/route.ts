import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { queryOne, query } from "@/lib/db";
import { spendTokens, refundTokens } from "@/lib/ai/tokens";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `Ты — профессиональный SMM-копирайтер MVI Content Factory.
Отвечай ТОЛЬКО валидным JSON без markdown. Пиши живо, без воды.`;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const gate = await spendTokens(user.id, "post_generate");
  if (!gate.ok) return new Response(JSON.stringify({ error: "insufficient_tokens", remaining: gate.remaining, required: gate.required }), { status: 402, headers: { "Content-Type": "application/json" } });

  const body = await request.json();
  const { projectId, platform, contentType, goal, topic, imageUrl, campaignId } = body;

  const project = await queryOne<any>(
    "SELECT * FROM projects WHERE id = $1 AND user_id = $2",
    [projectId, user.id]
  );
  if (!project) return new Response("Project not found", { status: 404 });

  const recentContents = await query<{ caption: string }>(
    "SELECT caption FROM contents WHERE project_id = $1 AND status = 'published' ORDER BY created_at DESC LIMIT 3",
    [projectId]
  );
  const recentPosts = recentContents.map((c) => c.caption).filter(Boolean);

  const prompt = `БРЕНД: ${project.name}
НИША: ${project.niche || ""}, ТОН: ${project.tone}, ЯЗЫК: ${project.language}
АУДИТОРИЯ: ${project.audience || ""}, ПЛАТФОРМА: ${platform}
ТИП: ${contentType}, ЦЕЛЬ: ${goal}, ТЕМА: ${topic}
${project.stop_words ? `СТОП-СЛОВА: ${project.stop_words}` : ""}
${recentPosts.length ? `ПРИМЕРЫ СТИЛЯ:\n${recentPosts.map((p, i) => `${i + 1}. ${p}`).join("\n")}` : ""}

Ответь JSON: {"title":"...","idea":"...","hook":"...","caption":"...","hashtags":["..."],"cta":"...","script":[],"voiceover":"","screen_text":""}`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send("status", { message: "Анализирую бренд..." });

        const anthropicStream = client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 3000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        });

        let fullText = "";
        let statusSent = false;

        for await (const chunk of anthropicStream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            fullText += chunk.delta.text;

            if (!statusSent && fullText.includes('"hook"')) {
              send("status", { message: "Пишу хук..." });
              statusSent = true;
            }
            if (fullText.includes('"caption"') && statusSent) {
              send("status", { message: "Создаю текст поста..." });
              statusSent = false;
            }
            if (fullText.includes('"hashtags"')) {
              send("status", { message: "Подбираю хэштеги..." });
            }

            if (fullText.length % 20 === 0) {
              send("chunk", { text: chunk.delta.text });
            }
          }
        }

        send("status", { message: "Финализирую..." });

        const clean = fullText.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
        const generated = JSON.parse(clean);

        const content = await queryOne<any>(
          `INSERT INTO contents (user_id, project_id, campaign_id, type, platform, goal, title, idea, hook, script, voiceover, screen_text, caption, hashtags, cta, source_image_url, status, ai_model, ai_tokens)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'generated', 'claude-sonnet-4-6', 3000)
           RETURNING *`,
          [
            user.id, projectId, campaignId || null, contentType, platform, goal,
            generated.title, generated.idea, generated.hook,
            JSON.stringify(generated.script || []),
            generated.voiceover || "", generated.screen_text || "",
            generated.caption, generated.hashtags || [], generated.cta, imageUrl || null,
          ]
        );

        send("done", { content: { ...generated, id: content?.id } });
      } catch (err: unknown) {
        await refundTokens(user.id, "post_generate");
        const msg = err instanceof Error ? err.message : "Generation failed";
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
