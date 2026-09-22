/**
 * setlist.fm REST API 1.0 の型と、正規化まわりの純粋関数。
 * https://api.setlist.fm/docs/1.0/index.html
 *
 * 実 API の JSON は `sets.set[]` に入る（ドキュメントの例は `set[]` になっているので両方受ける）。
 * eventDate は dd-MM-yyyy。
 */

export interface SetlistFmArtist {
  mbid: string;
  name: string;
  sortName?: string;
  disambiguation?: string;
  url?: string;
}

export interface SetlistFmCity {
  id?: string;
  name: string;
  state?: string;
  stateCode?: string;
  country?: { code?: string; name?: string };
}

export interface SetlistFmVenue {
  id?: string;
  name: string;
  city?: SetlistFmCity;
  url?: string;
}

export interface SetlistFmSong {
  name: string;
  /** ゲスト参加 */
  with?: SetlistFmArtist;
  /** カバー元 */
  cover?: SetlistFmArtist;
  info?: string;
  /** SE や録音再生。true なら演奏ではない */
  tape?: boolean;
}

export interface SetlistFmSet {
  name?: string;
  /** アンコールなら 1, 2, ... 本編なら undefined */
  encore?: number;
  song?: SetlistFmSong[];
}

export interface SetlistFmSetlist {
  id: string;
  versionId?: string;
  /** dd-MM-yyyy */
  eventDate: string;
  lastUpdated?: string;
  artist: SetlistFmArtist;
  venue: SetlistFmVenue;
  tour?: { name: string };
  sets?: { set?: SetlistFmSet[] };
  /** ドキュメント例の形。実 API では sets.set */
  set?: SetlistFmSet[];
  info?: string;
  /** 帰属表示用 URL（利用規約でリンクが求められる） */
  url: string;
}

/** GET /1.0/artist/{mbid}/setlists のレスポンス */
export interface SetlistFmSetlistsPage {
  type?: string;
  itemsPerPage: number;
  page: number;
  total: number;
  setlist?: SetlistFmSetlist[];
}

// ---- 正規化後の形（data/setlists.json） ----

export interface NormalizedSong {
  /** 1 始まりの通し番号（SE/Tape も含む） */
  order: number;
  title: string;
  /** アンコールなら 1, 2, ... 本編なら null */
  encore: number | null;
  isTape: boolean;
}

export interface NormalizedSetlist {
  /** setlist.fm の id。重複排除と帰属表示に使う */
  id: string;
  /** YYYY-MM-DD */
  date: string;
  tour: string | null;
  venue: string;
  city: string;
  url: string;
  songs: NormalizedSong[];
}

export interface SetlistsFile {
  source: "setlist.fm";
  artist: { mbid: string; name: string };
  /** この日以降の公演だけ入っている（YYYY-MM-DD） */
  since: string;
  fetchedAt: string;
  count: number;
  setlists: NormalizedSetlist[];
}

/** dd-MM-yyyy → YYYY-MM-DD */
export function toIsoDate(eventDate: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(eventDate);
  if (!m) throw new Error(`eventDate の形式が想定外: ${eventDate}`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function normalizeSetlist(sl: SetlistFmSetlist): NormalizedSetlist {
  const sets = sl.sets?.set ?? sl.set ?? [];
  const songs: NormalizedSong[] = [];
  for (const set of sets) {
    for (const song of set.song ?? []) {
      songs.push({
        order: songs.length + 1,
        title: song.name,
        encore: typeof set.encore === "number" ? set.encore : null,
        isTape: song.tape === true,
      });
    }
  }
  return {
    id: sl.id,
    date: toIsoDate(sl.eventDate),
    tour: sl.tour?.name ?? null,
    venue: sl.venue.name,
    city: sl.venue.city?.name ?? "",
    url: sl.url,
    songs,
  };
}
