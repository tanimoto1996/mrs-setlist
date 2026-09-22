import { NextResponse } from "next/server";
import { SHADOWS_OPENING, type EventContext } from "@/lib/event";
import { predictSetlist } from "@/lib/jev";
import { SONGS } from "@/lib/songs";

export const runtime = "nodejs";
export const maxDuration = 60;

interface PredictBody {
  rumors?: string;
  setlistSize?: number;
}

export async function POST(req: Request) {
  if (!process.env.TYPESAFE_API_KEY) {
    return NextResponse.json(
      { error: "TYPESAFE_API_KEY が未設定。.env.local に入れて再起動して" },
      { status: 500 },
    );
  }

  let body: PredictBody = {};
  try {
    body = (await req.json()) as PredictBody;
  } catch {
    // 空ボディでも既定値で動く
  }

  const size = Number(body.setlistSize);
  const event: EventContext = {
    ...SHADOWS_OPENING,
    rumors: typeof body.rumors === "string" ? body.rumors.slice(0, 2000) : "",
    setlistSize: Number.isFinite(size) && size >= 10 && size <= 35 ? Math.round(size) : SHADOWS_OPENING.setlistSize,
  };

  try {
    const result = await predictSetlist(event, SONGS);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Jev の呼び出しに失敗";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
