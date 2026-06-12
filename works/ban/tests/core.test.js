import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseHM, fmtHM, shiftMinutes, shiftEndAbs, restBetween, daysInMonth, weekIndexOf } from '../js/core/time.js';
import {
  makePlan, makeShiftType, makeStaff, makeRuleConfig,
  OFF, setAssign, getAssign, setLock, isLocked,
  shiftIsNight, requiredOn, requestOf, sanitizePlan,
} from '../js/core/model.js';

/* ---------- 時間 ---------- */
test('parseHM / fmtHM は HH:MM を正しく往復する', () => {
  assert.equal(parseHM('07:00'), 420);
  assert.equal(parseHM('23:59'), 1439);
  assert.equal(parseHM('24:00'), null);
  assert.equal(parseHM('abc'), null);
  assert.equal(fmtHM(420), '07:00');
  assert.equal(fmtHM(0), '00:00');
});

test('日をまたぐシフトの実働と絶対終了時刻', () => {
  // 夜勤 16:00→09:00（休憩 2h）= 実働 15h
  assert.equal(shiftMinutes(960, 540, 120), 15 * 60);
  assert.equal(shiftEndAbs(960, 540), 540 + 1440);
  // 日勤 09:00→18:00（休憩 1h）= 実働 8h
  assert.equal(shiftMinutes(540, 1080, 60), 8 * 60);
});

test('勤務間インターバルの計算（夜勤明け→早番は休息不足になる）', () => {
  // 前日: 夜勤 16:00→翌9:00（絶対終了 1980 分）。翌日 7:00 早番開始。
  const rest = restBetween(1980, 420, 1);
  assert.equal(rest, 420 + 1440 - 1980);   // = -120 分（マイナス＝重なってすらいる）
  assert.ok(rest < 11 * 60);
  // 前日: 日勤 〜18:00（1080）。翌日 9:00 開始 → 休息 15h で OK
  assert.equal(restBetween(1080, 540, 1), 15 * 60);
});

test('月の日数と週番号', () => {
  assert.equal(daysInMonth(2026, 6), 30);
  assert.equal(daysInMonth(2024, 2), 29);  // うるう年
  // 2026年6月1日は月曜 → 1〜7日が第0週
  assert.equal(weekIndexOf(2026, 6, 1), 0);
  assert.equal(weekIndexOf(2026, 6, 7), 0);
  assert.equal(weekIndexOf(2026, 6, 8), 1);
});

/* ---------- モデル ---------- */
test('シフト種別: 夜勤の自動判定と必要人数の上書き', () => {
  const night = makeShiftType({ name: '夜勤', start: '16:00', end: '09:00' });
  const day = makeShiftType({ name: '日勤', start: '09:00', end: '18:00' });
  assert.equal(shiftIsNight(night), true);
  assert.equal(shiftIsNight(day), false);
  const st = makeShiftType({ required: [1, 2, 2, 2, 2, 2, 1], requiredOverride: { 15: 5 } });
  assert.equal(requiredOn(st, 15, 3), 5);     // 上書きが効く
  assert.equal(requiredOn(st, 14, 0), 1);     // 日曜
});

test('割当・ロック・希望の基本操作', () => {
  const st = makeShiftType({ id: 'st1' });
  const sf = makeStaff({ id: 'sf1', requests: { 5: 'off', 6: 'want:st1', 7: 'ng:st1' } });
  const plan = makePlan({ year: 2026, month: 6, shiftTypes: [st], staff: [sf] });

  setAssign(plan, 'sf1', 3, 'st1');
  assert.equal(getAssign(plan, 'sf1', 3), 'st1');
  setAssign(plan, 'sf1', 3, OFF);
  assert.equal(getAssign(plan, 'sf1', 3), OFF);

  setLock(plan, 'sf1', 3, true);
  assert.equal(isLocked(plan, 'sf1', 3), true);
  setLock(plan, 'sf1', 3, false);
  assert.equal(isLocked(plan, 'sf1', 3), false);

  assert.deepEqual(requestOf(sf, 5), { kind: 'off' });
  assert.deepEqual(requestOf(sf, 6), { kind: 'want', shiftId: 'st1' });
  assert.deepEqual(requestOf(sf, 7), { kind: 'ng', shiftId: 'st1' });
  assert.equal(requestOf(sf, 8), null);
});

test('sanitizePlan は孤児の割当・ロック・ペアを掃除する', () => {
  const st = makeShiftType({ id: 'st1' });
  const sf = makeStaff({ id: 'sf1' });
  const plan = makePlan({ year: 2026, month: 6, shiftTypes: [st], staff: [sf] });
  plan.assign['ghost'] = { 1: 'st1' };
  plan.assign['sf1'] = { 1: 'st-deleted', 2: 'st1' };
  plan.locks['ghost:3'] = true;
  plan.pairs.push({ id: 'p1', type: 'apart', a: 'sf1', b: 'ghost', hard: true });
  sanitizePlan(plan);
  assert.equal(plan.assign['ghost'], undefined);
  assert.equal(plan.assign['sf1'][1], undefined);
  assert.equal(plan.assign['sf1'][2], 'st1');
  assert.equal(plan.locks['ghost:3'], undefined);
  assert.equal(plan.pairs.length, 0);
});

test('ルール既定値は調査に基づく安全側（11h・連勤5・夜勤月8）', () => {
  const r = makeRuleConfig();
  assert.equal(r.minRestHours, 11);
  assert.equal(r.maxConsecutive, 5);
  assert.equal(r.maxNightStreak, 2);
  assert.equal(r.maxNightPerMonth, 8);
});
