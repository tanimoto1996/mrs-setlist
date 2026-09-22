import "server-only";
import { TypeSafeClient, choice, score } from "@typesafe-ai/sdk";
import { ALBUM_DEBUT_STATS, projectNewAlbumSongs } from "./album-stats";
import type { EventContext } from "./event";
import { SONGS, SONG_STATS, type Song, type SongWithStats } from "./songs";
import { TOUR_STATS, projectCarriedSongs, recentTours, tourOf } from "./tour-stats";

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

const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * 「新アルバム曲は何曲入るか」の過去実績と目安。lib/album-debut-stats.json（setlist.fm 全期間の集計）から作る。
 * Jev は知識を持たないので、「アルバム発売直後は新曲が多い」という感覚も数字で渡さないと予想が公演ごとにぶれる。
 * 実績が 1 枚も無ければ null（guidance は定性的な 1 行に戻る）。
 */
export function buildNewAlbumHistory(event: EventContext) {
  if (!event.newAlbum) return null;
  const projection = projectNewAlbumSongs(event.newAlbum, event.setlistSize);
  const { summary, rule } = ALBUM_DEBUT_STATS;
  return {
    rule: `発売日から ${rule.tourWindowDays} 日以内・${rule.oneManMinSongs} 曲以上の公演を「発売直後のツアー」として集計（フェス・TV は除外）`,
    measured: ALBUM_DEBUT_STATS.albums
      .filter((a) => a.status === "measured" && a.firstShow && a.tour)
      .map((a) => ({
        album: a.album,
        released: a.released,
        firstShow: {
          date: a.firstShow!.date,
          songs: a.firstShow!.songs,
          newAlbumSongs: a.firstShow!.newAlbumSongs,
          share: a.firstShow!.newAlbumShare,
          source: a.firstShow!.source,
          preReleasedPlayed: `${a.firstShow!.preReleasedPlayed}/${a.preReleased.length}`,
          albumOnlyPlayed: `${a.firstShow!.albumOnlyPlayed}/${a.albumOnly.length}`,
        },
        tour: {
          shows: a.tour!.shows,
          avgNewAlbumSongs: a.tour!.avgNewAlbumSongs,
          avgShare: a.tour!.avgNewAlbumShare,
          tracksPlayed: `${a.tour!.tracksPlayed}/${a.trackCount}`,
        },
      })),
    noData: summary.noDataAlbums,
    projection: {
      album: projection.album,
      setlistSize: event.setlistSize,
      meanFirstShowShare: projection.meanShare,
      latestFirstShowShare: projection.latestShare,
      latestMeasuredAlbum: projection.latestAlbum,
      expectedNewAlbumSongs: { low: projection.expectedLow, high: projection.expectedHigh },
      preReleasedFirstShowRate: summary.preReleasedFirstShowRate,
      albumOnlyFirstShowRate: summary.albumOnlyFirstShowRate,
      preReleased: projection.preReleased,
      albumOnly: projection.albumOnly,
    },
  };
}

/** 新アルバム曲の目安を guidance の文にする。実績が無いときは定性的な 1 行 */
function newAlbumGuidance(history: ReturnType<typeof buildNewAlbumHistory>): string[] {
  const p = history?.projection;
  const { low, high } = p?.expectedNewAlbumSongs ?? { low: null, high: null };
  if (!p || p.meanFirstShowShare === null || low === null || high === null) {
    return ["アルバム発売日のツアー初日なので、新アルバム収録曲は多めに演奏される傾向がある"];
  }
  const { meanFirstShowShare, latestFirstShowShare, latestMeasuredAlbum } = p;
  const range = low === high ? `${low} 曲` : `${low}〜${high} 曲`;
  const latest =
    latestFirstShowShare !== null && latestMeasuredAlbum
      ? `直近の ${latestMeasuredAlbum}（活動再開後・アリーナ）では ${pct(latestFirstShowShare)} まで下がっている。`
      : "";
  const lines = [
    `フルアルバム発売直後のツアー初日では、過去実績（newAlbumHistory）で新アルバム曲がセトリの平均 ${pct(meanFirstShowShare)} を占めた。${latest}` +
      `この公演（${p.setlistSize} 曲）では onNewAlbum=true の曲を ${range} 入れるのが基準で、` +
      "全国アリーナ・持ち曲が多い現在の状況は直近の比率に近いと考える。新アルバム曲を全部入れる・ほとんど外す、のどちらにも寄せない",
  ];
  if (p.preReleasedFirstShowRate !== null && p.albumOnlyFirstShowRate !== null) {
    lines.push(
      `新アルバム曲でも albumTrackType=pre-released（先行シングル、演奏実績あり）は ${pct(p.preReleasedFirstShowRate)}、` +
        `album-only（アルバム初出）は ${pct(p.albumOnlyFirstShowRate)} が初日に演奏された。先行シングルを優先し、album-only は半分程度に絞る`,
    );
  }
  return lines;
}

