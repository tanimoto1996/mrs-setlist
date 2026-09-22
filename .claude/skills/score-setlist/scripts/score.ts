/**
 * 予想セトリと実セトリを採点する。
 *
 *   node .claude/skills/score-setlist/scripts/score.ts --actual actual.txt [--predicted prediction.json | --mine mine.txt]
 *
 * actual.txt / mine.txt: 1 行 1 曲。曲 id または曲名（完全一致、大文字小文字は無視）。
 * prediction.json: predict.ts が保存した JSON（setlist フィールドを使う）。
 * 解決できない行があれば候補を出して終了コード 1 で止まる。
 */
import { readFileSync } from "node:fs";
import { scoreSetlist } from "../../../../lib/scoring.ts";
import { SONGS, SONG_MAP } from "../../../../lib/songs.ts";

const args = process.argv.slice(2);
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const byTitle = new Map(SONGS.map((s) => [s.title.toLowerCase(), s.id]));

function resolve(lines: string[], label: string): string[] {
  const ids: string[] = [];
  const unresolved: string[] = [];
  for (const raw of lines) {
    const line = raw.replace(/^\s*\d+[.．)]\s*/, "").trim();
    if (!line) continue;
    if (SONG_MAP.has(line)) ids.push(line);
    else if (byTitle.has(line.toLowerCase())) ids.push(byTitle.get(line.toLowerCase())!);
    else unresolved.push(line);
  }
  if (unresolved.length) {
    console.error(`[${label}] 解決できない曲があります:`);
    for (const u of unresolved) {
      const q = u.toLowerCase();
      const cands = SONGS.filter((s) => s.title.toLowerCase().includes(q) || q.includes(s.title.toLowerCase()))
        .slice(0, 5)
        .map((s) => `${s.title} (${s.id})`);
      console.error(`  - ${u}${cands.length ? `  候補: ${cands.join(", ")}` : ""}`);
    }
    console.error("lib/songs.ts に曲を追加するか、id で指定してください。");
    process.exit(1);
  }
  return ids;
}

const actualPath = opt("actual");
if (!actualPath) {
  console.error("--actual <file> は必須です");
  process.exit(1);
}
const actual = resolve(readFileSync(actualPath, "utf8").split("\n"), "actual");

const entries: [string, string[]][] = [];
const predictedPath = opt("predicted");
if (predictedPath) {
  const json = JSON.parse(readFileSync(predictedPath, "utf8")) as { setlist: string[]; model?: string };
  entries.push([`Jev${json.model ? ` (${json.model})` : ""}`, json.setlist]);
}
const minePath = opt("mine");
if (minePath) entries.push(["俺", resolve(readFileSync(minePath, "utf8").split("\n"), "mine")]);
if (!entries.length) {
  console.error("--predicted か --mine のどちらかを指定してください");
  process.exit(1);
}

const title = (id: string) => SONG_MAP.get(id)?.title ?? id;
console.log(`実セトリ ${actual.length} 曲: ${actual.map(title).join(" / ")}\n`);
for (const [label, predicted] of entries) {
  const r = scoreSetlist(predicted, actual);
  console.log(`== ${label}: ${r.points} 点 ==`);
  console.log(`  曲一致 ${r.hits}/${r.total} (+${r.hits * 10})`);
  console.log(`  順番 ±2 以内 ${r.positionHits} (+${r.positionHits * 5})`);
  console.log(`  1曲目 ${r.openerHit ? "的中 (+15)" : "外れ"} / ラスト ${r.closerHit ? "的中 (+15)" : "外れ"}`);
  const missed = actual.filter((id) => !predicted.includes(id)).map(title);
  if (missed.length) console.log(`  取りこぼし: ${missed.join(" / ")}`);
  console.log();
}
