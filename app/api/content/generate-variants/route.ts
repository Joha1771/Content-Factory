import { generateContent } from "@/lib/ai/claude";
import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { NextResponse } from "next/server";
import { spendTokens, refundTokens } from "@/lib/ai/tokens";

const TONE_VARIANTS = [
  { tone: "friendly", label: "Дружелюбный" },
  { tone: "viral", label: "Вирусный" },
  { tone: "expert", label: "Экспертный" },
];

export async function POST(request: Request) {
  let userId = "";
  let gateOk = false;
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = user.id;

    const gate = await spendTokens(user.id, "post_generate");
    if (!gate.ok) return NextResponse.json({ error: "insufficient_tokens", remaining: gate.remaining, required: gate.required }, { status: 402 });
    gateOk = true;

    const body = await request.json();
    const { projectId, platform, contentType, goal, topic, imageUrl, campaignId } = body;

    if (!projectId || !platform || !contentType || !goal || !topic)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const project = await queryOne<any>(
      "SELECT * FROM projects WHERE id = $1 AND user_id = $2",
      [projectId, user.id]
    );
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const recentContents = await query<{ caption: string }>(
      "SELECT caption FROM contents WHERE project_id = $1 AND status = 'published' ORDER BY created_at DESC LIMIT 3",
      [projectId]
    );
    const recentPosts = recentContents.map((c) => c.caption).filter(Boolean) as string[];

    const variantTones = project.tone
      ? [project.tone, ...TONE_VARIANTS.filter((t) => t.tone !== project.tone).map((t) => t.tone).slice(0, 2)]
      : TONE_VARIANTS.map((t) => t.tone);

    const results = await Promise.allSettled(
      variantTones.map((tone) =>
        generateContent({
          projectName: project.name,
          niche: project.niche || "",
          description: project.description || "",
          audience: project.audience || "",
          tone,
          language: project.language,
          platform,
          contentType,
          goal,
          topic,
          imageUrl,
          stopWords: project.stop_words || null,
          recentPosts,
        })
      )
    );

    const variants = results
      .map((r, i) => ({
        tone: variantTones[i],
        toneLabel: TONE_VARIANTS.find((t) => t.tone === variantTones[i])?.label || variantTones[i],
        content: r.status === "fulfilled" ? r.value : null,
        error: r.status === "rejected" ? (r.reason as Error).message : null,
      }))
      .filter((v) => v.content !== null);

    if (variants.length === 0) {
      await refundTokens(userId, "post_generate");
      return NextResponse.json({ error: "Все варианты не удалось сгенерировать" }, { status: 500 });
    }

    const savedVariants = await Promise.all(
      variants.map(async (v) => {
        const content = await queryOne<any>(
          `INSERT INTO contents (user_id, project_id, campaign_id, type, platform, goal, title, idea, hook, script, voiceover, screen_text, caption, hashtags, cta, source_image_url, status, ai_model, ai_tokens)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'generated', 'claude-sonnet-4-6', 3000)
           RETURNING id`,
          [
            user.id, projectId, campaignId || null, contentType, platform, goal,
            v.content!.title, v.content!.idea, v.content!.hook,
            JSON.stringify(v.content!.script || []),
            v.content!.voiceover || "", v.content!.screen_text || "",
            v.content!.caption, v.content!.hashtags || [], v.content!.cta, imageUrl || null,
          ]
        );
        return { ...v, id: content?.id, content: { ...v.content, id: content?.id } };
      })
    );

    return NextResponse.json({ variants: savedVariants });
  } catch (error: unknown) {
    if (gateOk) await refundTokens(userId, "post_generate");
    const msg = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
