/**
 * Mrs. GREEN APPLE 曲マスタ。
 * 手作業で起こしたデータなので抜け・誤りは普通にある想定。直したら PR ください。
 *
 * mood:   up = アップチューン / mid = ミディアム / ballad = バラード
 * era:    phase1 = 2013-2020 / phase2 = 2022- (活動再開後)
 * staple: 直近ツアーやフェスで定番化している曲（主観）
 */
import songStatsJson from "./song-stats.json" with { type: "json" };

export type Mood = "up" | "mid" | "ballad";
export type Era = "phase1" | "phase2";

export interface Song {
  id: string;
  title: string;
  year: number;
  album: string;
  mood: Mood;
  era: Era;
  tieup?: string;
  staple?: boolean;
  /** POPS (2026-09-30) 収録曲 */
  pops?: boolean;
}

const s = (
  id: string,
  title: string,
  year: number,
  album: string,
  mood: Mood,
  extra: Partial<Pick<Song, "tieup" | "staple" | "pops">> = {},
): Song => ({
  id,
  title,
  year,
  album,
  mood,
  era: year >= 2022 ? "phase2" : "phase1",
  ...extra,
});

export const SONGS: Song[] = [
  // ---- POPS (2026) ----
  s("brand-new", "Brand New", 2026, "POPS", "up", { tieup: "映画『スパイダーマン：ブランド・ニュー・デイ』日本版主題歌", pops: true }),
  s("kyohan", "共犯", 2026, "POPS", "mid", { pops: true }),
  s("cinderella", "シンデレラ", 2026, "POPS", "mid", { pops: true }),
  s("hon-to-suisei", "本と彗星", 2026, "POPS", "mid", { pops: true }),
  s("a-posteriori", "ア・ポステリオリ", 2026, "POPS", "mid", { pops: true }),
  s("good-day", "GOOD DAY", 2025, "POPS", "up", { tieup: "キリン グッドエール ブランドアンセム", pops: true }),
  s("episode", "エピソード", 2026, "POPS", "mid", { pops: true }),
  s("lulu", "lulu.", 2026, "POPS", "up", { tieup: "TVアニメ『葬送のフリーレン』第2期 OP", pops: true }),
  s("kaze-to-machi", "風と町", 2026, "POPS", "mid", { tieup: "連続テレビ小説『風、薫る』主題歌", pops: true }),
  s("really-really", "Really Really", 2026, "POPS", "up", { pops: true }),
  s("project4", "プロジェクト4", 2026, "POPS", "up", { pops: true }),
  s("mayakashi", "瞞し", 2026, "POPS", "mid", { pops: true }),
  s("kinjita-asobi", "禁じた遊び", 2026, "POPS", "mid", { pops: true }),
  s("carrying-happiness", "Carrying Happiness", 2025, "POPS", "up", { pops: true }),
  s("natsu-no-kage", "夏の影", 2025, "POPS", "mid", { tieup: "キリン 午後の紅茶 CM", pops: true }),
  s("variety", "Variety", 2025, "POPS", "up", { tieup: "映画『MGA MAGICAL 10 YEARS DOCUMENTARY FILM ～THE ORIGIN～』主題歌", pops: true }),

  // ---- 2024-2025 シングル ----
  s("breakfast", "breakfast", 2025, "single", "up"),
  s("tengoku", "天国", 2025, "single", "mid"),
  s("kususiki", "クスシキ", 2025, "single", "up", { staple: true }),
  s("dear", "Dear", 2025, "single", "ballad", { staple: true }),
  s("darling", "ダーリン", 2024, "single", "ballad", { staple: true }),
  s("bitter-vacances", "ビターバカンス", 2024, "single", "up"),
  s("apollodorus", "アポロドロス", 2024, "single", "up"),
  s("familie", "familie", 2024, "single", "mid", { staple: true }),
  s("lilac", "ライラック", 2024, "single", "up", { tieup: "TVアニメ『忘却バッテリー』OP", staple: true }),
  s("nachtmusik", "ナハトムジーク", 2024, "single", "ballad", { tieup: "映画『サイレントラブ』主題歌" }),

  // ---- ANTENNA (2023) / Phase 2 初期 ----
  s("antenna", "ANTENNA", 2023, "ANTENNA", "mid"),
  s("dance-hall", "ダンスホール", 2022, "ANTENNA", "up", { tieup: "めざましテレビ テーマソング", staple: true }),
  s("blizzard", "Blizzard", 2023, "ANTENNA", "up"),
  s("doodle", "Doodle", 2023, "ANTENNA", "up"),
  s("blue-ambience", "ブルーアンビエンス (feat. asmi)", 2022, "ANTENNA", "mid"),
  s("feeling", "Feeling", 2023, "ANTENNA", "up"),
  s("floriginal", "フロリジナル", 2023, "ANTENNA", "up"),
  s("new-my-normal", "ニュー・マイ・ノーマル", 2022, "ANTENNA", "up"),
  s("loneliness", "Loneliness", 2023, "ANTENNA", "mid"),
  s("magic", "Magic", 2023, "ANTENNA", "up", { tieup: "コカ・コーラ CM", staple: true }),
  s("soranji", "Soranji", 2022, "ANTENNA", "ballad", { tieup: "映画『ラーゲリより愛を込めて』主題歌", staple: true }),
  s("norn", "norn", 2023, "ANTENNA", "mid"),
  s("part-of-me", "Part of me", 2023, "ANTENNA", "mid"),
  s("enen", "延々", 2023, "ANTENNA", "ballad"),
  s("que-sera-sera", "ケセラセラ", 2023, "single", "up", { tieup: "ドラマ『日曜の夜ぐらいは…』主題歌", staple: true }),
  s("watashi-wa-saikyo", "私は最強", 2022, "single", "up", { tieup: "映画『ONE PIECE FILM RED』(セルフカバー)" }),

  // ---- Attitude (2019) / Unity (2020) ----
  s("attitude", "Attitude", 2019, "Attitude", "mid"),
  s("inferno", "インフェルノ", 2019, "Attitude", "up", { tieup: "TVアニメ『炎炎ノ消防隊』OP", staple: true }),
  s("romanticism", "ロマンチシズム", 2019, "Attitude", "up", { tieup: "資生堂 SEA BREEZE CM" }),
  s("cheers", "CHEERS", 2019, "Attitude", "up"),
  s("circle", "Circle", 2019, "Attitude", "mid"),
  s("propose", "ProPose", 2019, "Attitude", "mid"),
  s("viking", "Viking", 2019, "Attitude", "up"),
  s("ke-mo-sabe", "Ke-Mo Sabe", 2019, "Attitude", "up"),
  s("folktale", "Folktale", 2019, "Attitude", "mid"),
  s("uso-janai-yo", "嘘じゃないよ", 2019, "Attitude", "up"),
  s("smile-of-dreamer", "スマイロブドリーマ", 2019, "Attitude", "up"),
  s("kudari", "クダリ", 2019, "Attitude", "ballad"),
  s("tsuki-to-anemone", "月とアネモネ", 2019, "Attitude", "ballad"),
  s("boku-no-koto", "僕のこと", 2019, "Attitude", "ballad", { tieup: "第97回全国高校サッカー選手権 応援歌", staple: true }),
  s("lovin", "lovin'", 2019, "Attitude", "mid"),
  s("coffee", "Coffee", 2019, "Attitude", "mid"),
  s("ao-to-natsu", "青と夏", 2018, "Attitude", "up", { tieup: "映画『青夏 きみに恋した30日』主題歌", staple: true }),
  s("tomoshibi", "灯火", 2019, "Attitude", "ballad"),
  s("himitsu", "秘密", 2019, "Attitude", "mid"),
  s("avoid-note", "アボイドノート", 2020, "Unity", "up"),
  s("theater", "Theater", 2020, "Unity", "mid"),
  s("present", "PRESENT", 2020, "Unity", "mid"),

  // ---- ENSEMBLE (2018) ----
  s("anzenpai", "アンゼンパイ", 2018, "ENSEMBLE", "up"),
  s("love-me-love-you", "Love me, Love you", 2018, "ENSEMBLE", "up"),
  s("party", "PARTY", 2018, "ENSEMBLE", "up"),
  s("wanted-wanted", "WanteD! WanteD!", 2017, "ENSEMBLE", "up", { tieup: "ドラマ『僕たちがやりました』主題歌", staple: true }),
  s("reverse", "REVERSE", 2018, "ENSEMBLE", "up"),
  s("soup", "Soup", 2018, "ENSEMBLE", "mid"),
  s("splash", "SPLASH!!!", 2018, "ENSEMBLE", "up"),
  s("nani-wo-nani-wo", "ナニヲナニヲ", 2018, "ENSEMBLE", "up"),
  s("hug", "Hug", 2018, "ENSEMBLE", "mid"),
  s("aufheben", "アウフヘーベン", 2018, "ENSEMBLE", "mid"),
  s("tenbyou-no-uta", "点描の唄 (feat. 井上苑子)", 2018, "ENSEMBLE", "ballad", { staple: true }),
  s("shunshu", "春愁", 2018, "ENSEMBLE", "ballad"),
  s("hikari-no-uta", "光のうた", 2018, "ENSEMBLE", "mid"),

  // ---- Mrs. GREEN APPLE (2017) ----
  s("speaking", "Speaking", 2017, "Mrs. GREEN APPLE", "up"),
  s("in-the-morning", "In the Morning", 2016, "Mrs. GREEN APPLE", "up"),
  s("kujira-no-uta", "鯨の唄", 2016, "Mrs. GREEN APPLE", "ballad", { tieup: "映画『ミュージアム』" }),
  s("just-a-friend", "Just a Friend", 2017, "Mrs. GREEN APPLE", "up"),
  s("simpathy", "SimPathy", 2017, "Mrs. GREEN APPLE", "up"),
  s("connected", "CONNECTED", 2017, "Mrs. GREEN APPLE", "up"),
  s("oz", "Oz", 2017, "Mrs. GREEN APPLE", "mid"),
  s("whoo-whoo-whoo", "WHOO WHOO WHOO", 2017, "Mrs. GREEN APPLE", "up"),
  s("dokoka-de-hi-wa-noboru", "どこかで日は昇る", 2017, "Mrs. GREEN APPLE", "ballad"),
  s("samama-festival", "サママ・フェスティバル！", 2016, "Mrs. GREEN APPLE", "up"),
  s("they-are", "They are", 2017, "Mrs. GREEN APPLE", "up"),
  s("soft-drink", "soFt-dRink", 2017, "Mrs. GREEN APPLE", "up"),

  // ---- TWELVE (2016) / インディーズ期 ----
  s("gaou-jin", "我逢人", 2015, "TWELVE", "mid", { staple: true }),
  s("start", "StaRt", 2015, "TWELVE", "up", { staple: true }),
  s("vip", "VIP", 2016, "TWELVE", "up"),
  s("public", "パブリック", 2016, "TWELVE", "up"),
  s("misukasazu", "ミスカサズ", 2016, "TWELVE", "up"),
  s("aijou-to-hokosaki", "愛情と矛先", 2016, "TWELVE", "up"),
  s("koi-to-gin", "恋と吟", 2016, "TWELVE", "mid"),
  s("risky-game", "リスキーゲーム", 2016, "TWELVE", "up"),
  s("doutoku-to-sara", "道徳と皿", 2016, "TWELVE", "up"),
  s("shoki-no-uta", "庶幾の唄", 2016, "TWELVE", "ballad"),
  s("umbrella", "umbrella", 2016, "TWELVE", "mid"),
  s("ai", "藍", 2016, "TWELVE", "ballad"),
  s("progressive", "Progressive", 2015, "Progressive", "up"),
];

