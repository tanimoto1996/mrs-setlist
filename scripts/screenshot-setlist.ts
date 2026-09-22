/**
 * 保存済みの予想 JSON（PredictionResult）を画面に流し込み、予想カードのスクリーンショットを撮る。
 *
 *   node --no-warnings scripts/screenshot-setlist.ts --in predictions/2026-09-23-jev.json \
 *        [--engine jev|gemini] [--out predictions/2026-09-23-jev.png] [--full]
 *
 * - 事前に `npm run dev` が http://localhost:3000 で動いていること（BASE_URL で変更可）。
 * - Jev / Gemini は呼ばない。JSON を localStorage に流し込んで描画するだけなので無料。
 * - ブラウザはシステムの Chrome（playwright.config.ts と同じ理由: macOS 12 に同梱 Chromium が入らない）。
 *   E2E_CHANNEL=chromium で同梱版に切り替えられる。
 * - --full を付けるとページ全体、付けなければ予想カード（Jev's Call / Gemini's Call）だけを撮る。
 * - 画面の JSON は「JSON を保存」ボタン（app/page.tsx）か /predict スキルで手に入る。
 */
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, extname } from "node:path";
import type { PredictionResult } from "../lib/jev.ts";

/** app/page.tsx の STORAGE_KEY と同じ */
const STORAGE_KEY = "mga-setlist-oracle:v1";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const flag = (name: string) => args.includes(`--${name}`);

const input = opt("in");
if (!input || !existsSync(input)) {
  console.error("使い方: node --no-warnings scripts/screenshot-setlist.ts --in <予想 JSON> [--engine jev|gemini] [--out <png>] [--full]");
  process.exit(1);
}
const engine = opt("engine") ?? "jev";
if (engine !== "jev" && engine !== "gemini") {
  console.error("--engine は jev か gemini");
  process.exit(1);
}
const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = opt("out") ?? `${dirname(input)}/${basename(input, extname(input))}.png`;
const full = flag("full");

const data = JSON.parse(readFileSync(input, "utf8")) as PredictionResult;
if (!Array.isArray(data.setlist) || !Array.isArray(data.predictions)) {
  console.error(`${input} は PredictionResult（setlist / predictions を持つ JSON）ではない`);
  process.exit(1);
}

// app/page.tsx の Saved と同じ形。指定したエンジンの枠だけ埋める
const saved = { mine: [], actual: [], rumors: "", jev: null, gemini: null, [engine]: data };

const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL ?? "chrome", headless: true });
try {
  // lg（64rem）未満の幅にして 1 カラムにする。右カラムが sticky + overflow になる幅だとカードが切れる
  const page = await browser.newPage({
    viewport: { width: 900, height: 1200 },
    deviceScaleFactor: 2,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    reducedMotion: "reduce",
  });
  // 万一ボタンが押されても本物の API（有料）には届かせない
  await page.route("**/api/predict", (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "screenshot では呼ばない" }) }),
  );
  await page.addInitScript(([key, json]) => localStorage.setItem(key, json), [STORAGE_KEY, JSON.stringify(saved)] as const);

  await page.goto(base, { waitUntil: "domcontentloaded" });
  // 1 カラム幅ではスマホ用の下部バー（.dock）と Next.js dev のインジケータ（nextjs-portal）が固定表示でカードに重なるので、撮影中だけ隠す
  await page.addStyleTag({ content: ".dock, nextjs-portal { display: none !important; }" });
  await page.locator('main[aria-busy="false"]').waitFor();
  const section = page.locator(`section[aria-labelledby="${engine}-heading"]`);
  await section.locator("li.track").first().waitFor();
  await page.evaluate(() => document.fonts.ready);

  mkdirSync(dirname(out), { recursive: true });
  if (full) await page.screenshot({ path: out, fullPage: true });
  else await section.screenshot({ path: out });

  console.log(`saved: ${out}  (${engine}, ${data.setlist.length} 曲, model=${data.model})`);
} finally {
  await browser.close();
}
