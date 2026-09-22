// Stop:
// このセッションで変更したものが未コミット / 未 push のまま終わろうとしたら、一度だけ止めて /ship を促す。
// stop_hook_active（この hook が原因で続行中）のときは素通しするので、無限に止まることはない。
// 自分が触っていない（ユーザー側の）変更だけなら止めない。
import { aheadCount, dirtyCount, readMarker, removeMarker } from "../../scripts/lib/git-tree.mjs";
import { readHookInput, sessionMarker } from "./_lib.mjs";

const input = await readHookInput();

try {
  if (input.stop_hook_active) process.exit(0);

  const marker = sessionMarker(input);
  if (readMarker(marker) === null) process.exit(0);

  const dirty = dirtyCount();
  const ahead = aheadCount();
  if (dirty === 0 && ahead === 0) {
    removeMarker(marker);
    process.exit(0);
  }

  const reason =
    `このセッションで変更したファイルがまだ push されていない（未コミット ${dirty} 件 / 未 push コミット ${ahead} 件）。` +
    " /ship の手順で締めること: ①docs/worklog/ に作業記録を書き、関係するドキュメントを更新 → ②npm run typecheck → " +
    "③npm run test:e2e（引数なし・フル）→ ④git commit → ⑤git push。" +
    " E2E が落ちたら直して再実行。どうしても通らなければ push せず、落ちたテスト名と原因を報告して終了。" +
    " ユーザーが明示的に「push しない」と言っている場合は、その旨を書いて終了してよい。";

  process.stdout.write(JSON.stringify({ decision: "block", reason }));
} catch (e) {
  console.error(`[stop hook] ${e instanceof Error ? e.message : e}`);
}
