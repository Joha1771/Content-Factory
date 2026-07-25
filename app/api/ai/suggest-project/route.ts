import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { spendTokens, refundTokens } from "@/lib/ai/tokens";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await spendTokens(user.id, "project_ai");
  if (!gate.ok) return NextResponse.json({ error: "insufficient_tokens", remaining: gate.remaining, required: gate.required }, { status: 402 });

  const { name, niche, keywords, logoBase64, logoMime } = await request.json();

  try {
    // AI fill from logo image — returns ALL fields
    if (logoBase64) {
      const mime = (logoMime || "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp";
      const isUrl = logoBase64.startsWith("http") || logoBase64.startsWith("/");

      const prompt = `Ты опытный маркетолог и SMM-специалист. Внимательно изучи логотип бренда и заполни все поля профиля бренда для платформы управления контентом.

${name ? `Название бренда: ${name}` : "Определи название бренда по логотипу если возможно."}

Верни ТОЛЬКО JSON без markdown и без пояснений:
{
  "name": "название бренда (если можно определить по логотипу, иначе оставь пустым)",
  "description": "2-3 предложения: чем занимается бренд, что предлагает, ключевые ценности (до 250 символов)",
  "audience": "целевая аудитория: возраст, пол, интересы, боли, география СНГ (до 180 символов)",
  "tone": "один из вариантов: friendly | professional | humorous | formal",
  "niche": "одна из ниш: Еда и напитки | Одежда и мода | Красота и уход | IT / Технологии | Образование | Спорт и здоровье | Строительство | Товары для дома | Услуги | Другое",
  "language": "ru | uz | en",
  "keywords": "8-12 ключевых слов через запятую для SEO и рекламы"
}`;

      const imageSource = (isUrl
        ? { type: "url", url: logoBase64.startsWith("/") ? `${process.env.NEXT_PUBLIC_APP_URL}${logoBase64}` : logoBase64 }
        : { type: "base64", media_type: mime, data: logoBase64.includes(",") ? logoBase64.split(",")[1] : logoBase64 }) as any;

      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: imageSource },
            { type: "text", text: prompt },
          ],
        }],
      });

      const text = (message.content[0] as { text: string }).text;
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      return NextResponse.json({ ...parsed, fromImage: true });
    }

    // Text-only fill — description, audience, keywords
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const prompt = `Ты маркетолог. На основе названия и ниши бизнеса напиши краткое описание бренда, целевую аудиторию и ключевые слова.

Название: ${name}
Ниша: ${niche || "не указана"}
Ключевые слова (если уже есть): ${keywords || "нет"}

Верни ТОЛЬКО JSON без markdown:
{
  "description": "2-3 предложения о бренде: чем занимается, что предлагает, ценности (до 200 символов)",
  "audience": "целевая аудитория: возраст, интересы, боли, география (до 150 символов)",
  "keywords": "7-10 ключевых слов через запятую для SEO и рекламы"
}`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (message.content[0] as { text: string }).text;
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    return NextResponse.json(parsed);
  } catch (err: any) {
    await refundTokens(user.id, "project_ai");
    console.error("[ai/suggest-project]", err?.message || err);
    return NextResponse.json({ error: err?.message || "Generation failed" }, { status: 500 });
  }
}
