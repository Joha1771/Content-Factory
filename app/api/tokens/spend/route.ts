import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { TOKEN_COSTS, spendTokens } from "@/lib/ai/tokens";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await request.json();
  if (!TOKEN_COSTS[action]) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const gate = await spendTokens(user.id, action);
  if (!gate.ok) {
    return NextResponse.json(
      { error: "insufficient_tokens", remaining: gate.remaining, required: gate.required },
      { status: 402 }
    );
  }

  return NextResponse.json({
    success: true,
    spent: gate.required,
    tokens_remaining: gate.remaining,
  });
}
