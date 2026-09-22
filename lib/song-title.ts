/**
 * 曲名の突合用正規化。setlist.fm の表記と lib/songs.ts の title の揺れを吸収する。
 *
 * - NFKC で全角/半角・互換文字を揃え、小文字化
 * - 括弧内（feat. 表記、読み仮名など）を落とす。「点描の唄 (feat. 井上苑子)」→「点描の唄」
 * - 括弧なしの feat. / ft. 以降を落とす
 * - 記号・空白を全部取り、文字（かな・漢字・英字）と数字だけ残す。「SPLASH!!!」→「splash」
 *
 * 両側（setlist.fm 側と songs.ts 側）に同じ関数を当ててから比較すること。
 */
export function normalizeSongTitle(raw: string): string {
  let t = raw.normalize("NFKC").toLowerCase();
  t = t.replace(/\([^)]*\)|\[[^\]]*\]|｢[^｣]*｣|「[^」]*」/g, " ");
  t = t.replace(/\s(?:feat|ft)\.?\s.*$/, "");
  t = t.replace(/[^\p{L}\p{N}]+/gu, "");
  return t;
}

/**
 * setlist.fm 側の別表記 → lib/songs.ts の id。
 * 古い登録はローマ字（"Que Sera Sera" / "Dance Hall" / "Ao to Natsu"）で書かれていて、
 * normalizeSongTitle() だけでは日本語タイトルと突合できない。ここに 1 行ずつ足す。
 * キーは setlist.fm の表記そのまま（照合時に normalizeSongTitle() を当てる）。
 * メドレー表記（"BFF / Variety"）はここに登録せず、resolveSetlistTitle() が " / " で分けて 1 曲ずつ突合する。
 */
export const SONG_TITLE_ALIASES: Record<string, string> = {
  "Que Sera Sera": "que-sera-sera",
  "Dance Hall": "dance-hall",
  Lilac: "lilac",
  "Ao to Natsu": "ao-to-natsu",
  Froliginal: "floriginal",
  "New My Normal": "new-my-normal",
  "Watashi wa Saikyou": "watashi-wa-saikyo",
  Inferno: "inferno",
  Shunshuu: "shunshu",
  Darling: "darling",
  Tengoku: "tengoku",
  Kusushiki: "kususiki",
  Public: "public",
  "Aijou to Hokosaki": "aijou-to-hokosaki",
  "Boku no Koto": "boku-no-koto",
  Gahoujin: "gaou-jin",
  Apollodorus: "apollodorus",
  "Ke‐Mo Sah‐Bee": "ke-mo-sabe",
  "Nani wo Nani wo": "nani-wo-nani-wo",
  "Kaze to Machi": "kaze-to-machi",
  // 藍。公式のローマ字表記も "Ao"（ユニバーサル ミュージックの TWELVE 商品ページ）
  Ao: "ai",
  "Uso Janai yo": "uso-janai-yo",
  "Hikari no Uta": "hikari-no-uta",
  Kudari: "kudari",
  Romanticism: "romanticism",
  "Avoid Note": "avoid-note",
  Aufheben: "aufheben",
  "Kujira no Uta": "kujira-no-uta",
  "Bitter Vacances": "bitter-vacances",
  Anzenpai: "anzenpai",
  "Shoki no Uta": "shoki-no-uta",
  "Tenbyou no Uta": "tenbyou-no-uta",
  Nachtmusik: "nachtmusik",
  "Samama Festival!": "samama-festival",
  "Risky Game": "risky-game",
  // 恋と吟（こいとうた）
  "Koi to Uta": "koi-to-gin",
  "Natsu no Kage": "natsu-no-kage",
  "Doutoku to Sara": "doutoku-to-sara",
  "Dokoka de Hi wa Noboru": "dokoka-de-hi-wa-noboru",
  "Blue Ambience": "blue-ambience",
  "Zessei Seibutsu": "zessei-seibutsu",
  "Omocha no Heitai": "omocha-no-heitai",
  Ubu: "ubu",
  Unloveless: "unloveless",
  Daidai: "daidai",
  "Kimi wo Shiranai": "kimi-wo-shiranai",
  Zenmai: "zenmai",
  Watashi: "watashi",
  "Hibi to Kimi": "hibi-to-kimi",
  Kikoridokei: "kikori-dokei",
  "Kikori Dokei": "kikori-dokei",
  Columbus: "columbus",
  "A Priori": "a-priori",
  Tsukimashiteha: "tsukimashiteha",
};

/**
 * 「正規化した曲名 → 曲」の索引。songs.ts の title と SONG_TITLE_ALIASES の両方を登録する。
 * setlist.fm 由来の曲名を曲マスタに突合するときは、必ずこれを通す（build-song-stats / build-album-debut-stats 共通）。
 * warn を渡すと、正規化後の衝突・エイリアスの指す id が無いといった不整合を報告する。
 */
export function buildTitleIndex<T extends { id: string; title: string }>(
  songs: readonly T[],
  warn: (message: string) => void = () => {},
): Map<string, T> {
  const byKey = new Map<string, T>();
  const byId = new Map(songs.map((s) => [s.id, s]));
  for (const song of songs) {
    const key = normalizeSongTitle(song.title);
    const dup = byKey.get(key);
    if (dup) warn(`正規化後の曲名が衝突 "${dup.title}" / "${song.title}" → ${key}`);
    byKey.set(key, song);
  }
  for (const [alias, id] of Object.entries(SONG_TITLE_ALIASES)) {
    const song = byId.get(id);
    if (!song) {
      warn(`SONG_TITLE_ALIASES の "${alias}" が指す id "${id}" が songs.ts に無い`);
      continue;
    }
    const key = normalizeSongTitle(alias);
    const dup = byKey.get(key);
    if (dup && dup.id !== id) warn(`エイリアス "${alias}" が "${dup.title}" と衝突 → ${key}`);
    byKey.set(key, song);
  }
  return byKey;
}

/**
 * setlist.fm の 1 エントリ（曲名）を曲マスタに突合する。
 * まず表記全体で探し、無ければメドレー表記（"BFF / Variety"）とみなして " / " で分けて 1 曲ずつ探す。
 * 突合できなかった表記は unmatched に入れて返す（呼び出し側が「未マッチ一覧」として報告する）。
 */
export function resolveSetlistTitle<T>(byKey: ReadonlyMap<string, T>, title: string): { songs: T[]; unmatched: string[] } {
  const whole = byKey.get(normalizeSongTitle(title));
  if (whole) return { songs: [whole], unmatched: [] };
  if (!title.includes(" / ")) return { songs: [], unmatched: [title] };
  const songs: T[] = [];
  const unmatched: string[] = [];
  for (const part of title.split(" / ")) {
    const song = byKey.get(normalizeSongTitle(part));
    if (song) songs.push(song);
    else unmatched.push(part);
  }
  return { songs, unmatched };
}
