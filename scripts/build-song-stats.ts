/**
 * data/setlists.json と lib/songs.ts の曲を突合し、曲ごとの演奏実績を lib/song-stats.json に書き出す。
 *
 *   npm run build:stats -- [--in data/setlists.json] [--out lib/song-stats.json]
 *
 * - 曲名は lib/song-title.ts の normalizeSongTitle() を両側に当ててから比較する
 * - SE / Tape（isTape=true）は集計対象外
 * - songs.ts に無い曲は「未マッチ一覧」として出すだけで、songs.ts には触らない
 * - avgPosition は「その公演の演奏曲（Tape 除く、アンコール含む）の中で何番目か」を 0〜1 に正規化した平均
 */
import { readFileSync, writeFileSync } from "node:fs";
import { normalizeSongTitle } from "../lib/song-title.ts";
import { SONGS, type Song, type SongStats, type SongStatsFile } from "../lib/songs.ts";
import type { SetlistsFile } from "./setlistfm.ts";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const inPath = opt("in") ?? "data/setlists.json";
const outPath = opt("out") ?? "lib/song-stats.json";
const UNKNOWN_TOUR = "(ツアー不明)";

let file: SetlistsFile;
try {
  file = JSON.parse(readFileSync(inPath, "utf8")) as SetlistsFile;
} catch {
  console.error(`${inPath} が読めない。先に \`npm run fetch:setlists\` を実行して`);
  process.exit(1);
}

// ---- songs.ts 側のインデックス ----
const byKey = new Map<string, Song>();
for (const song of SONGS) {
  const key = normalizeSongTitle(song.title);
  const dup = byKey.get(key);
  if (dup) console.warn(`警告: 正規化後の曲名が衝突 "${dup.title}" / "${song.title}" → ${key}`);
  byKey.set(key, song);
}

// ---- 集計 ----
interface Acc {
  playCount: number;
  byTour: Map<string, number>;
  lastPlayed: string | null;
  openerCount: number;
  encoreCount: number;
  positionSum: number;
}
const acc = new Map<string, Acc>();
const accOf = (id: string): Acc => {
  let a = acc.get(id);
  if (!a) {
    a = { playCount: 0, byTour: new Map(), lastPlayed: null, openerCount: 0, encoreCount: 0, positionSum: 0 };
    acc.set(id, a);
  }
  return a;
};
const unmatched = new Map<string, number>();

let totalShows = 0;
for (const show of file.setlists) {
  const played = show.songs.filter((s) => !s.isTape);
  if (played.length === 0) continue;
  totalShows++;
  const tour = show.tour ?? UNKNOWN_TOUR;

  played.forEach((entry, idx) => {
    const song = byKey.get(normalizeSongTitle(entry.title));
    if (!song) {
      unmatched.set(entry.title, (unmatched.get(entry.title) ?? 0) + 1);
      return;
    }
    const a = accOf(song.id);
    a.playCount++;
    a.byTour.set(tour, (a.byTour.get(tour) ?? 0) + 1);
    if (!a.lastPlayed || show.date > a.lastPlayed) a.lastPlayed = show.date;
    if (idx === 0) a.openerCount++;
    if (entry.encore !== null) a.encoreCount++;
    a.positionSum += played.length > 1 ? idx / (played.length - 1) : 0;
  });
}

const round = (x: number) => Math.round(x * 1000) / 1000;
const stats: Record<string, SongStats> = {};
for (const song of SONGS) {
  const a = acc.get(song.id);
  if (!a) {
    stats[song.id] = { playCount: 0, playCountByTour: {}, lastPlayed: null, openerRate: 0, encoreRate: 0, avgPosition: null };
    continue;
  }
  stats[song.id] = {
    playCount: a.playCount,
    playCountByTour: Object.fromEntries([...a.byTour.entries()].sort((x, y) => y[1] - x[1])),
    lastPlayed: a.lastPlayed,
    openerRate: round(a.openerCount / a.playCount),
    encoreRate: round(a.encoreCount / a.playCount),
    avgPosition: round(a.positionSum / a.playCount),
  };
}

const out: SongStatsFile = {
  generatedAt: new Date().toISOString(),
  since: file.since,
  totalShows,
  songs: stats,
};
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

// ---- 報告 ----
const matched = SONGS.filter((s) => (stats[s.id]?.playCount ?? 0) > 0).length;
console.log(`取得公演数: ${file.setlists.length} 件（曲情報あり ${totalShows} 件、${file.since} 以降）`);
console.log(`マッチした曲数: ${matched} / ${SONGS.length} 曲`);
console.log(`saved: ${outPath}`);

console.log("\n--- 未マッチ一覧（setlist.fm 側の表記 × 回数） ---");
if (unmatched.size === 0) console.log("(なし)");
for (const [title, n] of [...unmatched.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))) {
  console.log(`${String(n).padStart(4)}  ${title}`);
}

console.log("\n--- playCount 上位 10 曲 ---");
[...SONGS]
  .sort((a, b) => stats[b.id].playCount - stats[a.id].playCount || a.title.localeCompare(b.title))
  .slice(0, 10)
  .forEach((s, i) => {
    const st = stats[s.id];
    console.log(
      `${String(i + 1).padStart(2)}. ${s.title}  ${st.playCount} 回` +
        `  last=${st.lastPlayed ?? "-"}  opener=${st.openerRate.toFixed(2)}  encore=${st.encoreRate.toFixed(2)}` +
        `  pos=${st.avgPosition?.toFixed(2) ?? "-"}`,
    );
  });
