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
