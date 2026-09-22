import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { EventContext } from "./event";
import {
  buildState,
  PLAY_LEVELS,
  SLOT_OPTIONS,
  toSetlist,
  type PredictionResult,
  type Slot,
  type SongPrediction,
} from "./jev";
import type { SongWithStats } from "./songs";

/**
 * Gemini に、Jev と同じ前提（buildState）・同じ 4 段階 rubric・同じ slot 選択肢で全曲を判断させる。
 * Jev は判断モデルなので state しか材料に持たないが、Gemini は曲の知識も持っている。
 * ここでは「state を主な材料にし、自身の知識は補助的に使ってよい」と指示している（比較の趣旨は docs/worklog 参照）。
 *
 * キーは GEMINI_API_KEY 環境変数か、プロジェクトルートの gemini-api-key ファイル（gitignore 済み）。
 * 中身はここで fetch のヘッダーに載せるだけで、ログ・エラー・応答には出さない。
 */

/**
 * 既定のモデル候補。先頭から順に試し、混雑（503）や上限（429）で断られたら次へ。
 * GEMINI_MODEL 環境変数（カンマ区切り可）で差し替えられる。
 * リトライではなく「別モデルへの 1 回ずつの切り替え」なので、同じモデルを叩き直すことはない。
 */
export const DEFAULT_GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.6-flash", "gemini-3.5-flash"] as const;
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
/** Route Handler の maxDuration（60 秒）に当たる前に自分で切る（モデルを乗り換えても合計でこの範囲に収める） */
const TIMEOUT_MS = 50_000;
/** 全曲ぶんの JSON（1 曲 40 トークン前後 × 100 曲強）が収まる余裕 */
const MAX_OUTPUT_TOKENS = 16_384;
/** このステータスなら次のモデル候補に切り替える */
const FALLBACK_STATUSES = new Set([429, 503]);

export function getGeminiApiKey(): string | null {
  const fromEnv = process.env.GEMINI_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  try {
    const fromFile = readFileSync(path.join(process.cwd(), "gemini-api-key"), "utf8").trim();
    return fromFile || null;
  } catch {
    return null;
  }
}

/** 試すモデルの一覧（順番どおり）。GEMINI_MODEL="a,b,c" で指定、未設定なら既定候補 */
export function getGeminiModels(): string[] {
  const fromEnv = (process.env.GEMINI_MODEL ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : [...DEFAULT_GEMINI_MODELS];
}

const SLOT_KEYS = Object.keys(SLOT_OPTIONS) as Slot[];

/** 応答の 1 行。responseJsonSchema でこの形を強制する */
interface GeminiRow {
  songId: string;
  play: number;
  confidence: number;
  slot: Slot;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    songs: {
      type: "array",
      description: "state.songs の全曲。1 曲 1 要素、抜け・重複なし",
      items: {
        type: "object",
        properties: {
          songId: { type: "string", description: "state.songs[].id をそのまま" },
          play: {
            type: "integer",
            minimum: 0,
            maximum: PLAY_LEVELS.length - 1,
            description: `演奏される見込み。${PLAY_LEVELS.map((l, i) => `${i}=${l}`).join(" / ")}`,
          },
          confidence: { type: "number", minimum: 0, maximum: 1, description: "play の判断の確信度" },
          slot: { type: "string", enum: SLOT_KEYS, description: "演奏されるならどの位置か" },
        },
        required: ["songId", "play", "confidence", "slot"],
      },
    },
  },
  required: ["songs"],
} as const;

const SYSTEM_INSTRUCTION = [
  "あなたは Mrs. GREEN APPLE のライブのセットリストを予想するアナリストです。",
  "与えられた state（公演の前提・候補曲のメタデータ・過去の演奏実績・guidance）を主な判断材料にしてください。",
  "自身が持つバンドや曲の知識は補助的に使ってよいですが、state と矛盾する場合は state を優先します。",
  "出力は指定された JSON スキーマのみ。説明文は書かないでください。",
].join("\n");

