import "server-only";
import { TypeSafeClient, choice, score } from "@typesafe-ai/sdk";
import type { EventContext } from "./event";
import { SONG_STATS, type Song, type SongWithStats } from "./songs";

/**
 * 演奏される見込み。Score の rubric は 0 から順に並ぶ。
 * Gemini（lib/gemini.ts）にも同じ段階を渡して、同じ物差しで比べられるようにしている。
 */
export const PLAY_LEVELS = [
  "まず演奏されない",
  "演奏される可能性は低い",
  "演奏されてもおかしくない",
  "ほぼ確実に演奏される",
] as const;

/** どの位置で演奏されそうか。skip を入れておくと「やらない」が逃げ場として使える。 */
export const SLOT_OPTIONS = {
  opener: "オープニング〜序盤（1〜4曲目あたり）",
  middle: "本編の中盤〜後半",
  encore: "アンコール",
  skip: "この公演では演奏されない",
} as const;

export type Slot = keyof typeof SLOT_OPTIONS;

/** 予想エンジン。API の engine パラメータ・画面の保存先（Saved のキー）と同じ文字列 */
export type Engine = "jev" | "gemini";
export const ENGINES: readonly Engine[] = ["jev", "gemini"];

export interface SongPrediction {
  songId: string;
  /** 0〜1 に正規化した演奏見込み */
  likelihood: number;
  /** Score の confidence */
  confidence: number;
  slot: Slot;
  slotProbabilities: Record<Slot, number>;
}

export interface PredictionResult {
  model: string;
  predictions: SongPrediction[];
  /** likelihood 上位 setlistSize 曲を slot 順に並べたもの */
  setlist: string[];
  usage: { input_tokens: number; output_tokens: number };
}

const BATCH_SIZE = 20;

function buildQuestions(songs: Song[]) {
  const q: Record<string, ReturnType<typeof score> | ReturnType<typeof choice>> = {};
  for (const s of songs) {
    q[`${s.id}__play`] = score(
      `state.songs の id="${s.id}"（${s.title}）が、この公演のセットリストに入る見込み`,
      PLAY_LEVELS,
    );
    q[`${s.id}__slot`] = choice(
      `state.songs の id="${s.id}"（${s.title}）が演奏されるなら、セットリストのどの位置か`,
      SLOT_OPTIONS,
    );
  }
  return q;
}

/** Jev / Gemini に渡す「判断材料」。両エンジンで同じものを使う（比較の前提を揃えるため） */
export function buildState(event: EventContext, songs: SongWithStats[]) {
  return {
    event: {
      tour: event.tour,
      date: event.date,
      venue: event.venue,
      facts: event.facts,
      rumors: event.rumors || "(特になし)",
      expectedSetlistSize: event.setlistSize,
    },
    /** songs[].stats の集計元。totalShows が割合・回数の分母の目安 */
    pastShows: {
      source: "setlist.fm",
      since: SONG_STATS.since,
      totalShows: SONG_STATS.totalShows,
    },
    guidance: [
      "アルバム発売日のツアー初日なので、新アルバム収録曲は多めに演奏される傾向がある",
      "staple=true の曲はライブ定番で、ツアーをまたいで演奏されやすい",
      "tieup がある曲は認知度が高く、アリーナ規模のライブで選ばれやすい",
      "era=phase1 かつ staple でない曲は、FC ツアーであっても演奏頻度は低い",
      "ツアータイトル SHADOWS（影）と結びつく曲名・テーマは加点材料",
      "playCount が高く lastPlayed が新しい曲は次のツアーでも演奏されやすい",
    ],
    songs: songs.map((s) => ({
      id: s.id,
      title: s.title,
      year: s.year,
      album: s.album,
      mood: s.mood,
      era: s.era,
      tieup: s.tieup ?? null,
      staple: s.staple ?? false,
      onNewAlbum: s.pops ?? false,
      // 過去ライブの演奏実績。stats が null の曲は実績データ未集計
      stats: s.stats,
    })),
  };
}

export const SLOT_ORDER: Record<Slot, number> = { opener: 0, middle: 1, encore: 2, skip: 3 };

/**
 * likelihood 上位 setlistSize 曲を slot 順（opener → middle → encore）に並べて予想セトリにする。
 * 上位に入ったのに slot=skip の曲は middle 扱い。Jev / Gemini 共通。
 */
export function toSetlist(predictions: SongPrediction[], setlistSize: number): string[] {
  return [...predictions]
    .sort((a, b) => b.likelihood - a.likelihood)
    .slice(0, setlistSize)
    .map((p) => ({ ...p, slot: p.slot === "skip" ? "middle" : p.slot }))
    .sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot] || b.likelihood - a.likelihood)
    .map((p) => p.songId);
}

export async function predictSetlist(event: EventContext, songs: SongWithStats[]): Promise<PredictionResult> {
  const client = new TypeSafeClient();

  const batches: SongWithStats[][] = [];
  for (let i = 0; i < songs.length; i += BATCH_SIZE) batches.push(songs.slice(i, i + BATCH_SIZE));

  // fan-out: バッチを並列で投げる
  const results = await Promise.all(
    batches.map((batch) => client.systemOne({ state: buildState(event, batch), questions: buildQuestions(batch) })),
  );

  const predictions: SongPrediction[] = [];
  const usage = { input_tokens: 0, output_tokens: 0 };
  let model = "";

  for (const [i, res] of results.entries()) {
    model = res.model;
    usage.input_tokens += res.usage.input_tokens;
    usage.output_tokens += res.usage.output_tokens;

    for (const s of batches[i]) {
      const play = res.answers[`${s.id}__play`];
      const slot = res.answers[`${s.id}__slot`];
      if (play?.type !== "score" || slot?.type !== "choice") continue;

      const maxLevel = PLAY_LEVELS.length - 1;
      predictions.push({
        songId: s.id,
        likelihood: Math.max(0, Math.min(1, play.score / maxLevel)),
        confidence: play.confidence,
        slot: slot.choice as Slot,
        slotProbabilities: slot.probabilities as Record<Slot, number>,
      });
    }
  }

  predictions.sort((a, b) => b.likelihood - a.likelihood);

  return { model, predictions, setlist: toSetlist(predictions, event.setlistSize), usage };
}
