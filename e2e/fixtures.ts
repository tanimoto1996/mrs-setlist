import { test as base, expect, type Page, type Request } from "@playwright/test";
import type { PredictionResult, Slot, SongPrediction } from "@/lib/jev";

export { expect };

/** app/page.tsx の STORAGE_KEY と同じ。変えるときは両方 */
export const STORAGE_KEY = "mga-setlist-oracle:v1";

/** app/page.tsx の Saved と同じ形 */
export interface Saved {
  mine: string[];
  actual: string[];
  rumors: string;
  jev: PredictionResult | null;
  gemini: PredictionResult | null;
}

/** lib/event.ts の SHADOWS_OPENING.setlistSize */
export const SETLIST_SIZE = 24;

/** テストで名指しする曲。id / 表示名は lib/songs.ts に合わせる */
export const SONG = {
  soranji: { id: "soranji", title: "Soranji" },
  aoToNatsu: { id: "ao-to-natsu", title: "青と夏" },
  queSeraSera: { id: "que-sera-sera", title: "ケセラセラ" },
  danceHall: { id: "dance-hall", title: "ダンスホール" },
  inferno: { id: "inferno", title: "インフェルノ" },
  lilac: { id: "lilac", title: "ライラック" },
  start: { id: "start", title: "StaRt" },
  brandNew: { id: "brand-new", title: "Brand New" },
} as const;

/** Jev のモック用。slot 順（opener → middle → encore）に並んだ 24 曲 */
const FAKE_SETLIST: { id: string; slot: Slot }[] = [
  { id: "brand-new", slot: "opener" },
  { id: "dance-hall", slot: "opener" },
  { id: "lilac", slot: "opener" },
  { id: "kyohan", slot: "middle" },
  { id: "cinderella", slot: "middle" },
  { id: "hon-to-suisei", slot: "middle" },
  { id: "a-posteriori", slot: "middle" },
  { id: "good-day", slot: "middle" },
  { id: "episode", slot: "middle" },
  { id: "lulu", slot: "middle" },
  { id: "kaze-to-machi", slot: "middle" },
  { id: "really-really", slot: "middle" },
  { id: "project4", slot: "middle" },
  { id: "mayakashi", slot: "middle" },
  { id: "kinjita-asobi", slot: "middle" },
  { id: "carrying-happiness", slot: "middle" },
  { id: "natsu-no-kage", slot: "middle" },
  { id: "que-sera-sera", slot: "middle" },
  { id: "inferno", slot: "middle" },
  { id: "ao-to-natsu", slot: "middle" },
  { id: "boku-no-koto", slot: "middle" },
  { id: "soranji", slot: "encore" },
  { id: "start", slot: "encore" },
  { id: "wanted-wanted", slot: "encore" },
];

/** 本物の PredictionResult と同じ形のダミー。Jev / Gemini（有料）は呼ばない。model 名で Jev 用と Gemini 用を見分ける */
export function fakePrediction(model = "e2e-fake-model"): PredictionResult {
  const predictions: SongPrediction[] = FAKE_SETLIST.map(({ id, slot }, i) => {
    const likelihood = Math.round((1 - i / FAKE_SETLIST.length) * 100) / 100;
    const slotProbabilities: Record<Slot, number> = { opener: 0.1, middle: 0.1, encore: 0.1, skip: 0.1 };
    slotProbabilities[slot] = 0.7;
    return { songId: id, likelihood, confidence: 0.8, slot, slotProbabilities };
  });
  return {
    model,
    predictions,
    setlist: FAKE_SETLIST.map((s) => s.id),
    usage: { input_tokens: 1234, output_tokens: 567 },
  };
}

interface Fixtures {
  /** `/api/predict` に飛んだリクエスト。テスト側で件数・ボディを検証できる */
  jevCalls: Request[];
  /** localStorage に Saved を流し込む。`page.goto` より前に呼ぶ */
  seed: (saved: Partial<Saved>) => Promise<void>;
  /**
   * `/api/predict` の応答を差し替える。成功なら PredictionResult、失敗なら { status, error }。
   * engine（jev / gemini）を区別せず同じ応答を返す。どちらが呼ばれたかは jevCalls のボディで見る
   */
  mockJev: (response: PredictionResult | { status: number; error: string }) => Promise<void>;
}

