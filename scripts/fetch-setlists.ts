/**
 * setlist.fm API から Mrs. GREEN APPLE の直近セトリを取得し、data/setlists.json に正規化して保存する。
 *
 *   npm run fetch:setlists -- [--refresh] [--since 2024-09-01]
 *
 * - API キーは環境変数 SETLISTFM_API_KEY（.env.local に書けば npm script が読む）
 * - 1 リクエストごとに 1 秒以上あける（setlist.fm のレート制限）
 * - 生 JSON は data/raw/setlistfm/ にページ単位でキャッシュし、2 回目以降はキャッシュ優先。
 *   --refresh で全ページ再取得
 * - HTML スクレイピングはしない
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  normalizeSetlist,
  toIsoDate,
  type NormalizedSetlist,
  type SetlistFmSetlist,
  type SetlistFmSetlistsPage,
  type SetlistsFile,
} from "./setlistfm.ts";

/** MusicBrainz 上の Mrs. GREEN APPLE。setlist.fm も同じ MBID でアーティストを識別する */
const ARTIST_MBID = "9ce674b7-5180-41f7-9ac2-95dc0d8a0ed2";
const ARTIST_NAME = "Mrs. GREEN APPLE";
const BASE_URL = "https://api.setlist.fm/rest/1.0";
const MIN_INTERVAL_MS = 1100;
const MAX_ATTEMPTS = 3;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const refresh = flag("refresh");
const since = opt("since") ?? "2024-09-01";
const cacheDir = opt("cache-dir") ?? "data/raw/setlistfm";
const outPath = opt("out") ?? "data/setlists.json";

if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) {
  console.error(`--since は YYYY-MM-DD で指定して: ${since}`);
  process.exit(1);
}

mkdirSync(cacheDir, { recursive: true });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastRequestAt = 0;

/** レート制限を守って 1 ページ取得する。キーは環境変数からだけ読み、ログにも出さない */
async function fetchPage(page: number): Promise<SetlistFmSetlistsPage> {
  const apiKey = process.env.SETLISTFM_API_KEY;
  if (!apiKey) {
    console.error(
      "SETLISTFM_API_KEY が未設定。https://api.setlist.fm/docs/1.0/index.html でキーを発行して .env.local に入れて",
    );
    process.exit(1);
  }

  const url = `${BASE_URL}/artist/${ARTIST_MBID}/setlists?p=${page}`;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "x-api-key": apiKey,
        "User-Agent": "mrs-setlist/0.1 (setlist stats builder)",
      },
    });
    if (res.ok) return (await res.json()) as SetlistFmSetlistsPage;

    if (res.status === 403 || res.status === 401) {
      // setlist.fm はキー無しでも無効なキーでも同じ 403 {"message":"Forbidden"} を返す
      console.error(
        `setlist.fm が ${res.status} を返した。SETLISTFM_API_KEY が無効か、まだ有効化されていない可能性が高い。\n` +
          "https://www.setlist.fm/settings/api でキーを確認して .env.local に貼り直して（前後の空白や引用符なし）。",
      );
      process.exit(1);
    }
    if (res.status === 429 && attempt < MAX_ATTEMPTS) {
      const backoff = 5000 * attempt;
      console.warn(`  429 Too Many Requests。${backoff / 1000} 秒待って再試行 (${attempt}/${MAX_ATTEMPTS})`);
      await sleep(backoff);
      continue;
    }
    throw new Error(`setlist.fm が ${res.status} ${res.statusText} を返した (page=${page})`);
  }
  throw new Error(`setlist.fm への再試行が上限に達した (page=${page})`);
}

async function loadPage(page: number): Promise<{ data: SetlistFmSetlistsPage; fromCache: boolean }> {
  const file = join(cacheDir, `artist-${ARTIST_MBID}-p${String(page).padStart(3, "0")}.json`);
  if (!refresh && existsSync(file)) {
    return { data: JSON.parse(readFileSync(file, "utf8")) as SetlistFmSetlistsPage, fromCache: true };
  }
  const data = await fetchPage(page);
  writeFileSync(file, JSON.stringify(data, null, 2));
  return { data, fromCache: false };
}

// ---- main ----

const raw: SetlistFmSetlist[] = [];
let page = 1;
let cacheHits = 0;
let networkHits = 0;

// 新しい公演から順に返ってくるので、since より古い公演が出てきたページで止める
for (;;) {
  const { data, fromCache } = await loadPage(page);
  fromCache ? cacheHits++ : networkHits++;
  const items = data.setlist ?? [];
  raw.push(...items);
  console.log(
    `page ${page}/${Math.max(1, Math.ceil(data.total / data.itemsPerPage))}: ${items.length} 件` +
      (fromCache ? " (cache)" : ""),
  );

  const oldest = items.at(-1);
  if (items.length === 0 || (oldest && toIsoDate(oldest.eventDate) < since)) break;
  if (page * data.itemsPerPage >= data.total) break;
  page++;
}

const seen = new Set<string>();
const setlists: NormalizedSetlist[] = [];
for (const sl of raw) {
  if (seen.has(sl.id)) continue;
  seen.add(sl.id);
  const n = normalizeSetlist(sl);
  if (n.date >= since) setlists.push(n);
}
setlists.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));

const out: SetlistsFile = {
  source: "setlist.fm",
  artist: { mbid: ARTIST_MBID, name: ARTIST_NAME },
  since,
  fetchedAt: new Date().toISOString(),
  count: setlists.length,
  setlists,
};
writeFileSync(outPath, JSON.stringify(out, null, 2));

const withSongs = setlists.filter((s) => s.songs.some((x) => !x.isTape)).length;
console.log("");
console.log(`取得公演数: ${setlists.length} 件（${since} 以降、曲情報あり ${withSongs} 件）`);
console.log(`リクエスト: API ${networkHits} 回 / キャッシュ ${cacheHits} ページ`);
console.log(`saved: ${outPath}`);
