/**
 * 「連続するワンマンツアーの間で、曲はどれだけ持ち越されるか」の型と読み出し。
 * データは scripts/build-tour-stats.ts が data/setlists-history.json から lib/tour-stats.json に書く。手で編集しない。
 * サーバー（Jev / Gemini の state）と画面（Tour Carryover カード）の両方から使うので server-only にしない。
 */
import tourStatsJson from "./tour-stats.json" with { type: "json" };

/** ワンマンツアー（または単独公演）1 本ぶん */
export type TourStat = {
  /** 一意なキー（初日の日付） */
  key: string;
  /** 正式名称（lib/tours.ts）。無ければ setlist.fm の tour 名、それも無ければ「日付 会場」 */
  name: string;
  shortName: string;
  nameSource: "known" | "setlist.fm" | "venue";
  from: string;
  to: string;
  shows: number;
  avgSongs: number;
  /** ツアー中に 1 回でも演奏された曲数 */
  distinctSongs: number;
  fanClubOnly: boolean;
  /** 曲 id → ツアー中に演奏した公演数 */
  played: Record<string, number>;
};

/** 連続する 2 ツアーの比較 */
export type TourPairStat = {
  prev: string;
  next: string;
  prevName: string;
  nextName: string;
  prevSongs: number;
  nextSongs: number;
  /** next の曲のうち prev でも演奏された曲（持ち越し） */
  carried: number;
  carriedShare: number;
  /** prev の曲のうち next で演奏されなかった曲（外れた） */
  dropped: number;
  droppedShare: number;
  /** next の曲のうち prev に無かった曲（新顔） */
  fresh: number;
  freshShare: number;
  /** 新顔のうち、それより前のツアーで演奏実績がある曲（復活） */
  freshReturned: number;
  /** 新顔のうち、データ上初めて演奏された曲（新曲・初披露） */
  freshFirstTime: number;
  /** prev で連続 n ツアー目だった曲が next にも残った数。連続回数別 */
  carriedByStreak: Record<StreakBucket, { songs: number; carried: number }>;
  carriedIds: string[];
  droppedIds: string[];
  freshIds: string[];
};

export type StreakBucket = "1" | "2" | "3+";

/** 曲ごとの直近ツアーでの出場状況 */
export type SongRecentTours = {
  /** 直近ツアーごとに演奏されたか。新しい順（[0] = 直近） */
  playedIn: boolean[];
  /** 直近から数えて連続何ツアー演奏されているか（直近で演奏されていなければ 0） */
  streak: number;
  /** 最後に演奏されたツアーから何ツアー空いているか。0 = 前回ツアーで演奏、null = 対象期間に演奏なし */
  toursSinceLastPlayed: number | null;
};

export type TourStatsFile = {
  generatedAt: string;
  source: "setlist.fm";
  dataRange: { since: string; until: string };
  rule: { oneManMinSongs: number; gapDays: number; recentTours: number };
  /** 古い順 */
  tours: TourStat[];
  /** 古い順（tours[i-1] → tours[i]） */
  pairs: TourPairStat[];
  summary: {
    pairs: number;
    carriedShare: { mean: number; median: number; min: number; max: number } | null;
    droppedShareMean: number | null;
    freshShareMean: number | null;
    /** 新顔のうち復活曲が占めた割合（全ペア合算） */
    freshReturnedShare: number | null;
    /** prev での連続回数別に、next へ持ち越された割合（全ペア合算） */
    carriedRateByStreak: Record<StreakBucket, number | null>;
    /** 直近ツアーのキー（新しい順、rule.recentTours 本） */
    recentTours: string[];
    lastTour: string | null;
    /** 直近ツアー全部で演奏された曲 */
    playedInAllRecent: string[];
    /** 直近のファンクラブ限定ツアー */
    lastFanClubTour: string | null;
  };
  songs: Record<string, SongRecentTours>;
  /** ツアー期間内で突合できなかった曲名（setlist.fm 側の表記 × 回数） */
  unmatched: Record<string, number>;
};

// JSON の型推論だと played のキー集合がツアーごとに違って Record に合わないので unknown を経由する
export const TOUR_STATS: TourStatsFile = tourStatsJson as unknown as TourStatsFile;

export function tourOf(key: string | null | undefined): TourStat | undefined {
  return key ? TOUR_STATS.tours.find((t) => t.key === key) : undefined;
}

/** 直近ツアー（新しい順） */
export function recentTours(): TourStat[] {
  return TOUR_STATS.summary.recentTours.map((k) => tourOf(k)).filter((t): t is TourStat => !!t);
}

/** 「前回ツアーの曲のうち、次のツアーにも残る曲数」の目安（平均持ち越し率 × 前回の曲数、min〜max のレンジ） */
export function projectCarriedSongs(): { tour: TourStat; low: number; mean: number; high: number } | null {
  const last = tourOf(TOUR_STATS.summary.lastTour);
  const share = TOUR_STATS.summary.carriedShare;
  if (!last || !share) return null;
  // 「次のツアーの曲のうち持ち越し」の割合なので、次のツアーも同規模と仮定して前回の曲数に掛ける
  const n = last.distinctSongs;
  return { tour: last, low: Math.round(share.min * n), mean: Math.round(share.mean * n), high: Math.round(share.max * n) };
}
