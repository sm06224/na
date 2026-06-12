import { test } from 'node:test';
import assert from 'node:assert/strict';

import { makePlan, makeShiftType, makeStaff, makePair, OFF, setAssign } from '../js/core/model.js';
import { validatePlan } from '../js/core/validate.js';

/* 小さな世界を組み立てるヘルパ */
function world() {
  const early = makeShiftType({
    id: 'early', name: '早番', short: '早', start: '07:00', end: '16:00',
    required: [0, 0, 0, 0, 0, 0, 0],   // 既定は誰も要らない（テストごとに設定）
  });
  const day = makeShiftType({
    id: 'day', name: '日勤', short: '日', start: '09:00', end: '18:00',
    required: [0, 0, 0, 0, 0, 0, 0],
  });
  const night = makeShiftType({
    id: 'night', name: '夜勤', short: '夜', start: '16:00', end: '09:00', breakMin: 120,
    required: [0, 0, 0, 0, 0, 0, 0],
  });
  const a = makeStaff({ id: 'a', name: '阿部' });
  const b = makeStaff({ id: 'b', name: '別所' });
  const plan = makePlan({
    year: 2026, month: 6,
    shiftTypes: [early, day, night],
    staff: [a, b],
  });
  return { plan, early, day, night, a, b };
}

const hardOf = (res, rule) =>
  res.violations.filter(v => v.level === 'hard' && v.rule === rule);

test('夜勤明けの早番は勤務間インターバル違反として検出される', () => {
  const { plan } = world();
  setAssign(plan, 'a', 10, 'night');
  setAssign(plan, 'a', 11, 'early');
  const res = validatePlan(plan);
  assert.ok(hardOf(res, 'rest').length >= 1, 'rest 違反がある');
  assert.match(hardOf(res, 'rest')[0].msg, /夜勤/);
});

test('日勤→翌日日勤は 15h 空くので違反にならない', () => {
  const { plan } = world();
  setAssign(plan, 'a', 10, 'day');
  setAssign(plan, 'a', 11, 'day');
  const res = validatePlan(plan);
  assert.equal(hardOf(res, 'rest').length, 0);
});

test('連勤上限（既定 5）を超えると 1 日ごとに違反が積まれる', () => {
  const { plan } = world();
  for (let d = 1; d <= 7; d++) setAssign(plan, 'a', d, 'day');
  const res = validatePlan(plan);
  assert.equal(hardOf(res, 'consecutive').length, 2);   // 6 連勤目と 7 連勤目
});

test('スタッフ個別の連勤上限が全体設定より優先される', () => {
  const { plan } = world();
  plan.staff[0].maxConsecutive = 3;
  for (let d = 1; d <= 4; d++) setAssign(plan, 'a', d, 'day');
  const res = validatePlan(plan);
  assert.equal(hardOf(res, 'consecutive').length, 1);
});

test('夜勤は 2 連続まで。3 連続で違反', () => {
  const { plan } = world();
  // 夜勤→夜勤は 16:00 開始で前日 9:00 明けなので休息 7h → rest 違反にもなる。
  // ここでは night-streak だけを見る。
  for (const d of [1, 2, 3]) setAssign(plan, 'a', d, 'night');
  const res = validatePlan(plan);
  assert.equal(hardOf(res, 'night-streak').length, 1);
});

test('月の夜勤回数上限（既定 8）を超えると違反', () => {
  const { plan } = world();
  // 夜・休・夜・休… と置いて 9 回
  let d = 1;
  for (let i = 0; i < 9; i++) { setAssign(plan, 'a', d, 'night'); d += 3; }
  const res = validatePlan(plan);
  assert.equal(hardOf(res, 'night-monthly').length, 1);
});

test('休み希望の日に勤務を入れると hard 違反', () => {
  const { plan } = world();
  plan.staff[0].requests = { 12: 'off' };
  setAssign(plan, 'a', 12, 'day');
  const res = validatePlan(plan);
  assert.equal(hardOf(res, 'request-off').length, 1);
});

test('担当外シフトに入れると hard 違反', () => {
  const { plan } = world();
  plan.staff[0].canWork = ['day'];
  setAssign(plan, 'a', 5, 'night');
  const res = validatePlan(plan);
  assert.equal(hardOf(res, 'skill').length, 1);
});

test('週の出勤上限（パート）を超えると違反', () => {
  const { plan } = world();
  plan.staff[0].maxPerWeek = 3;
  // 2026年6月 第0週 = 1(月)〜7(日)
  for (const d of [1, 2, 3, 4]) setAssign(plan, 'a', d, 'day');
  const res = validatePlan(plan);
  assert.equal(hardOf(res, 'weekly').length, 1);
});

test('必要人数の不足と過剰が数えられる', () => {
  const { plan } = world();
  plan.shiftTypes[1].required = [1, 1, 1, 1, 1, 1, 1];   // 日勤は毎日 1 人
  setAssign(plan, 'a', 1, 'day');
  setAssign(plan, 'b', 1, 'day');   // 1 日は 2 人 → 1 過剰
  // 2 日は 0 人 → 1 不足
  const res = validatePlan(plan);
  const shorts = res.violations.filter(v => v.rule === 'coverage-short');
  const excess = res.violations.filter(v => v.rule === 'coverage-excess');
  assert.ok(shorts.some(v => v.day === 2));
  assert.ok(excess.some(v => v.day === 1));
});

test('離すペア（hard）が同じシフトに入ると違反', () => {
  const { plan } = world();
  plan.pairs.push(makePair({ type: 'apart', a: 'a', b: 'b', hard: true }));
  setAssign(plan, 'a', 8, 'day');
  setAssign(plan, 'b', 8, 'day');
  const res = validatePlan(plan);
  assert.ok(res.violations.some(v => v.rule === 'pair-apart' && v.level === 'hard'));
});

test('組ませたいペアが別シフトだと soft 減点', () => {
  const { plan } = world();
  plan.pairs.push(makePair({ type: 'together', a: 'a', b: 'b' }));
  setAssign(plan, 'a', 8, 'day');
  setAssign(plan, 'b', 8, 'early');
  const res = validatePlan(plan);
  assert.ok(res.violations.some(v => v.rule === 'pair-together' && v.level === 'soft'));
});

test('違反ゼロの整った表は total が小さい', () => {
  const { plan } = world();
  // 必要人数ゼロ・勤務なし → 罰はほぼゼロ（出勤目標のずれのみあり得る）
  const res = validatePlan(plan);
  assert.equal(res.hardCount, 0);
  assert.equal(res.shortCount, 0);
});