export const test = base.extend<Fixtures>({
  jevCalls: async ({}, use) => {
    await use([]);
  },

  page: async ({ page, jevCalls }, use) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (e) => pageErrors.push(e.message));

    // 有料の Jev を絶対に呼ばない。mockJev で上書きしない限り、ここで 500 を返して止める
    await page.route("**/api/predict", (route) => {
      jevCalls.push(route.request());
      return route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "E2E では Jev を呼ばない（mockJev で応答を差し替える）" }),
      });
    });

    await use(page);

    expect(pageErrors, "ブラウザで未捕捉の例外が出た").toEqual([]);
  },

  seed: async ({ page }, use) => {
    await use(async (saved) => {
      const value: Saved = { mine: [], actual: [], rumors: "", jev: null, gemini: null, ...saved };
      await page.addInitScript(
        ([key, json]) => localStorage.setItem(key, json),
        [STORAGE_KEY, JSON.stringify(value)] as const,
      );
    });
  },

  mockJev: async ({ page, jevCalls }, use) => {
    await use(async (response) => {
      const ok = !("status" in response);
      await page.route("**/api/predict", (route) => {
        jevCalls.push(route.request());
        return route.fulfill({
          status: ok ? 200 : response.status,
          contentType: "application/json",
          body: JSON.stringify(ok ? response : { error: response.error }),
        });
      });
    });
  },
});

/* ---------- 画面のよく使う場所 ---------- */

export const ui = {
  /**
   * ページを開いて、操作できる状態（hydration 完了 = <main aria-busy="false">）まで待つ。
   * next dev では load イベントがフォントのプリロード完了まで数秒待たされるので domcontentloaded で先へ進む。
   * hydration 前に入力・クリックすると React が状態を初期化して消えるので、この待ちを省かない。
   */
  open: async (page: Page, path = "/") => {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await ui.ready(page);
  },
  reload: async (page: Page) => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await ui.ready(page);
  },
  ready: (page: Page) => expect(page.locator("main")).toHaveAttribute("aria-busy", "false"),
  library: (page: Page) => page.locator('section[aria-labelledby="songs-heading"]'),
  /** New Album Odds（新譜曲がセトリを占めた割合の過去実績と目安） */
  odds: (page: Page) => page.locator('section[aria-labelledby="odds-heading"]'),
  mine: (page: Page) => page.locator('section[aria-labelledby="mine-heading"]'),
  jev: (page: Page) => page.locator('section[aria-labelledby="jev-heading"]'),
  gemini: (page: Page) => page.locator('section[aria-labelledby="gemini-heading"]'),
  result: (page: Page) => page.locator('section[aria-labelledby="result-heading"]'),
  /** Library の曲チップ。表示名の完全一致で探す（"Soranji" と "Soranji 2" を取り違えない） */
  chip: (page: Page, title: string) =>
    ui.library(page).locator("button.chip").filter({ has: page.locator("span", { hasText: exact(title) }) }),
  /** セトリの行（My Setlist / Jev's Call / Gemini's Call 共通） */
  tracks: (section: ReturnType<Page["locator"]>) => section.locator("li.track"),
  trackTitles: async (section: ReturnType<Page["locator"]>) =>
    (await ui.tracks(section).locator(".track-title").allInnerTexts()).map((t) => t.replace(/（的中）|（外れ）/g, "").trim()),
  /** セトリの並びを検証する。件数が揃うまで待ってから読むので、hydration 前の空リストを掴まない */
  expectTracks: async (section: ReturnType<Page["locator"]>, titles: string[]) => {
    await expect(ui.tracks(section)).toHaveCount(titles.length);
    expect(await ui.trackTitles(section)).toEqual(titles);
  },
  tab: (page: Page, name: "俺の予想に入れる" | "実セトリを入力") => page.getByRole("tab", { name }),
  quick: (page: Page, name: "すべて" | "POPS 新曲" | "ライブ定番" | "タイアップ") =>
    page.getByRole("group", { name: "クイックフィルタ" }).getByRole("button", { name }),
  search: (page: Page) => page.getByRole("searchbox", { name: "曲名で絞る" }),
};

function exact(text: string) {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
}
