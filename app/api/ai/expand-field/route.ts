import { getCurrentUser } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch {}

  const { value, fieldLabel, postType, projectId } = body;
  if (!value?.trim()) return NextResponse.json({ error: "Нет текста" }, { status: 400 });

  let projectContext = "";
  if (projectId) {
    try {
      const project = await queryOne<any>(
        "SELECT name, niche, audience FROM projects WHERE id = $1 AND user_id = $2",
        [projectId, user.id]
      );
      if (project) {
        projectContext = `Бизнес: ${project.name}${project.niche ? ` (${project.niche})` : ""}`;
        if (project.audience) projectContext += `\nАудитория: ${project.audience}`;
      }
    } catch {}
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 180,
      messages: [{
        role: "user",
        content: `${projectContext ? projectContext + "\n\n" : ""}Поле формы: "${fieldLabel}"
Тип поста: ${postType || "пост"}
Пользователь написал: "${value.trim()}"

Расширь это в красивый конкретный текст для данного поля.
Правила:
- Только текст для этого поля, без лишних слов
- Живой язык, конкретика, никаких клише
- 1-2 предложения, не длиннее
- Без хэштегов, без призывов к действию
- Без кавычек в ответе

Верни только готовый текст.`,
      }],
    });

    const expanded = message.content[0].type === "text" ? message.content[0].text.trim() : value;
    return NextResponse.json({ expanded });
  } catch (err: any) {
    console.error("[expand-field]", err?.message);
    return NextResponse.json({ error: "Ошибка AI" }, { status: 500 });
  }
}