/**
 * 「前のツアーの曲は次のツアーにどれだけ残るか」の過去実績。lib/tour-stats.json（setlist.fm 全期間をツアー単位に集計）から作る。
 * 「前回やった曲がそのまま並ぶ」「前回やったからもうやらない」のどちらにも寄らないよう、持ち越し率・連続回数別の残り方・
 * 復活の割合を数字で渡す。songs[].recentTours（曲ごとの直近ツアーでの出場状況）の凡例もここに入れる。
 * ツアーが 2 本未満で比較できなければ null。
 */
export function buildTourHistory() {
  const recent = recentTours();
  const s = TOUR_STATS.summary;
  const carried = projectCarriedSongs();
  if (recent.length === 0 || !s.carriedShare || !carried) return null;
  const fc = tourOf(s.lastFanClubTour);
  const fcPair = fc ? TOUR_STATS.pairs.find((p) => p.next === fc.key) : undefined;
  const fcNonStaple = fc
    ? Object.keys(fc.played).filter((id) => !SONGS.find((x) => x.id === id)?.staple).length / Math.max(1, fc.distinctSongs)
    : null;
  return {
    rule: `演奏 ${TOUR_STATS.rule.oneManMinSongs} 曲以上の公演をワンマンとし、ツアー単位（曲はツアー中に 1 回でも演奏したか）で前後のツアーを比べた`,
    /** songs[].recentTours.playedIn[i] はこの配列の i 番目のツアーに対応する（新しい順） */
    recentTours: recent.map((t, i) => ({
      index: i,
      name: t.name,
      from: t.from,
      to: t.to,
      shows: t.shows,
      distinctSongs: t.distinctSongs,
      fanClubOnly: t.fanClubOnly,
    })),
    carryover: {
      pairs: TOUR_STATS.pairs.map((p) => ({
        from: p.prevName,
        to: p.nextName,
        carried: `${p.carried}/${p.nextSongs}`,
        carriedShare: p.carriedShare,
        freshReturned: p.freshReturned,
        freshFirstTime: p.freshFirstTime,
      })),
      carriedShare: s.carriedShare,
      droppedShareMean: s.droppedShareMean,
      freshReturnedShare: s.freshReturnedShare,
      carriedRateByStreak: s.carriedRateByStreak,
      lastTour: {
        name: carried.tour.name,
        distinctSongs: carried.tour.distinctSongs,
        expectedCarried: { low: carried.low, mean: carried.mean, high: carried.high },
      },
      playedInAllRecent: s.playedInAllRecent,
    },
    lastFanClubTour: fc
      ? {
          name: fc.name,
          shows: fc.shows,
          avgSongs: fc.avgSongs,
          carriedShareFromPrevious: fcPair?.carriedShare ?? null,
          nonStapleShare: fcNonStaple === null ? null : Math.round(fcNonStaple * 1000) / 1000,
        }
      : null,
  };
}

