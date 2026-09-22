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
