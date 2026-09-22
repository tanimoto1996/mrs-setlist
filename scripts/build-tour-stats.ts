/**
 * 「連続するワンマンツアーの間で、曲はどれだけ持ち越されるか（重複するか）」を
 * data/setlists-history.json（setlist.fm 全期間）から集計し、lib/tour-stats.json に書き出す。
 *
 *   npm run build:tour-stats -- [--in data/setlists-history.json] [--out lib/tour-stats.json]
 *
 * - 「ワンマン公演」= 演奏曲（Tape 除く）が ONE_MAN_MIN_SONGS 曲以上の公演。フェス・TV 出演は含めない
 * - 公演を「ツアー」にまとめる順序: lib/tours.ts の KNOWN_TOURS（日付範囲）→ setlist.fm の tour 名 → 前の公演から GAP_DAYS 日以上空いたら別ツアー
 * - 連続する 2 ツアーごとに、持ち越し（次にも残った）/ 外れた / 新顔（うち復活・初登場）を数える。
 *   曲は「ツアー中に 1 回でも演奏したか」で見る（公演ごとの入れ替えはここでは見ない）
 * - 曲ごとに直近 RECENT_TOURS 本での出場状況（演奏の有無・連続回数・何ツアー空いているか）を出す
 * - 曲名の突合は lib/song-title.ts（メドレー表記は 1 曲ずつ）。突合できなかった曲名は報告だけする
 */
import { readFileSync, writeFileSync } from "node:fs";
import { buildTitleIndex, resolveSetlistTitle } from "../lib/song-title.ts";
import { SONGS, type Song } from "../lib/songs.ts";
import type { SongRecentTours, StreakBucket, TourPairStat, TourStat, TourStatsFile } from "../lib/tour-stats.ts";
import { knownTourOn } from "../lib/tours.ts";
import type { NormalizedSetlist, SetlistsFile } from "./setlistfm.ts";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const inPath = opt("in") ?? "data/setlists-history.json";
const outPath = opt("out") ?? "lib/tour-stats.json";

/** これ未満の曲数の公演はフェス・TV とみなす */
const ONE_MAN_MIN_SONGS = 15;
/** ツアー名が無い公演同士は、これ以上日付が空いたら別ツアー */
const GAP_DAYS = 45;
/** 曲ごとの出場状況と「全部で演奏された曲」を見る直近ツアーの本数 */
const RECENT_TOURS = 5;

let file: SetlistsFile;
try {
  file = JSON.parse(readFileSync(inPath, "utf8")) as SetlistsFile;
} catch {
  console.error(`${inPath} が読めない。先に \`npm run fetch:setlists:history\` を実行して`);
  process.exit(1);
}

const byKey = buildTitleIndex(SONGS, (m) => console.warn(`警告: ${m}`));
const round = (x: number) => Math.round(x * 1000) / 1000;
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
const unmatched = new Map<string, number>();

// ---- 公演をツアーにまとめる ----
interface TourAcc {
  key: string;
  name: string;
  shortName: string;
  nameSource: TourStat["nameSource"];
  groupKey: string | null;
  fanClubOnly: boolean;
  shows: NormalizedSetlist[];
  played: Map<string, number>;
}
const shows = [...file.setlists]
  .filter((s) => s.songs.filter((x) => !x.isTape).length >= ONE_MAN_MIN_SONGS)
  .sort((a, b) => a.date.localeCompare(b.date));
const tours: TourAcc[] = [];
for (const show of shows) {
  const known = knownTourOn(show.date);
  const groupKey = known?.name ?? show.tour ?? null;
  const last = tours.at(-1);
  const gap = last ? daysBetween(last.shows.at(-1)!.date, show.date) : Infinity;
  const startNew = !last || groupKey !== last.groupKey || (groupKey === null && gap > GAP_DAYS);
  if (startNew) {
    tours.push({
      key: show.date,
      name: known?.name ?? show.tour ?? `${show.date} ${show.venue}`,
      shortName: known?.shortName ?? show.tour ?? `${show.date.slice(0, 7)} ${show.venue}`,
      nameSource: known ? "known" : show.tour ? "setlist.fm" : "venue",
      groupKey,
      fanClubOnly: known?.fanClubOnly ?? false,
      shows: [],
      played: new Map(),
    });
  }
  const t = tours.at(-1)!;
  t.shows.push(show);
  const inThisShow = new Set<Song>();
  for (const entry of show.songs) {
    if (entry.isTape) continue;
    const { songs, unmatched: miss } = resolveSetlistTitle(byKey, entry.title);
    for (const m of miss) unmatched.set(m, (unmatched.get(m) ?? 0) + 1);
    for (const s of songs) inThisShow.add(s);
  }
  for (const s of inThisShow) t.played.set(s.id, (t.played.get(s.id) ?? 0) + 1);
}

