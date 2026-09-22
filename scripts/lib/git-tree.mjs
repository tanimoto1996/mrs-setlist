// git の tree hash まわりの共通処理。
// 「E2E を通した作業ツリー」と「push しようとしている HEAD」が同じ中身かを照合するために使う。
// 実体は .claude/hooks/*.mjs と scripts/e2e-gate.mjs から呼ばれる。
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function git(args, opts = {}) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }).trim();
}

export function repoRoot() {
  return git(["rev-parse", "--show-toplevel"]);
}

/** 作業ツリー全体（未追跡ファイルを含む、.gitignore 対象は除く）の tree hash。本物の index には触らない */
export function workingTreeHash() {
  const root = repoRoot();
  const realIndex = join(git(["rev-parse", "--absolute-git-dir"], { cwd: root }), "index");
  const dir = mkdtempSync(join(tmpdir(), "mrs-tree-"));
  const index = join(dir, "index");
  try {
    if (existsSync(realIndex)) copyFileSync(realIndex, index);
    const env = { ...process.env, GIT_INDEX_FILE: index };
    git(["add", "-A"], { cwd: root, env });
    return git(["write-tree"], { cwd: root, env });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** HEAD の tree hash */
export function headTreeHash() {
  return git(["rev-parse", "HEAD^{tree}"]);
}

/** 未コミットの変更（追跡・未追跡）の行数 */
export function dirtyCount() {
  const out = git(["status", "--porcelain"]);
  return out ? out.split("\n").length : 0;
}

/** upstream より先にあるコミット数。upstream が無ければ 0 */
export function aheadCount() {
  try {
    return Number(git(["rev-list", "--count", "@{u}..HEAD"])) || 0;
  } catch {
    return 0;
  }
}

/* ---------- .claude/tmp/ の印（gitignore 済み） ---------- */

export function markerDir() {
  return join(repoRoot(), ".claude", "tmp");
}

export function markerPath(name) {
  return join(markerDir(), name);
}

export function readMarker(name) {
  try {
    return readFileSync(markerPath(name), "utf8").trim();
  } catch {
    return null;
  }
}

export function writeMarker(name, value) {
  mkdirSync(markerDir(), { recursive: true });
  writeFileSync(markerPath(name), `${value}\n`);
}

export function removeMarker(name) {
  rmSync(markerPath(name), { force: true });
}

/** E2E が通った作業ツリーの tree hash を入れる印 */
export const E2E_OK = "e2e-ok";
