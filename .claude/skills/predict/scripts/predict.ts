/**
 * ローカルの dev サーバー経由で Jev（または Gemini）に予想させ、結果 JSON を保存する。
 *
 *   node .claude/skills/predict/scripts/predict.ts [--engine jev|gemini] [--rumors "..."] [--size 24] [--out path.json]
 *
 * 事前に `npm run dev` が http://localhost:3000 で動いていること。
 * Jev を 1 回呼ぶごとに全曲（約 6 バッチ並列）ぶんのトークンを消費する。Gemini は全曲 1 リクエスト。
 * 保存した JSON は `npm run screenshot:setlist -- --in <path>` で画像にできる。
 */
import { writeFileSync } from "node:fs";
import { SONG_MAP } from "../../../../lib/songs.ts";
import type { PredictionResult } from "../../../../lib/jev.ts";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const base = process.env.BASE_URL ?? "http://localhost:3000";
const engine = opt("engine") ?? "jev";
if (engine !== "jev" && engine !== "gemini") {
  console.error("--engine は jev か gemini");
  process.exit(1);
}
const rumors = opt("rumors") ?? "";
const size = Number(opt("size") ?? 24);
const today = new Date().toISOString().slice(0, 10);
const out = opt("out") ?? `predictions/${today}${engine === "jev" ? "" : `-${engine}`}.json`;

let res: Response;
try {
  res = await fetch(`${base}/api/predict`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rumors, setlistSize: size, engine }),
  });
} catch {
  console.error(`${base} に接続できません。別ターミナルで \`npm run dev\` を起動してください。`);
  process.exit(1);
}
const data = (await res.json()) as PredictionResult | { error: string };
if (!res.ok || "error" in data) {
  console.error("予想に失敗:", "error" in data ? data.error : res.status);
  process.exit(1);
}

writeFileSync(out, JSON.stringify(data, null, 2));

const title = (id: string) => SONG_MAP.get(id)?.title ?? id;
console.log(`engine: ${engine}`);
console.log(`model: ${data.model}`);
console.log(`usage: in=${data.usage.input_tokens} out=${data.usage.output_tokens}`);
console.log(`saved: ${out}\n`);
console.log("--- 予想セトリ ---");
data.setlist.forEach((id, i) => {
  const p = data.predictions.find((x) => x.songId === id);
  console.log(
    `${String(i + 1).padStart(2)}. ${title(id)}  (${p?.slot ?? "?"}, p=${p?.likelihood.toFixed(2) ?? "?"})`,
  );
});