function buildPrompt(state: ReturnType<typeof buildState>) {
  const levels = PLAY_LEVELS.map((l, i) => `${i} = ${l}`).join(" / ");
  const slots = Object.entries(SLOT_OPTIONS)
    .map(([k, v]) => `${k} = ${v}`)
    .join(" / ");
  return [
    "state.songs の全曲について、この公演（state.event）のセットリストに入る見込みと、演奏されるならどの位置かを判断してください。",
    `play: ${levels} の 4 段階の整数。`,
    `slot: ${slots} のいずれかのキー。`,
    "confidence: その判断の確信度（0〜1）。",
    `expectedSetlistSize（${state.event.expectedSetlistSize} 曲）を目安に、play=3 を付ける曲を絞り込んでください。全曲に高い値を付けないこと。`,
    "play と slot は矛盾させないこと: slot=skip の曲は play を 0 か 1 にし、play=3 の曲には opener / middle / encore のいずれかを付ける。",
    "1 曲も抜かさず、songId は state.songs[].id をそのまま返してください。",
    "",
    "state:",
    JSON.stringify(state),
  ].join("\n");
}

interface GenerateContentResponse {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  modelVersion?: string;
}

/** Google のエラー本文から message だけ拾う（キーは含まれない）。長すぎるものは切る */
async function errorDetail(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return (body.error?.message ?? "").slice(0, 300);
  } catch {
    return "";
  }
}

function callGemini(model: string, apiKey: string, prompt: string, signal: AbortSignal): Promise<Response> {
  return fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_SCHEMA,
      },
    }),
    signal,
  });
}

export async function predictSetlistWithGemini(event: EventContext, songs: SongWithStats[]): Promise<PredictionResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY が未設定");

  const prompt = buildPrompt(buildState(event, songs));
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  // 混雑・上限で断られたら次のモデルへ。それ以外のエラーはそのまま返す
  const declined: string[] = [];
  let res: Response | null = null;
  let model = "";
  for (const candidate of getGeminiModels()) {
    const r = await callGemini(candidate, apiKey, prompt, signal);
    if (FALLBACK_STATUSES.has(r.status)) {
      declined.push(`${candidate}=${r.status}`);
      await r.body?.cancel();
      continue;
    }
    res = r;
    model = candidate;
    break;
  }
  if (!res) {
    throw new Error(
      `Gemini API: 候補モデルが全部 混雑（503）か上限（429）で断った（${declined.join(", ")}）。` +
        " しばらく待つか、GEMINI_MODEL にカンマ区切りで別モデルを足す",
    );
  }

  if (!res.ok) {
    const detail = await errorDetail(res);
    throw new Error(`Gemini API ${res.status}（${model}）${detail ? `: ${detail}` : ""}`);
  }

  const data = (await res.json()) as GenerateContentResponse;
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

  let rows: GeminiRow[];
  try {
    const parsed = JSON.parse(text) as { songs?: unknown };
    if (!Array.isArray(parsed.songs)) throw new Error("songs が配列でない");
    rows = parsed.songs as GeminiRow[];
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    throw new Error(`Gemini の応答が JSON として読めない（finishReason=${candidate?.finishReason ?? "?"}）: ${why}`);
  }

  const known = new Set(songs.map((s) => s.id));
  const seen = new Set<string>();
  const maxLevel = PLAY_LEVELS.length - 1;
  const predictions: SongPrediction[] = [];

  for (const row of rows) {
    if (typeof row?.songId !== "string" || !known.has(row.songId) || seen.has(row.songId)) continue;
    seen.add(row.songId);
    const level = Math.max(0, Math.min(maxLevel, Math.round(Number(row.play) || 0)));
    const slot: Slot = SLOT_KEYS.includes(row.slot) ? row.slot : "middle";
    const confidence = Math.max(0, Math.min(1, Number(row.confidence) || 0));
    // Gemini は slot の分布を返さないので、選んだ slot に confidence を寄せた形で埋める
    const rest = (1 - confidence) / (SLOT_KEYS.length - 1);
    const slotProbabilities = Object.fromEntries(SLOT_KEYS.map((k) => [k, k === slot ? confidence : rest])) as Record<Slot, number>;
    predictions.push({ songId: row.songId, likelihood: level / maxLevel, confidence, slot, slotProbabilities });
  }

  if (predictions.length === 0) throw new Error("Gemini の応答に既知の曲が 1 曲も無い");

  predictions.sort((a, b) => b.likelihood - a.likelihood);

  const usage = data.usageMetadata ?? {};
  return {
    model: data.modelVersion ?? model,
    predictions,
    setlist: toSetlist(predictions, event.setlistSize),
    usage: {
      input_tokens: usage.promptTokenCount ?? 0,
      output_tokens: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
    },
  };
}
