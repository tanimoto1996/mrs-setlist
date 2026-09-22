import { defineConfig, devices } from "@playwright/test";

/**
 * E2E（Playwright）の設定。
 * - 対象はローカルの `next dev`。起動していなければ webServer が自分で立ち上げる。
 * - `/api/predict`（Jev、有料）は e2e/fixtures.ts が必ずモックする。ここで本物を叩く設定にはしない。
 * - ブラウザはローカルではシステムの Google Chrome（channel: "chrome"）。Playwright 同梱の Chromium は
 *   macOS 12 にダウンロードできないため。CI では同梱 Chromium。E2E_CHANNEL=chromium で切り替え可。
 * - デスクトップ + スマホ幅の 2 プロジェクト。増やすときは docs/e2e.md も更新する。
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;
const CHANNEL = process.env.E2E_CHANNEL ?? (process.env.CI ? "chromium" : "chrome");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  // next dev 相手なので余裕を持たせる（初回コンパイルやリロードが数十秒かかることがある）
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    navigationTimeout: 45_000,
    actionTimeout: 15_000,
    baseURL: BASE_URL,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    // 順送りリビール（.rise）を待たずに済むよう、動きは切って走らせる
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: CHANNEL } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: CHANNEL } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
