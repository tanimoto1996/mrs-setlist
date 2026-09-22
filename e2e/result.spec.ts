import { expect, fakePrediction, SONG, test, ui, type Saved } from "./fixtures";

/**
 * 採点ルール（lib/scoring.ts）: 曲一致 10、順番 ±2 以内で +5、1 曲目・ラスト曲の的中で各 +15。
 * 俺 = [Soranji, 青と夏, ケセラセラ]、Jev = 逆順、実セトリ = 俺と同じ順 → 俺 75 点、Jev 45 点。
 */
const MINE: string[] = [SONG.soranji.id, SONG.aoToNatsu.id, SONG.queSeraSera.id];
const JEV_SETLIST: string[] = [...MINE].reverse();

function seededJev(): NonNullable<Saved["jev"]> {
  const base = fakePrediction();
  return {
    ...base,
    setlist: JEV_SETLIST,
    predictions: base.predictions.filter((p) => JEV_SETLIST.includes(p.songId)),
  };
}

test.describe("答え合わせ", () => {
  test("実セトリを入れた瞬間に採点され、勝敗が出る", async ({ page, seed }) => {
    await seed({ mine: MINE, jev: seededJev() });
    await ui.open(page);
    const result = ui.result(page);

    await ui.tab(page, "実セトリを入力").click();
    await expect(ui.tab(page, "実セトリを入力")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("いま押した曲は")).toBeVisible();

    await ui.chip(page, SONG.soranji.title).click();
    await ui.chip(page, SONG.aoToNatsu.title).click();
    await ui.chip(page, SONG.queSeraSera.title).click();

    await expect(result.getByText(/^実セトリ \d+ 曲$/)).toContainText("3");
    const scores = result.locator(".score-num");
    await expect(scores).toHaveText(["75", "45"]);
    await expect(result.getByText("3/3 曲一致 · 順番 3 · 1曲目◎ · ラスト◎")).toBeVisible();
    await expect(result.getByText("3/3 曲一致 · 順番 3", { exact: true })).toBeVisible();
    await expect(result.getByRole("status")).toHaveText("俺の勝ち");

    // 俺の予想の各行に的中マークが付く
    await expect(ui.tracks(ui.mine(page)).and(page.locator(".track-hit"))).toHaveCount(3);
  });

  test("Jev の予想が無ければ Jev 側は「予想なし」", async ({ page, seed }) => {
    await seed({ mine: MINE, actual: [SONG.soranji.id, SONG.start.id] });
    await ui.open(page);
    const result = ui.result(page);

    // 俺: Soranji が 1 曲目で一致 → 10 + 5 + 15 = 30
    await expect(result.locator(".score-num")).toHaveText(["30"]);
    await expect(result.getByText("予想なし")).toBeVisible();
    await expect(result.getByRole("status")).toBeHidden();

    // 外れの行にも印が付く
    await expect(ui.tracks(ui.mine(page)).and(page.locator(".track-miss"))).toHaveCount(2);
  });

  test("「実セトリを消す」は確認ダイアログを挟み、俺と Jev の予想は残す", async ({ page, seed }) => {
    await seed({ mine: MINE, actual: MINE, jev: seededJev() });
    await ui.open(page);
    const result = ui.result(page);
    const clear = result.getByRole("button", { name: "実セトリを消す" });

    // キャンセルなら何も変わらない
    page.once("dialog", (d) => d.dismiss());
    await clear.click();
    await expect(result.locator(".score-num")).toHaveCount(2);

    // OK で実セトリだけ消える
    page.once("dialog", (d) => d.accept());
    await clear.click();
    await expect(result.locator(".score-num")).toHaveCount(0);
    await expect(result.getByText("ライブが終わったら")).toBeVisible();
    await expect(ui.tracks(ui.mine(page))).toHaveCount(3);
    await expect(ui.tracks(ui.jev(page))).toHaveCount(3);
  });
});
