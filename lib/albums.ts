/**
 * オリジナルフルアルバムの発売日と収録曲。
 * scripts/build-album-debut-stats.ts が「発売後最初のワンマンツアーで新アルバム曲がどれだけ演奏されたか」を
 * 集計するときの基準。tracks は lib/songs.ts の id で、別アルバム曲の再収録（Album Version など）も含む正式な収録曲。
 * songs.ts の album（最初に収録されたアルバム）とは一致しないことがあるので、集計は必ずこちらを見る。
 *
 * 収録曲の出典（2026-09-23 に照合）:
 * - TWELVE: ユニバーサル ミュージック商品ページ https://www.universal-music.co.jp/mrsgreenapple/products/upch-20411/
 * - Mrs. GREEN APPLE / ENSEMBLE / Attitude / ANTENNA: 日本語版 Wikipedia の各アルバム記事
 * - POPS: 発売前なので公式発表ベース。lib/songs.ts の pops フラグと同じ集合（build-album-debut-stats がずれを警告する）
 * ミニアルバム（Progressive / Variety / Unity）は「フルアルバム発売後の次のライブ」の分析対象ではないので入れない。
 */
export interface FullAlbum {
  /** lib/songs.ts の album と同じ文字列 */
  album: string;
  /** 発売日 (YYYY-MM-DD)。配信先行があってもフィジカルの発売日 */
  released: string;
  /** 収録曲の id（曲順）。songs.ts に無い id があると build-album-debut-stats が止まる */
  tracks: readonly string[];
}

export const FULL_ALBUMS: readonly FullAlbum[] = [
  {
    album: "TWELVE",
    released: "2016-01-13",
    tracks: [
      "aijou-to-hokosaki", "speaking", "public", "ai", "kikori-dokei", "watashi", "no7", "misukasazu", "simple",
      "interlude-shiroi-asa", "hug", "hello", "shoki-no-uta",
    ],
  },
  {
    album: "Mrs. GREEN APPLE",
    released: "2017-01-11",
    tracks: [
      "lion", "in-the-morning", "omocha-no-heitai", "zessei-seibutsu", "soft-drink", "kujira-no-uta", "ubu",
      "samama-festival", "oz", "just-a-friend", "factory", "umbrella", "journey",
    ],
  },
  {
    album: "ENSEMBLE",
    released: "2018-04-18",
    tracks: [
      "love-me-love-you", "party", "wanted-wanted", "aufheben", "hajimari", "they-are", "whoo-whoo-whoo",
      "smile-of-dreamer", "splash", "reverse", "coffee", "on-my-mind", "dokoka-de-hi-wa-noboru",
    ],
  },
  {
    album: "Attitude",
    released: "2019-10-02",
    tracks: [
      "inspiration", "attitude", "inferno", "cheers", "viking", "propose", "boku-no-koto", "ao-to-natsu", "kudari",
      "lovin", "ke-mo-sabe", "romanticism", "uso-janai-yo", "how-to", "soup", "circle", "folktale",
    ],
  },
  {
    album: "ANTENNA",
    released: "2023-07-05",
    tracks: [
      "antenna", "magic", "watashi-wa-saikyo", "blizzard", "que-sera-sera", "soranji", "unloveless", "loneliness",
      "norn", "daidai", "doodle", "bff", "feeling",
    ],
  },
  {
    album: "POPS",
    released: "2026-09-30",
    tracks: [
      "brand-new", "kyohan", "cinderella", "hon-to-suisei", "a-posteriori", "good-day", "episode", "lulu", "kaze-to-machi",
      "really-really", "project4", "mayakashi", "kinjita-asobi", "carrying-happiness", "natsu-no-kage", "variety",
    ],
  },
];
