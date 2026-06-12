import { buildCtx, staffPenalty, coveragePenalty, pairPenalty, fairnessPenalty, countsFor } from './rules.js';

/* ============================================================
   検証 — 計画全体を総点検し、違反の一覧と総点を返す。
   ソルバの目的関数と同じものを使うので、画面の表示と
   最適化の方向が食い違わない。
   ============================================================ */

export function validatePlan(plan) {
  const ctx = buildCtx(plan);
  const violations = [];
  let total = 0;

  for (const sf of plan.staff) {
    total += staffPenalty(plan, sf, ctx, violations);
  }
  for (let d = 1; d <= ctx.days; d++) {
    total += coveragePenalty(plan, d, ctx, violations);
    total += pairPenalty(plan, d, ctx, violations);
  }
  const counts = plan.staff.map(sf => countsFor(plan, sf, ctx));
  total += fairnessPenalty(counts, plan.rules, violations);

  /* 重い順 → 日付順 */
  const rank = { hard: 0, short: 1, soft: 2 };
  violations.sort((a, b) =>
    (rank[a.level] - rank[b.level]) || ((a.day ?? 0) - (b.day ?? 0)));

  const hard = violations.filter(v => v.level === 'hard').length;
  const short = violations.filter(v => v.level === 'short')
    .reduce((n, v) => n + Math.round(v.penalty / 3000), 0);

  return { total, violations, hardCount: hard, shortCount: short, ctx, counts };
}

/* セル単位の違反ルックアップ（グリッドの赤枠表示に使う） */
export function violationCells(violations) {
  const cells = new Set();
  for (const v of violations) {
    if (v.level !== 'hard') continue;
    if (v.staffId && v.day) cells.add(`${v.staffId}:${v.day}`);
  }
  return cells;
}