const tourStats: TourStat[] = tours.map((t) => ({
  key: t.key,
  name: t.name,
  shortName: t.shortName,
  nameSource: t.nameSource,
  from: t.shows[0].date,
  to: t.shows.at(-1)!.date,
  shows: t.shows.length,
  avgSongs: round(t.shows.reduce((n, s) => n + s.songs.filter((x) => !x.isTape).length, 0) / t.shows.length),
  distinctSongs: t.played.size,
  fanClubOnly: t.fanClubOnly,
  played: Object.fromEntries([...t.played.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
}));

// ---- 連続ツアー間の持ち越し ----
/** i 番目のツアー時点で、その曲が連続何ツアー目か */
const streakAt = (i: number, id: string): number => {
  let n = 0;
  for (let j = i; j >= 0 && id in tourStats[j].played; j--) n++;
  return n;
};
const bucketOf = (streak: number): StreakBucket => (streak >= 3 ? "3+" : streak === 2 ? "2" : "1");
const emptyBuckets = (): Record<StreakBucket, { songs: number; carried: number }> => ({
  "1": { songs: 0, carried: 0 },
  "2": { songs: 0, carried: 0 },
  "3+": { songs: 0, carried: 0 },
});

const pairs: TourPairStat[] = [];
for (let i = 1; i < tourStats.length; i++) {
  const prev = tourStats[i - 1];
  const next = tourStats[i];
  const prevIds = Object.keys(prev.played);
  const nextIds = Object.keys(next.played);
  const carriedIds = nextIds.filter((id) => id in prev.played);
  const droppedIds = prevIds.filter((id) => !(id in next.played));
  const freshIds = nextIds.filter((id) => !(id in prev.played));
  const earlier = new Set(tourStats.slice(0, i - 1).flatMap((t) => Object.keys(t.played)));
  const freshReturned = freshIds.filter((id) => earlier.has(id)).length;
  const carriedByStreak = emptyBuckets();
  for (const id of prevIds) {
    const b = carriedByStreak[bucketOf(streakAt(i - 1, id))];
    b.songs++;
    if (id in next.played) b.carried++;
  }
  pairs.push({
    prev: prev.key,
    next: next.key,
    prevName: prev.shortName,
    nextName: next.shortName,
    prevSongs: prevIds.length,
    nextSongs: nextIds.length,
    carried: carriedIds.length,
    carriedShare: round(carriedIds.length / nextIds.length),
    dropped: droppedIds.length,
    droppedShare: round(droppedIds.length / prevIds.length),
    fresh: freshIds.length,
    freshShare: round(freshIds.length / nextIds.length),
    freshReturned,
    freshFirstTime: freshIds.length - freshReturned,
    carriedByStreak,
    carriedIds,
    droppedIds,
    freshIds,
  });
}

// ---- 曲ごとの直近ツアー出場状況 ----
const recent = tourStats.slice(-RECENT_TOURS).reverse(); // 新しい順
const songs: Record<string, SongRecentTours> = {};
for (const song of SONGS) {
  const playedIn = recent.map((t) => song.id in t.played);
  let streak = 0;
  while (streak < playedIn.length && playedIn[streak]) streak++;
  const firstIdx = playedIn.indexOf(true);
  songs[song.id] = { playedIn, streak, toursSinceLastPlayed: firstIdx < 0 ? null : firstIdx };
}

// ---- まとめ ----
const mean = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};
const carriedShares = pairs.map((p) => p.carriedShare);
const totalFresh = pairs.reduce((n, p) => n + p.fresh, 0);
const rateByStreak = (b: StreakBucket) => {
  const songsN = pairs.reduce((n, p) => n + p.carriedByStreak[b].songs, 0);
  const carriedN = pairs.reduce((n, p) => n + p.carriedByStreak[b].carried, 0);
  return songsN ? round(carriedN / songsN) : null;
};

const out: TourStatsFile = {
  generatedAt: new Date().toISOString(),
  source: "setlist.fm",
  dataRange: { since: file.since, until: shows.at(-1)?.date ?? file.since },
  rule: { oneManMinSongs: ONE_MAN_MIN_SONGS, gapDays: GAP_DAYS, recentTours: RECENT_TOURS },
  tours: tourStats,
  pairs,
  summary: {
    pairs: pairs.length,
    carriedShare: carriedShares.length
      ? { mean: mean(carriedShares)!, median: median(carriedShares)!, min: Math.min(...carriedShares), max: Math.max(...carriedShares) }
      : null,
    droppedShareMean: mean(pairs.map((p) => p.droppedShare)),
    freshShareMean: mean(pairs.map((p) => p.freshShare)),
    freshReturnedShare: totalFresh ? round(pairs.reduce((n, p) => n + p.freshReturned, 0) / totalFresh) : null,
    carriedRateByStreak: { "1": rateByStreak("1"), "2": rateByStreak("2"), "3+": rateByStreak("3+") },
    recentTours: recent.map((t) => t.key),
    lastTour: tourStats.at(-1)?.key ?? null,
    playedInAllRecent: SONGS.filter((s) => recent.length > 0 && recent.every((t) => s.id in t.played)).map((s) => s.id),
    lastFanClubTour: [...tourStats].reverse().find((t) => t.fanClubOnly)?.key ?? null,
  },
  songs,
  unmatched: Object.fromEntries([...unmatched.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
};
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

// ---- 報告 ----
const titleOf = (id: string) => SONGS.find((s) => s.id === id)?.title ?? id;
const pct = (x: number | null) => (x === null ? "-" : `${Math.round(x * 100)}%`);
console.log(`データ範囲: ${out.dataRange.since} 〜 ${out.dataRange.until}（${ONE_MAN_MIN_SONGS} 曲以上のワンマン公演 ${shows.length} 件 → ${tourStats.length} ツアー）\n`);
for (const t of tourStats) {
  console.log(`■ ${t.from}〜${t.to} ${t.shows} 公演 平均 ${t.avgSongs} 曲・延べ ${t.distinctSongs} 曲  ${t.name}${t.fanClubOnly ? "（FC 限定）" : ""}`);
}
console.log("\n--- 連続ツアー間の持ち越し（次のツアーの曲のうち、前のツアーにもあった割合）---");
for (const p of pairs) {
  console.log(
    `${p.prevName} → ${p.nextName}: 持ち越し ${p.carried}/${p.nextSongs} = ${pct(p.carriedShare)}` +
      ` / 外れた ${p.dropped}/${p.prevSongs} = ${pct(p.droppedShare)} / 新顔 ${p.fresh}（復活 ${p.freshReturned}・初登場 ${p.freshFirstTime}）`,
  );
}
const s = out.summary;
console.log(
  `\nまとめ: 持ち越し 平均 ${pct(s.carriedShare?.mean ?? null)}（中央値 ${pct(s.carriedShare?.median ?? null)}、${pct(s.carriedShare?.min ?? null)}〜${pct(s.carriedShare?.max ?? null)}）` +
    ` / 外れる 平均 ${pct(s.droppedShareMean)} / 新顔のうち復活 ${pct(s.freshReturnedShare)}`,
);
console.log(`前ツアーでの連続回数別の持ち越し率: 1 回目 ${pct(s.carriedRateByStreak["1"])} / 2 回目 ${pct(s.carriedRateByStreak["2"])} / 3 回以上 ${pct(s.carriedRateByStreak["3+"])}`);
console.log(`直近 ${RECENT_TOURS} ツアー全部で演奏: ${s.playedInAllRecent.map(titleOf).join(" / ") || "(なし)"}`);
console.log(`saved: ${outPath}`);

console.log("\n--- 突合できなかった曲名（setlist.fm 側の表記 × 回数） ---");
if (unmatched.size === 0) console.log("(なし)");
for (const [title, n] of Object.entries(out.unmatched)) console.log(`${String(n).padStart(4)}  ${title}`);
