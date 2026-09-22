import { expect, fakePrediction, SETLIST_SIZE, SONG, test, ui } from "./fixtures";

test.describe("Jev に予想させる（API はモック）", () => {
  test("予想が slot 順に並び、モデル名・トークン・チップの % が出る", async ({ page, mockJev, jevCalls }) => {
    await mockJev(fakePrediction());
    await ui.open(page);
    const jev = ui.jev(page);

    await page.getByLabel(/匂わせ・話題メモ/).fill("リハ音漏れで Soranji");
    await jev.getByRole("button", { name: "Jev に予想させる" }).click();

    // 送ったもの: メモと想定曲数。1 回しか呼ばない
    await expect.poll(() => jevCalls.length).toBe(1);
    expect(jevCalls[0].method()).toBe("POST");
    expect(JSON.parse(jevCalls[0].postData() ?? "{}")).toEqual({ rumors: "リハ音漏れで Soranji", setlistSize: SETLIST_SIZE, engine: "jev" });

    // 受け取ったもの: 24 曲が Opening → Middle → Encore の順に並ぶ
    await expect(ui.tracks(jev)).toHaveCount(SETLIST_SIZE);
    await expect(jev.locator("li.slot-label")).toHaveText(["Opening", "Middle", "Encore"]);
    const titles = await ui.trackTitles(jev);
    expect(titles[0]).toBe(SONG.brandNew.title);
    expect(titles.at(-1)).toBe("WanteD! WanteD!");

    await expect(jev.getByText("e2e-fake-model")).toBeVisible();
    await expect(jev.getByText(/in 1,234 · out 567 tokens/)).toBeVisible();
    await expect(jev.getByRole("button", { name: "もう一回予想させる" })).toBeEnabled();

    // 未選択のチップに Jev の見込みが出る
    await expect(ui.chip(page, SONG.brandNew.title).locator(".chip-meta")).toHaveText("100%");

    // リロードしても Jev の予想は残る
    await ui.reload(page);
    await expect(ui.tracks(ui.jev(page))).toHaveCount(SETLIST_SIZE);
  });

  test("失敗したらエラーをアラートで出し、予想は空のまま", async ({ page, mockJev }) => {
    await mockJev({ status: 502, error: "テスト用: Jev が落ちた" });
    await ui.open(page);
    const jev = ui.jev(page);

    await jev.getByRole("button", { name: "Jev に予想させる" }).click();

    await expect(jev.getByRole("alert")).toHaveText("テスト用: Jev が落ちた");
    await expect(ui.tracks(jev)).toHaveCount(0);
    await expect(jev.getByRole("button", { name: "Jev に予想させる" })).toBeEnabled();
  });

  test("モックし忘れても本物の Jev には届かない（fixtures の安全弁）", async ({ page, jevCalls }) => {
    await ui.open(page);
    await ui.jev(page).getByRole("button", { name: "Jev に予想させる" }).click();

    await expect(ui.jev(page).getByRole("alert")).toContainText("E2E では Jev を呼ばない");
    expect(jevCalls).toHaveLength(1);
  });
});
