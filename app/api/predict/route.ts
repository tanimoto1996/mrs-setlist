import { NextResponse } from "next/server";
import { SHADOWS_OPENING, type EventContext } from "@/lib/event";
import { getGeminiApiKey, predictSetlistWithGemini } from "@/lib/gemini";
import { predictSetlist, type Engine } from "@/lib/jev";
import { getSongsWithStats } from "@/lib/songs";

export const runtime = "nodejs";
export const maxDuration = 60;

interface PredictBody {
  rumors?: string;
  setlistSize?: number;
  /** 予想エンジン。省略時は jev */
  engine?: string;
}

const ENGINE_LABEL: Record<Engine, string> = { jev: "Jev", gemini: "Gemini" };

export async function POST(req: Request) {
  let body: PredictBody = {};
  try {
    body = (await req.json()) as PredictBody;
  } catch {
    // 空ボディでも既定値で動く
  }

  const engine: Engine | null =
    body.engine === undefined || body.engine === "jev" ? "jev" : body.engine === "gemini" ? "gemini" : null;
  if (!engine) {
    return NextResponse.json({ error: "engine は jev か gemini" }, { status: 400 });
  }

  if (engine === "jev" && !process.env.TYPESAFE_API_KEY) {
    return NextResponse.json(
      { error: "TYPESAFE_API_KEY が未設定。.env.local に入れて再起動して" },
      { status: 500 },
    );
  }
  if (engine === "gemini" && !getGeminiApiKey()) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY が未設定。.env.local に GEMINI_API_KEY を入れるか、プロジェクトルートの gemini-api-key ファイルにキーを書いて再起動して" },
      { status: 500 },
    );
  }

  const size = Number(body.setlistSize);
  const event: EventContext = {
    ...SHADOWS_OPENING,
    rumors: typeof body.rumors === "string" ? body.rumors.slice(0, 2000) : "",
    setlistSize: Number.isFinite(size) && size >= 10 && size <= 35 ? Math.round(size) : SHADOWS_OPENING.setlistSize,
  };

  try {
    // 曲マスタに setlist.fm 由来の演奏実績を付けて渡す。前提は両エンジン共通
    const songs = getSongsWithStats();
    const result = engine === "gemini" ? await predictSetlistWithGemini(event, songs) : await predictSetlist(event, songs);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : `${ENGINE_LABEL[engine]} の呼び出しに失敗`;
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
