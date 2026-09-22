/**
 * 「フルアルバム発売直後のツアーで新アルバム曲が占めた割合」の型と読み出し。
 * データは scripts/build-album-debut-stats.ts が lib/album-debut-stats.json に書く。手で編集しない。
 * サーバー（Jev / Gemini の state）と画面（New Album Odds カード）の両方から使うので server-only にしない。
 */
import albumDebutStatsJson from "./album-debut-stats.json" with { type: "json" };

/** 1 公演ぶんの新アルバム曲の数え上げ */
export type AlbumShowStats = {
  date: string;
  venue: string;
  tour: string | null;
  url: string;
  /** 演奏曲数（SE / Tape 除く） */
  songs: number;
  newAlbumSongs: number;
  /** newAlbumSongs / songs */
  newAlbumShare: number;
  /** 演奏された新アルバム曲のうち先行シングル */
  preReleasedPlayed: number;
  /** 演奏された新アルバム曲のうちアルバムで初出の曲 */
  albumOnlyPlayed: number;
  newAlbumSongIds: string[];
};

export type AlbumTourStats = {
  shows: number;
  from: string;
  to: string;
  tourName: string | null;
  avgSongs: number;
  avgNewAlbumSongs: number;
  avgNewAlbumShare: number;
  /** 収録曲のうちツアー中に 1 回でも演奏された曲数 */
  tracksPlayed: number;
  preReleasedPlayed: number;
  albumOnlyPlayed: number;
  /** 収録曲ごとの「ツアー公演のうち演奏された割合」 */
  trackPlayRate: Record<string, number>;
};

export type AlbumDebutStats = {
  album: string;
  released: string;
  /** lib/songs.ts にあるこのアルバムの曲数 */
  trackCount: number;
  /** 発売前にライブ演奏済み、または発売年より前の曲（先行シングル） */
  preReleased: string[];
  /** アルバムで初めて世に出た曲 */
  albumOnly: string[];
  /** measured = 集計できた / no-data = 期間内のワンマン公演データが無い / upcoming = まだ発売されていない */
  status: "measured" | "no-data" | "upcoming";
  firstShow: AlbumShowStats | null;
  tour: AlbumTourStats | null;
};

export type AlbumDebutStatsFile = {
  generatedAt: string;
  source: "setlist.fm";
  dataRange: { since: string; until: string };
  rule: { oneManMinSongs: number; tourWindowDays: number };
  summary: {
    measuredAlbums: string[];
    noDataAlbums: string[];
    /** 計測できたアルバムの、初日の新アルバム曲比率の平均。計測ゼロなら null */
    firstShowShare: number | null;
    tourShare: number | null;
    /** 先行シングルのうち初日に演奏された割合 */
    preReleasedFirstShowRate: number | null;
    /** アルバム初出曲のうち初日に演奏された割合 */
    albumOnlyFirstShowRate: number | null;
    /** アルバム初出曲のうちツアー中に 1 回でも演奏された割合 */
    albumOnlyTourRate: number | null;
  };
  albums: AlbumDebutStats[];
};

export const ALBUM_DEBUT_STATS: AlbumDebutStatsFile = albumDebutStatsJson as AlbumDebutStatsFile;

export function albumDebutStatsOf(album: string): AlbumDebutStats | undefined {
  return ALBUM_DEBUT_STATS.albums.find((a) => a.album === album);
}

/** 新アルバム曲が何曲入るかの目安。過去実績の初日比率 × 想定曲数 */
export interface NewAlbumProjection {
  album: string;
  /** 初日の新アルバム曲比率（過去実績の平均）。実績ゼロなら null */
  share: number | null;
  /** setlistSize × share を四捨五入。実績ゼロなら null */
  expectedSongs: number | null;
  setlistSize: number;
  trackCount: number;
  preReleased: string[];
  albumOnly: string[];
  /** 根拠にしたアルバム名（1 枚ずつ「ANTENNA 2023-07-08 8/24」の形） */
  basis: string[];
}

export function projectNewAlbumSongs(album: string, setlistSize: number): NewAlbumProjection {
  const target = albumDebutStatsOf(album);
  const share = ALBUM_DEBUT_STATS.summary.firstShowShare;
  return {
    album,
    share,
    expectedSongs: share === null ? null : Math.round(share * setlistSize),
    setlistSize,
    trackCount: target?.trackCount ?? 0,
    preReleased: target?.preReleased ?? [],
    albumOnly: target?.albumOnly ?? [],
    basis: ALBUM_DEBUT_STATS.albums
      .filter((a) => a.status === "measured" && a.firstShow)
      .map((a) => `${a.album}: ${a.firstShow!.date} 初日 ${a.firstShow!.newAlbumSongs}/${a.firstShow!.songs} 曲`),
  };
}