/** ツアー間の持ち越しの実績を guidance の文にする。実績が無ければ定性的な 1 行 */
function tourCarryoverGuidance(history: ReturnType<typeof buildTourHistory>): string[] {
  if (!history) return ["playCount が高く lastPlayed が新しい曲は次のツアーでも演奏されやすい"];
  const c = history.carryover;
  const titleOf = (id: string) => SONGS.find((x) => x.id === id)?.title ?? id;
  const e = c.lastTour.expectedCarried;
  const range = e.low === e.high ? `${e.mean} 曲前後` : `平均 ${e.mean} 曲前後（${e.low}〜${e.high} 曲）`;
  const lines = [
    `過去 ${c.pairs.length} 組の連続ツアー（tourHistory.carryover）では、次のツアーの曲のうち前のツアーにもあった曲は平均 ${pct(c.carriedShare.mean)}（${pct(c.carriedShare.min)}〜${pct(c.carriedShare.max)}）。` +
      `前回ツアー ${c.lastTour.name}（${c.lastTour.distinctSongs} 曲）の曲がそのまま並ぶとは考えず、残るのは ${range}。` +
      (c.freshReturnedShare !== null
        ? `空いた枝は 1〜2 ツアー空けた過去曲の復活（新顔の ${pct(c.freshReturnedShare)}）と新曲で埋まる`
        : "空いた枝は過去曲の復活と新曲で埋まる"),
  ];
  const r1 = c.carriedRateByStreak["1"];
  const r3 = c.carriedRateByStreak["3+"];
  if (r1 !== null && r3 !== null) {
    const core = c.playedInAllRecent.map(titleOf).join(" / ");
    lines.push(
      `ただし続けて演奏されている曲は残りやすい: 前のツアーで連続 3 ツアー以上だった曲は ${pct(r3)} が次も演奏され、連続 1 ツアーだけの曲は ${pct(r1)}。` +
        `songs[].recentTours の streak（直近から連続何ツアー）と toursSinceLastPlayed（何ツアー空いたか）を見る` +
        (core ? `。直近 ${history.recentTours.length} ツアー全部で演奏された ${core} は最有力` : ""),
    );
  }
  const fc = history.lastFanClubTour;
  if (fc && fc.carriedShareFromPrevious !== null && fc.nonStapleShare !== null) {
    lines.push(
      `前回の FC 限定ツアー ${fc.name}（${fc.shows} 公演・平均 ${Math.round(fc.avgSongs * 10) / 10} 曲）では、直前ツアーからの持ち越しは ${pct(fc.carriedShareFromPrevious)} にとどまり、` +
        `演奏曲の ${pct(fc.nonStapleShare)} は staple でない曲だった。FC ツアーでは定番の外の曲が入りやすい`,
    );
  }
  return lines;
}

/** Jev / Gemini に渡す「判断材料」。両エンジンで同じものを使う（比較の前提を揃えるため） */
export function buildState(event: EventContext, songs: SongWithStats[]) {
  const newAlbumHistory = buildNewAlbumHistory(event);
  const tourHistory = buildTourHistory();
  const preReleased = new Set(newAlbumHistory?.projection.preReleased ?? []);
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
    /** フルアルバム発売直後のツアーで新アルバム曲が占めた割合（過去実績）と、この公演の目安 */
    newAlbumHistory,
    /** 連続するツアーの間で曲がどれだけ持ち越されたか（過去実績）と、songs[].recentTours の凡例 */
    tourHistory,
    guidance: [
      ...newAlbumGuidance(newAlbumHistory),
      ...tourCarryoverGuidance(tourHistory),
      "staple=true の曲はライブ定番で、ツアーをまたいで演奏されやすい",
      "tieup がある曲は認知度が高く、アリーナ規模のライブで選ばれやすい",
      "era=phase1 かつ staple でない曲は普段の演奏頻度は低いが、FC ツアーでは掘り起こされることがある（tourHistory.lastFanClubTour を参照）",
      "ツアータイトル SHADOWS（影）と結びつく曲名・テーマは加点材料",
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
      // 新アルバム曲の内訳。pre-released = 先行シングル（演奏実績あり）/ album-only = アルバム初出。新アルバム曲以外は null
      albumTrackType: s.pops ? (preReleased.has(s.id) ? "pre-released" : "album-only") : null,
      // 過去ライブの演奏実績。stats が null の曲は実績データ未集計
      stats: s.stats,
      // 直近ツアーでの出場状況（tourHistory.recentTours の順）。null は実績データ未集計
      recentTours: TOUR_STATS.songs[s.id] ?? null,
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
