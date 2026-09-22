import { expect, SETLIST_SIZE, SONG, test, ui } from "./fixtures";

test.describe("俺の予想を組む", () => {
  test("曲を押すと演奏順に積まれ、カウンタとバーが追随する", async ({ page }) => {
    await ui.open(page);
    const mine = ui.mine(page);
    const counter = page.getByLabel(new RegExp(`^俺の予想 \\d+ / ${SETLIST_SIZE} 曲$`));
    const bar = page.getByRole("progressbar", { name: "選んだ曲数" });

    await expect(counter).toHaveText("00");
    await expect(bar).toHaveAttribute("aria-valuenow", "0");

    await ui.chip(page, SONG.soranji.title).click();
    await ui.chip(page, SONG.aoToNatsu.title).click();
    await ui.chip(page, SONG.queSeraSera.title).click();

    await ui.expectTracks(mine, [SONG.soranji.title, SONG.aoToNatsu.title, SONG.queSeraSera.title]);
    await expect(counter).toHaveText("03");
    await expect(bar).toHaveAttribute("aria-valuenow", "3");

    // 選んだチップには順番の丸が付き、押した状態になる
    const chip = ui.chip(page, SONG.aoToNatsu.title);
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(chip.locator(".chip-num")).toHaveText("2");

    // もう一度押すと外れる
    await chip.click();
    await ui.expectTracks(mine, [SONG.soranji.title, SONG.queSeraSera.title]);
    await expect(chip).toHaveAttribute("aria-pressed", "false");
  });

  test("上下ボタンで並べ替え、× で外せる", async ({ page, seed }) => {
    await seed({ mine: [SONG.soranji.id, SONG.aoToNatsu.id, SONG.queSeraSera.id] });
    await ui.open(page);
    const mine = ui.mine(page);

    // 先頭は上へ動かせない
    await expect(page.getByRole("button", { name: `${SONG.soranji.title} を上へ` })).toBeDisabled();

    await page.getByRole("button", { name: `${SONG.soranji.title} を下へ` }).click();
    await ui.expectTracks(mine, [SONG.aoToNatsu.title, SONG.soranji.title, SONG.queSeraSera.title]);

    await page.getByRole("button", { name: `${SONG.queSeraSera.title} を上へ` }).click();
    await ui.expectTracks(mine, [SONG.aoToNatsu.title, SONG.queSeraSera.title, SONG.soranji.title]);

    await page.getByRole("button", { name: `${SONG.queSeraSera.title} を外す` }).click();
    await ui.expectTracks(mine, [SONG.aoToNatsu.title, SONG.soranji.title]);
    await expect(ui.chip(page, SONG.queSeraSera.title)).toHaveAttribute("aria-pressed", "false");
  });

  test("リロードしても予想が残る（localStorage）", async ({ page }) => {
    await ui.open(page);
    await ui.chip(page, SONG.inferno.title).click();
    await ui.chip(page, SONG.lilac.title).click();

    await ui.reload(page);

    await ui.expectTracks(ui.mine(page), [SONG.inferno.title, SONG.lilac.title]);
    await expect(ui.chip(page, SONG.lilac.title).locator(".chip-num")).toHaveText("2");
  });

  test("曲名検索とクイックフィルタで絞れる", async ({ page }) => {
    await ui.open(page);
    const library = ui.library(page);
    const chips = library.locator("button.chip");
    const total = await chips.count();

    // 検索（大文字小文字を無視）
    await ui.search(page).fill("soranji");
    await expect(chips).toHaveCount(1);
    await expect(ui.chip(page, SONG.soranji.title)).toBeVisible();
    await expect(library.getByText(`1 / ${total}`)).toBeVisible();

    await ui.search(page).fill("この曲は存在しない");
    await expect(library.getByText("該当する曲が無い")).toBeVisible();

    await ui.search(page).fill("");
    await expect(chips).toHaveCount(total);

    // POPS 新曲: 表示されるチップは全部 NEW 付き
    await ui.quick(page, "POPS 新曲").click();
    await expect(ui.quick(page, "POPS 新曲")).toHaveAttribute("aria-pressed", "true");
    const popsCount = await chips.count();
    expect(popsCount).toBeGreaterThan(0);
    expect(popsCount).toBeLessThan(total);
    await expect(library.locator("button.chip .tag-new")).toHaveCount(popsCount);

    // 絞り込み中でも選べて、「すべて」に戻しても選択は残る
    await ui.chip(page, SONG.brandNew.title).click();
    await ui.quick(page, "すべて").click();
    await expect(chips).toHaveCount(total);
    await expect(ui.chip(page, SONG.brandNew.title)).toHaveAttribute("aria-pressed", "true");
  });

  test(`${SETLIST_SIZE} 曲そろうと、それ以上は押せない`, async ({ page }) => {
    await ui.open(page);
    const chips = ui.library(page).locator("button.chip");

    for (let i = 0; i < SETLIST_SIZE; i++) await chips.nth(i).click();

    await expect(page.getByRole("status")).toContainText(`${SETLIST_SIZE} 曲そろった`);
    await expect(chips.nth(SETLIST_SIZE)).toBeDisabled();
    await expect(page.getByLabel(new RegExp(`^俺の予想 ${SETLIST_SIZE} / ${SETLIST_SIZE} 曲$`))).toHaveText(String(SETLIST_SIZE));

    // 1 曲外せばまた選べる
    await chips.nth(0).click();
    await expect(page.getByRole("status")).toBeHidden();
    await expect(chips.nth(SETLIST_SIZE)).toBeEnabled();
  });
});
