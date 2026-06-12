import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  makePlan, makeShiftType, makeStaff, OFF, setAssign, getAssign,
  extractTail, planDays,
} from '../js/core/model.js';
import { validatePlan } from '../js/core/validate.js';
import { solve } from '../js/core/solver.js';
import { demoPlan } from '../js/core/demo.js';

/* ============================================================
   端のケース — 実務で実際に踏む地雷を先に踏んでおく。
   ============================================================ */

const day = () => makeShiftType({
  id: 'day', name: '日勤', short: '日', start: '09:00', end: '18:00',
  required: [0, 0, 0, 0, 0, 0, 0],
});
const night = () => makeShiftType({
  id: 'night', name: '夜勤', short: '夜', start: '16:00', end: '09:00',
  required: [0, 0, 0, 0, 0, 0, 0],
});

/* ---------- 月またぎの引き継ぎ ---------- */
test('前月末 5 連勤の引き継ぎ → 月初 1 日目の勤務で 6 連勤違反', () => {
  const plan = makePlan({
    year: 2026, month: 7, shiftTypes: [day()],
    staff: [makeStaff({ id: 'a', name: '阿部' })],
    prevTail: { a: ['day', 'day', 'day', 'day', 'day'] },
  });
  setAssign(plan, 'a', 1, 'day');
  const res = validatePlan(plan);
  assert.ok(res.violations.some(v => v.rule === 'consecutive' && v.day === 1),
    '月初の連勤違反が検出される');
});

test('前月末が夜勤 → 月初 1 日目の日勤はインターバル違反', () => {
  const plan = makePlan({
    year: 2026, month: 7, shiftTypes: [day(), night()],
    staff: [makeStaff({ id: 'a', name: '阿部' })],
    prevTail: { a: [OFF, OFF, OFF, OFF, OFF, OFF, 'night'] },
  });
  setAssign(plan, 'a', 1, 'day');
  const res = validatePlan(plan);
  // 夜勤明け 9:00 → 当日 9:00 開始 = 休息 0h
  assert.ok(res.violations.some(v => v.rule === 'rest' && v.day === 1));
});

test('前月末が休みなら月初はまっさら（違反なし）', () => {
  const plan = makePlan({
    year: 2026, month: 7, shiftTypes: [day()],
    staff: [makeStaff({ id: 'a', name: '阿部' })],
    prevTail: { a: [OFF, OFF, OFF, OFF, OFF] },
  });
  setAssign(plan, 'a', 1, 'day');
  const res = validatePlan(plan);
  assert.equal(res.hardCount, 0);
});

test('extractTail は月末 7 日ぶんを日付順で取り出す', () => {
  const plan = makePlan({
    year: 2026, month: 6, shiftTypes: [day()],
    staff: [makeStaff({ id: 'a', name: '阿部' })],
  });
  setAssign(plan, 'a', 30, 'day');
  setAssign(plan, 'a', 29, OFF);
  const tail = extractTail(plan);
  assert.equal(tail.a.length, 7);             // 24..30 日
  assert.equal(tail.a[6], 'day');             // 30 日
  assert.equal(tail.a[5], OFF);               // 29 日
});

test('ソルバは引き継ぎを尊重する（前月末夜勤の人の 1 日目に早番を入れない）', () => {
  const plan = demoPlan(2026, 7);
  // 佐藤は前月末日が夜勤明け
  plan.prevTail = { 'sf-01': [OFF, OFF, OFF, OFF, OFF, 'st-night', 'st-night'] };
  solve(plan, { seed: 4, iterations: 25000 });
  const res = validatePlan(plan);
  assert.equal(res.hardCount, 0, '引き継ぎ込みで hard ゼロ');
});

/* ---------- 物理的に不可能な要求 ---------- */
test('人手が絶対に足りない月でも、ソルバは法令違反でなく人数不足で返す', () => {
  // 1 人しかいないのに毎日 3 人必要
  const st = day(); st.required = [3, 3, 3, 3, 3, 3, 3];
  const plan = makePlan({
    year: 2026, month: 6, shiftTypes: [st],
    staff: [makeStaff({ id: 'a', name: '阿部' })],
  });
  solve(plan, { seed: 1, iterations: 8000 });
  const res = validatePlan(plan);
  assert.equal(res.hardCount, 0, '法令系 hard は守られる');
  assert.ok(res.shortCount > 20, '不足が正直に報告される');
});

test('全員が夜勤不可なら、夜勤枠は不足のまま（無理に入れない）', () => {
  const d = day(), n = night();
  n.required = [1, 1, 1, 1, 1, 1, 1];
  const plan = makePlan({
    year: 2026, month: 6, shiftTypes: [d, n],
    staff: [
      makeStaff({ id: 'a', name: '阿部', canWork: ['day'] }),
      makeStaff({ id: 'b', name: '別所', canWork: ['day'] }),
    ],
  });
  solve(plan, { seed: 1, iterations: 8000 });
  for (const sid of ['a', 'b']) {
    for (let dd = 1; dd <= 30; dd++) {
      assert.notEqual(getAssign(plan, sid, dd), 'night');
    }
  }
});

/* ---------- 暦の端 ---------- */
test('2 月（28 日）と大の月（31 日）でも壊れない', () => {
  for (const [y, m, expected] of [[2026, 2, 28], [2024, 2, 29], [2026, 7, 31]]) {
    const plan = demoPlan(y, m);
    assert.equal(planDays(plan), expected);
    solve(plan, { seed: 1, iterations: 6000 });
    const res = validatePlan(plan);
    assert.equal(res.hardCount, 0, `${y}-${m} で hard 違反`);
  }
});

/* ---------- 希望の塊 ---------- */
test('全員が同じ日に休み希望でも、希望は破られない（不足になるだけ）', () => {
  const plan = demoPlan(2026, 6);
  for (const sf of plan.staff) sf.requests = { 15: 'off' };
  solve(plan, { seed: 2, iterations: 15000 });
  for (const sf of plan.staff) {
    const v = getAssign(plan, sf.id, 15);
    assert.ok(v === OFF || v === '', `${sf.name} の 15 日が ${v}`);
  }
  const res = validatePlan(plan);
  assert.equal(res.violations.filter(v => v.rule === 'request-off').length, 0);
});

/* ---------- 規模 ---------- */
test('30 人 × 31 日でも実用時間で解ける', () => {
  const sts = [
    makeShiftType({ id: 'e', name: '早番', short: '早', start: '07:00', end: '16:00', required: [4, 4, 4, 4, 4, 4, 4] }),
    makeShiftType({ id: 'd', name: '日勤', short: '日', start: '09:00', end: '18:00', required: [6, 6, 6, 6, 6, 6, 6] }),
    makeShiftType({ id: 'n', name: '夜勤', short: '夜', start: '16:00', end: '09:00', required: [3, 3, 3, 3, 3, 3, 3] }),
  ];
  const staff = [];
  for (let i = 0; i < 30; i++) {
    staff.push(makeStaff({ id: `s${i}`, name: `職員${i + 1}` }));
  }
  const plan = makePlan({ year: 2026, month: 7, shiftTypes: sts, staff });
  const r = solve(plan, { seed: 3, iterations: 30000 });
  const res = validatePlan(plan);
  assert.equal(res.hardCount, 0);
  assert.ok(r.elapsedMs < 15000, `${r.elapsedMs}ms`);
});
