import { expect, test, ui } from "./fixtures";

test.describe("起動", () => {
  test("ページが開き、公演の前提と全曲ライブラリが出る", async ({ page, jevCalls }) => {
    await ui.open(page);

    await expect(page).toHaveTitle(/SHADOWS セトリ予想/);
    await expect(page.getByRole("heading", { level: 1, name: "SHADOWS" })).toBeVisible();
    await expect(page.getByText("あなぶきアリーナ香川", { exact: false })).toBeVisible();
    await expect(page.getByText("09.30")).toBeVisible();

    // 「全曲 N」の N と、実際に並んだチップの数が一致する
    const library = ui.library(page);
    const countText = await library.getByText(/^全曲/).innerText();
    const total = Number(countText.replace(/\D/g, ""));
    expect(total).toBeGreaterThan(50);
    await expect(library.locator("button.chip")).toHaveCount(total);

    // 初期状態: 俺の予想は空、Jev と Gemini は未実行、答え合わせは案内だけ
    await expect(ui.mine(page).getByText("Library で曲を押すと")).toBeVisible();
    await expect(ui.jev(page).getByRole("button", { name: "Jev に予想させる" })).toBeEnabled();
    await expect(ui.gemini(page).getByRole("button", { name: "Gemini に予想させる" })).toBeEnabled();
    await expect(ui.result(page).getByRole("button", { name: "実セトリを入力する" })).toBeVisible();

    // 開いただけでは有料の Jev を呼ばない
    expect(jevCalls).toHaveLength(0);
  });

  test("New Album Odds に過去 5 枚の実績と POPS が何曲入るかの目安が出る", async ({ page }) => {
    await ui.open(page);
    const odds = ui.odds(page);

    await expect(odds.getByRole("heading", { level: 2, name: "New Album Odds" })).toBeVisible();
    // 目安: 「POPS から約 L〜H 曲 / 24 曲」。L / H は lib/album-debut-stats.json の直近比率・平均比率 × 24
    await expect(odds.getByText(/POPS から約 \d+(〜\d+)? 曲 \/ 24 曲/)).toBeVisible();
    // 実績の行: setlist.fm 由来の ANTENNA と、手入力（出典リンク付き）の TWELVE の両方が初日の曲数と % を出す
    const antenna = odds.getByRole("listitem").filter({ hasText: "ANTENNA" });
    await expect(antenna).toContainText(/初日 \d+\/\d+ 曲 · \d+%/);
    const twelve = odds.getByRole("listitem").filter({ hasText: "TWELVE" });
    await expect(twelve).toContainText(/初日 \d+\/\d+ 曲 · \d+%/);
    await expect(twelve.getByRole("link", { name: "TWELVE 初日セトリの出典" })).toHaveAttribute("href", /livefans|ameblo|fanplus/);
  });

  test("スマホ幅では下部バーから俺の予想へ飛べる", async ({ page, isMobile }) => {
    test.skip(!isMobile, "スマホ幅のプロジェクトだけ");
    await ui.open(page);

    const dock = page.getByRole("link", { name: "俺の予想へ移動" });
    await expect(dock).toBeVisible();
    await expect(dock).toContainText("00");

    await ui.chip(page, "Soranji").click();
    await expect(dock).toContainText("01");

    await dock.click();
    await expect(page).toHaveURL(/#mine-heading$/);
  });

  test("デスクトップ幅では下部バーを出さない", async ({ page, isMobile }) => {
    test.skip(isMobile, "デスクトップ幅のプロジェクトだけ");
    await ui.open(page);
    await expect(page.getByRole("link", { name: "俺の予想へ移動" })).toBeHidden();
  });

  test("GET /api/predict は受け付けない（POST のみ）", async ({ request }) => {
    const res = await request.get("/api/predict");
    expect(res.status()).toBe(405);
  });
});
