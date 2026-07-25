import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { spendTokens, refundTokens } from "@/lib/ai/tokens";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const gate = await spendTokens(user.id, "image_gen");
  if (!gate.ok) return NextResponse.json({ error: "insufficient_tokens", remaining: gate.remaining, required: gate.required }, { status: 402 });

  const { prompt, style = "vivid" } = await request.json();
  if (!prompt) return NextResponse.json({ error: "Missing prompt" }, { status: 400 });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 500 });

  const fullPrompt = `${prompt}. Professional social media post visual. High quality, modern design, ${style === "vivid" ? "vibrant colors" : "natural realistic"}.`;

  try {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: "dall-e-3", prompt: fullPrompt, n: 1, size: "1024x1024", quality: "standard", style }),
    });

    const data = await res.json();
    if (!res.ok) {
      await refundTokens(user.id, "image_gen");
      return NextResponse.json({ error: data.error?.message || "Generation failed" }, { status: 500 });
    }

    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) {
      await refundTokens(user.id, "image_gen");
      return NextResponse.json({ error: "No image generated" }, { status: 500 });
    }

    return NextResponse.json({ url: imageUrl });
  } catch (err: any) {
    await refundTokens(user.id, "image_gen");
    console.error("[ai/generate-image]", err?.message);
    return NextResponse.json({ error: err?.message || "Generation failed" }, { status: 500 });
  }
}
