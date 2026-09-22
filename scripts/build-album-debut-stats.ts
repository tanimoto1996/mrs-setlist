/**
 * 「フルアルバムが出た直後のワンマンツアーで、新アルバム曲はセトリの何割を占めたか」を
 * data/setlists-history.json（setlist.fm 全期間）から集計し、lib/album-debut-stats.json に書き出す。
 *
 *   npm run build:album-stats -- [--in data/setlists-history.json] [--out lib/album-debut-stats.json]
 *
 * - 対象アルバムと発売日は lib/albums.ts（FULL_ALBUMS）。曲とアルバムの対応は lib/songs.ts
 * - 「次のツアー」= 発売日から TOUR_WINDOW_DAYS 日以内の、演奏曲（Tape 除く）が ONE_MAN_MIN_SONGS 曲以上の公演。
 *   フェス・TV 出演（数曲）は含めない
 * - 収録曲は 2 種類に分ける:
 *     pre-released … 発売日より前にライブで演奏済み、または発売年より前の曲（先行シングル）
 *     album-only   … アルバムで初めて世に出た曲
 * - 曲名の突合は lib/song-title.ts の buildTitleIndex()。突合できなかった曲名は報告だけする
 * - 発売日が集計データの最終日より後のアルバム（POPS）は status="upcoming" にして、先行曲の内訳だけ出す
 */
import { readFileSync, writeFileSync } from "node:fs";
import { FULL_ALBUMS } from "../lib/albums.ts";
import type { AlbumDebutStats, AlbumDebutStatsFile, AlbumShowStats, AlbumTourStats } from "../lib/album-stats.ts";
import { buildTitleIndex, normalizeSongTitle } from "../lib/song-title.ts";
import { SONGS, type Song } from "../lib/songs.ts";
import type { NormalizedSetlist, SetlistsFile } from "./setlistfm.ts";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const inPath = opt("in") ?? "data/setlists-history.json";
const outPath = opt("out") ?? "lib/album-debut-stats.json";

/** これ未満の曲数の公演はフェス・TV とみなして「ツアー」に数えない */
const ONE_MAN_MIN_SONGS = 15;
/** 発売日からこの日数以内の公演を「発売直後のツアー」とする */
const TOUR_WINDOW_DAYS = 120;

let file: SetlistsFile;
try {
  file = JSON.parse(readFileSync(inPath, "utf8")) as SetlistsFile;
} catch {
  console.error(`${inPath} が読めない。先に \`npm run fetch:setlists:history\` を実行して`);
  process.exit(1);
}

const byKey = buildTitleIndex(SONGS, (m) => console.warn(`警告: ${m}`));
const resolve = (title: string): Song | undefined => byKey.get(normalizeSongTitle(title));
const round = (x: number) => Math.round(x * 1000) / 1000;
const addDays = (iso: string, days: number) => new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

const shows = [...file.setlists].sort((a, b) => a.date.localeCompare(b.date));
const lastDataDate = shows.at(-1)?.date ?? file.since;
const unmatched = new Map<string, number>();

/** 1 公演ぶんの新アルバム曲の数え上げ */
function countShow(show: NormalizedSetlist, trackIds: Set<string>, preReleased: Set<string>): AlbumShowStats {
  const played = show.songs.filter((s) => !s.isTape);
  const newAlbumSongIds: string[] = [];
  for (const entry of played) {
    const song = resolve(entry.title);
    if (!song) {
      unmatched.set(entry.title, (unmatched.get(entry.title) ?? 0) + 1);
      continue;
    }
    if (trackIds.has(song.id)) newAlbumSongIds.push(song.id);
  }
  return {
    date: show.date,
    venue: show.venue,
    tour: show.tour,
    url: show.url,
    songs: played.length,
    newAlbumSongs: newAlbumSongIds.length,
    newAlbumShare: round(newAlbumSongIds.length / played.length),
    preReleasedPlayed: newAlbumSongIds.filter((id) => preReleased.has(id)).length,
    albumOnlyPlayed: newAlbumSongIds.filter((id) => !preReleased.has(id)).length,
    newAlbumSongIds,
  };
}

