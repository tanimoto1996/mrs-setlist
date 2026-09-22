export interface ScoreBreakdown {
  /** 曲が入っていた数 */
  hits: number;
  /** 実セトリの曲数 */
  total: number;
  /** 曲一致かつ順番も ±2 以内 */
  positionHits: number;
  /** 1曲目の的中 */
  openerHit: boolean;
  /** ラスト曲の的中 */
  closerHit: boolean;
  points: number;
}

const POINTS = { hit: 10, position: 5, opener: 15, closer: 15 } as const;

export function scoreSetlist(predicted: string[], actual: string[]): ScoreBreakdown {
  const actualIndex = new Map(actual.map((id, i) => [id, i]));
  let hits = 0;
  let positionHits = 0;

  predicted.forEach((id, i) => {
    const j = actualIndex.get(id);
    if (j === undefined) return;
    hits += 1;
    if (Math.abs(i - j) <= 2) positionHits += 1;
  });

  const openerHit = actual.length > 0 && predicted[0] === actual[0];
  const closerHit = actual.length > 0 && predicted.at(-1) === actual.at(-1);

  const points =
    hits * POINTS.hit +
    positionHits * POINTS.position +
    (openerHit ? POINTS.opener : 0) +
    (closerHit ? POINTS.closer : 0);

  return { hits, total: actual.length, positionHits, openerHit, closerHit, points };
}
