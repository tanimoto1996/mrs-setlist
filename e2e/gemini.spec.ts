import { expect, fakePrediction, SETLIST_SIZE, SONG, test, ui, type Saved } from "./fixtures";

test.describe("Gemini に予想させて Jev と比べる（API はモック）", () => {
  test("engine=gemini で呼び、Gemini のカードに並ぶ。Jev 側は空のまま", async ({ page, mockJev, jevCalls }) => {
    await mockJev(fakePrediction("e2e-fake-gemini"));
    await ui.open(page);
    const gemini = ui.gemini(page);

    await gemini.getByRole("button", { name: "Gemini に予想させる" }).click();

    // 送ったもの: Jev と同じメモ・曲数に engine が付く。1 回しか呼ばない
    await expect.poll(() => jevCalls.length).toBe(1);
    expect(JSON.parse(jevCalls[0].postData() ?? "{}")).toEqual({ rumors: "", setlistSize: SETLIST_SIZE, engine: "gemini" });

    await expect(ui.tracks(gemini)).toHaveCount(SETLIST_SIZE);
    await expect(gemini.locator("li.slot-label")).toHaveText(["Opening", "Middle", "Encore"]);
    await expect(gemini.getByText("e2e-fake-gemini")).toBeVisible();
    await expect(gemini.getByRole("button", { name: "もう一回予想させる" })).toBeEnabled();
    await expect(ui.tracks(ui.jev(page))).toHaveCount(0);

    // 未選択のチップに Gemini の見込み（青）が出る。Jev の見込み（緑）は無い
    const chip = ui.chip(page, SONG.brandNew.title);
    await expect(chip.locator(".chip-meta-alt")).toHaveText("100%");
    await expect(chip.locator(".chip-meta")).toHaveCount(0);

    // リロードしても残る
    await ui.reload(page);
    await expect(ui.tracks(ui.gemini(page))).toHaveCount(SETLIST_SIZE);
  });

  test("Jev と Gemini の両方があると共通曲の数が出る", async ({ page, seed }) => {
    const jev = fakePrediction();
    const gemini = { ...fakePrediction("e2e-fake-gemini"), setlist: [...fakePrediction().setlist].reverse() };
    await seed({ jev, gemini });
    await ui.open(page);

    await expect(ui.gemini(page).getByText(`Jev と同じ曲 ${SETLIST_SIZE} / ${SETLIST_SIZE}`)).toBeVisible();
  });

  test("失敗したら Gemini のカードだけにアラートが出る", async ({ page, mockJev }) => {
    await mockJev({ status: 500, error: "テスト用: GEMINI_API_KEY が未設定" });
    await ui.open(page);

    await ui.gemini(page).getByRole("button", { name: "Gemini に予想させる" }).click();

    await expect(ui.gemini(page).getByRole("alert")).toHaveText("テスト用: GEMINI_API_KEY が未設定");
    await expect(ui.jev(page).getByRole("alert")).toHaveCount(0);
    await expect(ui.tracks(ui.gemini(page))).toHaveCount(0);
  });
});

/**
 * 3 者採点（lib/scoring.ts: 曲一致 10、順番 ±2 で +5、1 曲目・ラスト曲の的中で各 +15）。
 * 実セトリ = [青と夏, ケセラセラ, Soranji]
 *   俺     = [Soranji, 青と夏, ケセラセラ] → 3 曲一致・順番 3（全部 ±2 以内）= 45
 *   Jev    = [ケセラセラ, 青と夏, Soranji] → 45 + ラスト◎ 15 = 60
 *   Gemini = 実セトリと同じ               → 45 + 1 曲目◎ 15 + ラスト◎ 15 = 75
 */
test.describe("俺 vs Jev vs Gemini の答え合わせ", () => {
  const ACTUAL = [SONG.aoToNatsu.id, SONG.queSeraSera.id, SONG.soranji.id];
  const MINE = [SONG.soranji.id, SONG.aoToNatsu.id, SONG.queSeraSera.id];
  const JEV = [SONG.queSeraSera.id, SONG.aoToNatsu.id, SONG.soranji.id];

  function seeded(model: string, setlist: string[]): NonNullable<Saved["jev"]> {
    const base = fakePrediction(model);
    return { ...base, setlist, predictions: base.predictions.filter((p) => setlist.includes(p.songId)) };
  }

  test("3 枚のスコアが並び、最高点のエンジンが勝つ", async ({ page, seed }) => {
    await seed({ mine: MINE, actual: ACTUAL, jev: seeded("e2e-fake-model", JEV), gemini: seeded("e2e-fake-gemini", ACTUAL) });
    await ui.open(page);
    const result = ui.result(page);

    await expect(result.locator(".score-num")).toHaveText(["45", "60", "75"]);
    await expect(result.getByRole("status")).toHaveText("Gemini の勝ち");
    await expect(result.locator(".score-win")).toHaveCount(1);
    await expect(result.locator(".score-win")).toContainText("Gemini");
  });

  test("同点なら引き分け", async ({ page, seed }) => {
    await seed({ mine: MINE, actual: ACTUAL, jev: seeded("e2e-fake-model", ACTUAL), gemini: seeded("e2e-fake-gemini", ACTUAL) });
    await ui.open(page);

    await expect(ui.result(page).locator(".score-num")).toHaveText(["45", "75", "75"]);
    await expect(ui.result(page).getByRole("status")).toHaveText("引き分け");
  });
});
