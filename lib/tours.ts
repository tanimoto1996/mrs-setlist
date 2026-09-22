/**
 * ワンマンツアー・単独公演の正式名称。setlist.fm には tour 名が入っていない公演が多いので、
 * 日付範囲 → 名称の対応をここに置き、scripts/build-tour-stats.ts が公演をツアーにまとめるときに使う。
 *
 * 名称とファンクラブ限定かどうかの出典: Wikipedia「Mrs. GREEN APPLE」ライブ・ツアーの節（2026-09-23 参照）。
 * from / to は setlist.fm に登録されている公演の初日・最終日（データの範囲であって、ツアー全日程ではない）。
 * ここに無い期間の公演は setlist.fm の tour 名、それも無ければ日付の間隔（45 日）でまとめる。
 */
export interface KnownTour {
  /** 正式名称（画面と Jev の state で使う） */
  name: string;
  /** 一覧で使う短い名前 */
  shortName: string;
  from: string;
  to: string;
  /** ファンクラブ Ringo Jam 会員限定のツアーか */
  fanClubOnly: boolean;
}

export const KNOWN_TOURS: readonly KnownTour[] = [
  { name: 'ARENA TOUR 2023 "NOAH no HAKOBUNE"', shortName: "NOAH no HAKOBUNE", from: "2023-07-08", to: "2023-08-04", fanClubOnly: false },
  { name: 'DOME LIVE 2023 "Atlantis"', shortName: "Atlantis", from: "2023-08-12", to: "2023-08-13", fanClubOnly: false },
  { name: 'FC TOUR "The White Lounge"', shortName: "The White Lounge", from: "2023-12-20", to: "2024-03-03", fanClubOnly: true },
  { name: "ゼンジン未到とヴェルトラウム 〜銘銘編〜", shortName: "ゼンジン未到 銘銘編", from: "2024-07-06", to: "2024-07-21", fanClubOnly: false },
  { name: 'Mrs. GREEN APPLE on "Harmony"', shortName: "Harmony", from: "2024-10-05", to: "2024-11-20", fanClubOnly: false },
  { name: "MGA LIVE in SEOUL, KOREA 2025", shortName: "SEOUL 2025", from: "2025-02-15", to: "2025-02-16", fanClubOnly: false },
  { name: "MGA MAGICAL 10 YEARS ANNIVERSARY LIVE 〜FJORD〜", shortName: "FJORD", from: "2025-07-26", to: "2025-07-27", fanClubOnly: false },
  { name: 'DOME TOUR 2025 "BABEL no TOH"', shortName: "BABEL no TOH", from: "2025-10-25", to: "2025-12-20", fanClubOnly: false },
  { name: "ゼンじん未到とイ/ミュータブル 〜間奏編〜", shortName: "ゼンじん未到 間奏編", from: "2026-04-18", to: "2026-07-05", fanClubOnly: false },
];

export function knownTourOn(date: string): KnownTour | undefined {
  return KNOWN_TOURS.find((t) => t.from <= date && date <= t.to);
}
