import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { channel_id } = await request.json();
    if (!channel_id) {
      return NextResponse.json(
        { error: "channel_id required" },
        { status: 400 },
      );
    }

    const token = process.env.BOT_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "Bot token not configured" },
        { status: 500 },
      );
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: channel_id }),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Failed to check channel" },
      { status: 500 },
    );
  }
}