export const SONG_MAP: ReadonlyMap<string, Song> = new Map(SONGS.map((x) => [x.id, x]));

// ---- 過去ライブの演奏実績（setlist.fm 由来） ----

/**
 * 曲ごとの演奏実績。scripts/build-song-stats.ts が data/setlists.json から集計して
 * lib/song-stats.json に書き出す。手で編集しない。
 * （interface でなく type にしているのは、Jev の state（JsonValue）にそのまま入れるため）
 */
export type SongStats = {
  /** 集計期間中の演奏回数 */
  playCount: number;
  /** ツアー名ごとの演奏回数（多い順） */
  playCountByTour: Record<string, number>;
  /** 最後に演奏した日 (YYYY-MM-DD)。一度も無ければ null */
  lastPlayed: string | null;
  /** 演奏された公演のうち、1 曲目（SE/Tape 除く）だった割合 0〜1 */
  openerRate: number;
  /** 演奏された公演のうち、アンコールだった割合 0〜1 */
  encoreRate: number;
  /** 公演内での位置の平均。0 = 1 曲目、1 = ラスト。未演奏なら null */
  avgPosition: number | null;
};

export interface SongStatsFile {
  generatedAt: string;
  /** 集計対象の開始日 (YYYY-MM-DD) */
  since: string;
  /** 曲情報のある公演数（割合の分母の目安） */
  totalShows: number;
  songs: Record<string, SongStats>;
}

/** stats は song-stats.json に無い曲（集計後に追加された曲など）だけ null */
export type SongWithStats = Song & { stats: SongStats | null };

export const SONG_STATS: SongStatsFile = songStatsJson as SongStatsFile;

export function getSongsWithStats(): SongWithStats[] {
  return SONGS.map((song) => ({ ...song, stats: SONG_STATS.songs[song.id] ?? null }));
}

export const ALBUM_ORDER = [
  "POPS",
  "single",
  "ANTENNA",
  "Attitude",
  "Unity",
  "ENSEMBLE",
  "Mrs. GREEN APPLE",
  "TWELVE",
  "Progressive",
] as const;
