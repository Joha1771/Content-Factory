import { getCurrentUser } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import { generateContent } from "@/lib/ai/claude";
import { NextResponse } from "next/server";
import { spendTokens, refundTokens } from "@/lib/ai/tokens";

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

    if (!projectId || !platform || !contentType || !goal || !topic) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Rate limit: 20 генераций в час
    const recentCount = await queryOne<{ count: string }>(
      "SELECT COUNT(*) as count FROM contents WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '1 hour'",
      [user.id]
    );
    if (parseInt(recentCount?.count ?? "0") >= 20) {
      return NextResponse.json({ error: "Rate limit exceeded. Max 20 generations per hour." }, { status: 429 });
    }

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

    const generated = await generateContent({
      projectName: project.name,
      niche: project.niche || "",
      description: project.description || "",
      audience: project.audience || "",
      tone: project.tone,
      language: project.language,
      platform,
      contentType,
      goal,
      topic,
      imageUrl,
      stopWords: project.stop_words || null,
      recentPosts,
    });

    const content = await queryOne<any>(
      `INSERT INTO contents (user_id, project_id, campaign_id, type, platform, goal, title, idea, hook, script, voiceover, screen_text, caption, hashtags, cta, source_image_url, status, ai_model, ai_tokens)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'generated', 'claude-sonnet-4-6', 3000)
       RETURNING *`,
      [
        user.id, projectId, campaignId || null, contentType, platform, goal,
        generated.title, generated.idea, generated.hook,
        JSON.stringify(generated.script || []),
        generated.voiceover || "",
        generated.screen_text || "",
        generated.caption,
        generated.hashtags || [],
        generated.cta,
        imageUrl || null,
      ]
    );

    return NextResponse.json({ content });
  } catch (error: unknown) {
    if (gateOk) await refundTokens(userId, "post_generate");
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