const albums: AlbumDebutStats[] = FULL_ALBUMS.map(({ album, released }) => {
  const tracks = SONGS.filter((s) => s.album === album);
  const trackIds = new Set(tracks.map((s) => s.id));
  const releaseYear = Number(released.slice(0, 4));

  // 先行シングル: 発売日より前に演奏実績がある、または発売年より前の曲
  const playedBefore = new Set<string>();
  for (const show of shows) {
    if (show.date >= released) break;
    for (const entry of show.songs) {
      if (entry.isTape) continue;
      const song = resolve(entry.title);
      if (song && trackIds.has(song.id)) playedBefore.add(song.id);
    }
  }
  const preReleased = tracks.filter((s) => s.year < releaseYear || playedBefore.has(s.id)).map((s) => s.id);
  const albumOnly = tracks.filter((s) => !preReleased.includes(s.id)).map((s) => s.id);
  const preSet = new Set(preReleased);

  const base = { album, released, trackCount: tracks.length, preReleased, albumOnly };

  if (released > lastDataDate) {
    return { ...base, status: "upcoming", firstShow: null, tour: null };
  }

  const windowEnd = addDays(released, TOUR_WINDOW_DAYS);
  const tourShows = shows.filter(
    (s) => s.date >= released && s.date <= windowEnd && s.songs.filter((x) => !x.isTape).length >= ONE_MAN_MIN_SONGS,
  );
  if (tourShows.length === 0) {
    return { ...base, status: "no-data", firstShow: null, tour: null };
  }

  const perShow = tourShows.map((s) => countShow(s, trackIds, preSet));
  const playCount = new Map<string, number>();
  for (const s of perShow) for (const id of new Set(s.newAlbumSongIds)) playCount.set(id, (playCount.get(id) ?? 0) + 1);
  const trackPlayRate: Record<string, number> = {};
  for (const s of tracks) trackPlayRate[s.id] = round((playCount.get(s.id) ?? 0) / perShow.length);
  const distinct = [...playCount.keys()];
  const avg = (f: (s: AlbumShowStats) => number) => round(perShow.reduce((n, s) => n + f(s), 0) / perShow.length);

  const tour: AlbumTourStats = {
    shows: perShow.length,
    from: perShow[0].date,
    to: perShow.at(-1)!.date,
    tourName: tourShows.find((s) => s.tour)?.tour ?? null,
    avgSongs: avg((s) => s.songs),
    avgNewAlbumSongs: avg((s) => s.newAlbumSongs),
    avgNewAlbumShare: avg((s) => s.newAlbumShare),
    tracksPlayed: distinct.length,
    preReleasedPlayed: distinct.filter((id) => preSet.has(id)).length,
    albumOnlyPlayed: distinct.filter((id) => !preSet.has(id)).length,
    trackPlayRate,
  };
  return { ...base, status: "measured", firstShow: perShow[0], tour };
});

const measured = albums.filter((a) => a.status === "measured");
const mean = (xs: number[]) => (xs.length ? round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

const out: AlbumDebutStatsFile = {
  generatedAt: new Date().toISOString(),
  source: "setlist.fm",
  dataRange: { since: file.since, until: lastDataDate },
  rule: { oneManMinSongs: ONE_MAN_MIN_SONGS, tourWindowDays: TOUR_WINDOW_DAYS },
  summary: {
    measuredAlbums: measured.map((a) => a.album),
    noDataAlbums: albums.filter((a) => a.status === "no-data").map((a) => a.album),
    firstShowShare: mean(measured.map((a) => a.firstShow!.newAlbumShare)),
    tourShare: mean(measured.map((a) => a.tour!.avgNewAlbumShare)),
    preReleasedFirstShowRate: mean(
      measured.filter((a) => a.preReleased.length > 0).map((a) => a.firstShow!.preReleasedPlayed / a.preReleased.length),
    ),
    albumOnlyFirstShowRate: mean(
      measured.filter((a) => a.albumOnly.length > 0).map((a) => a.firstShow!.albumOnlyPlayed / a.albumOnly.length),
    ),
    albumOnlyTourRate: mean(
      measured.filter((a) => a.albumOnly.length > 0).map((a) => a.tour!.albumOnlyPlayed / a.albumOnly.length),
    ),
  },
  albums,
};
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

// ---- 報告 ----
const titleOf = (id: string) => SONGS.find((s) => s.id === id)?.title ?? id;
const pct = (x: number) => `${Math.round(x * 100)}%`;
console.log(`データ範囲: ${file.since} 〜 ${lastDataDate}（${shows.length} 公演）`);
console.log(`ルール: 発売日から ${TOUR_WINDOW_DAYS} 日以内・${ONE_MAN_MIN_SONGS} 曲以上の公演を「発売直後のツアー」とする\n`);
for (const a of albums) {
  console.log(`■ ${a.album}（${a.released}）収録 ${a.trackCount} 曲 = 先行 ${a.preReleased.length} + アルバム曲 ${a.albumOnly.length}`);
  if (a.status === "no-data") console.log("   setlist.fm にこの期間のワンマン公演データが無い");
  if (a.status === "upcoming") console.log(`   未開催。先行曲: ${a.preReleased.map(titleOf).join(" / ")}`);
  if (a.status === "measured" && a.firstShow && a.tour) {
    const f = a.firstShow;
    console.log(
      `   初日 ${f.date} ${f.venue}: ${f.newAlbumSongs} / ${f.songs} 曲 = ${pct(f.newAlbumShare)}` +
        `（先行 ${f.preReleasedPlayed} / ${a.preReleased.length}、アルバム曲 ${f.albumOnlyPlayed} / ${a.albumOnly.length}）`,
    );
    console.log(`   演奏: ${f.newAlbumSongIds.map(titleOf).join(" / ")}`);
    console.log(
      `   ツアー ${a.tour.shows} 公演（${a.tour.from}〜${a.tour.to}）: 平均 ${a.tour.avgNewAlbumSongs} / ${a.tour.avgSongs} 曲 = ${pct(a.tour.avgNewAlbumShare)}` +
        `、収録曲のうち 1 回でも演奏 ${a.tour.tracksPlayed} / ${a.trackCount}`,
    );
  }
}
console.log(
  `\nまとめ: 初日の新アルバム曲比率 ${out.summary.firstShowShare === null ? "-" : pct(out.summary.firstShowShare)}` +
    ` / ツアー平均 ${out.summary.tourShare === null ? "-" : pct(out.summary.tourShare)}` +
    `（計測できたアルバム: ${out.summary.measuredAlbums.join(", ") || "なし"}）`,
);
console.log(`saved: ${outPath}`);

console.log("\n--- ツアー期間内で突合できなかった曲名（setlist.fm 側の表記 × 回数） ---");
if (unmatched.size === 0) console.log("(なし)");
for (const [title, n] of [...unmatched.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))) {
  console.log(`${String(n).padStart(4)}  ${title}`);
}
