/**
 * オリジナルフルアルバムの発売日。
 * scripts/build-album-debut-stats.ts が「発売後最初のワンマンツアーで新アルバム曲がどれだけ演奏されたか」を
 * 集計するときの基準で、album は lib/songs.ts の album（ALBUM_ORDER）と完全一致させる。
 * ミニアルバム（Progressive / Variety / Unity）は「フルアルバム発売後の次のライブ」の分析対象ではないので入れない。
 */
export interface FullAlbum {
  /** lib/songs.ts の album と同じ文字列 */
  album: string;
  /** 発売日 (YYYY-MM-DD)。配信先行があってもフィジカルの発売日 */
  released: string;
}

export const FULL_ALBUMS: readonly FullAlbum[] = [
  { album: "TWELVE", released: "2016-01-13" },
  { album: "Mrs. GREEN APPLE", released: "2017-01-11" },
  { album: "ENSEMBLE", released: "2018-04-18" },
  { album: "Attitude", released: "2019-10-02" },
  { album: "ANTENNA", released: "2023-07-05" },
  { album: "POPS", released: "2026-09-30" },
];
