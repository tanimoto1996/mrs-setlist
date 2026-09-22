/** 予想対象の公演。Jev の state に入る「前提」。 */
export interface EventContext {
  tour: string;
  date: string;
  venue: string;
  /** 主催側の公式情報など、確度の高い事実 */
  facts: string[];
  /** ユーザーが足す話題・匂わせ・憶測 */
  rumors: string;
  /** 本編＋アンコールの想定曲数 */
  setlistSize: number;
}

export const SHADOWS_OPENING: EventContext = {
  tour: 'Mrs. GREEN APPLE Ringo Jam Tour "SHADOWS"',
  date: "2026-09-30",
  venue: "あなぶきアリーナ香川（香川県立アリーナ）",
  facts: [
    "ファンクラブ Ringo Jam 会員向けの全国アリーナツアーで、この公演がツアー初日",
    "同日に 6th オリジナルフルアルバム『POPS』が発売（前日 9/29 に配信先行）",
    "約3年ぶりの全国アリーナツアー",
    "ツアータイトルは SHADOWS（影）。アルバムには『夏の影』が収録されている",
    "FC ツアーなので、一般向けドームやスタジアム公演よりコアなファン向けの選曲が通りやすい",
  ],
  rumors: "",
  setlistSize: 24,
};
