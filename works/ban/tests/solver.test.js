import { test } from 'node:test';
import assert from 'node:assert/strict';

import { demoPlan } from '../js/core/demo.js';
import { solve } from '../js/core/solver.js';
import { validatePlan } from '../js/core/validate.js';
import { OFF, getAssign, setAssign, setLock, requestOf, planDays } from '../js/core/model.js';

/* デモ（介護施設 12 人・4 シフト・30 日）は現実的な規模のベンチ */
const PLAN = () => demoPlan(2026, 6);

test('ソルバは hard 違反ゼロの表を作る（デモ 1 か月）', () => {
  const plan = PLAN();
  const r = solve(plan, { seed: 11, iterations: 30000 });
  const res = validatePlan(plan);
  assert.equal(res.hardCount, 0,
    `hard 違反が残った: ${res.violations.filter(v => v.level === 'hard').map(v => v.msg).join(' / ')}`);
  assert.ok(r.improved);
});

test('必要人数がほぼ満たされる（不足は僅少）', () => {
  const plan = PLAN();
  solve(plan, { seed: 11, iterations: 30000 });
  const res = validatePlan(plan);
  assert.ok(res.shortCount <= 2, `不足が多すぎる: ${res.shortCount}`);
});

test('休み希望は 1 件も破られない', () => {
  const plan = PLAN();
  solve(plan, { seed: 7, iterations: 20000 });
  for (const sf of plan.staff) {
    for (let d = 1; d <= planDays(plan); d++) {
      const req = requestOf(sf, d);
      if (req && req.kind === 'off') {
        const v = getAssign(plan, sf.id, d);
        assert.ok(v === OFF || v === '', `${sf.name} の ${d}日（休み希望）に ${v}`);
      }
    }
  }
});

test('ロックしたセルは絶対に動かさない', () => {
  const plan = PLAN();
  // 佐藤の 20 日を夜勤で固定、田中の 21 日を休みで固定
  setAssign(plan, 'sf-01', 20, 'st-night');
  setLock(plan, 'sf-01', 20, true);
  setAssign(plan, 'sf-04', 21, OFF);
  setLock(plan, 'sf-04', 21, true);
  solve(plan, { seed: 3, iterations: 15000 });
  assert.equal(getAssign(plan, 'sf-01', 20), 'st-night');
  assert.equal(getAssign(plan, 'sf-04', 21), OFF);
});

test('担当外シフトには決して入れない（夜勤不可の人に夜勤なし）', () => {
  const plan = PLAN();
  solve(plan, { seed: 5, iterations: 20000 });
  for (const sf of plan.staff) {
    if (sf.canWork.length === 0) continue;
    for (let d = 1; d <= planDays(plan); d++) {
      const v = getAssign(plan, sf.id, d);
      if (v !== OFF && v !== '') {
        assert.ok(sf.canWork.includes(v), `${sf.name} が担当外 ${v} に入っている`);
      }
    }
  }
});

test('同じ種から同じ案が生まれる（決定性 = 再現できる）', () => {
  const a = PLAN(), b = PLAN();
  solve(a, { seed: 42, iterations: 12000 });
  solve(b, { seed: 42, iterations: 12000 });
  assert.deepEqual(a.assign, b.assign);
});

test('違う種は違う案（「もう一案」ボタンの根拠）', () => {
  const a = PLAN(), b = PLAN();
  solve(a, { seed: 1, iterations: 12000 });
  solve(b, { seed: 2, iterations: 12000 });
  assert.notDeepEqual(a.assign, b.assign);
});

test('週上限つきパートの上限が守られる', () => {
  const plan = PLAN();
  solve(plan, { seed: 9, iterations: 30000 });
  const res = validatePlan(plan);
  const weekly = res.violations.filter(v => v.rule === 'weekly');
  assert.equal(weekly.length, 0);
});

test('現実的な時間で終わる（30k 手 < 5 秒）', () => {
  const plan = PLAN();
  const r = solve(plan, { seed: 1, iterations: 30000 });
  assert.ok(r.elapsedMs < 5000, `${r.elapsedMs}ms かかった`);
});
