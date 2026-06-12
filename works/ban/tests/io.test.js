import { test } from 'node:test';
import assert from 'node:assert/strict';

import { demoPlan } from '../js/core/demo.js';
import { solve } from '../js/core/solver.js';
import {
  exportScheduleCSV, requestTemplateCSV, importRequestsCSV, parseCSV,
} from '../js/core/csv.js';
import { exportICal } from '../js/core/ical.js';
import { serializePlan, deserializePlan, saveLocal, loadLocal } from '../js/core/store.js';
import { getAssign, OFF } from '../js/core/model.js';

/* ---------- CSV ---------- */
test('parseCSV: 引用符・カンマ・改行入りフィールドを正しく読む', () => {
  const rows = parseCSV('a,"b,c","d""e"\r\n"複数\n行",x,');
  assert.deepEqual(rows[0], ['a', 'b,c', 'd"e']);
  assert.deepEqual(rows[1], ['複数\n行', 'x', '']);
});

test('シフト表 CSV は BOM 付きで、全員ぶんの行と集計を含む', () => {
  const plan = demoPlan(2026, 6);
  solve(plan, { seed: 1, iterations: 8000 });
  const csv = exportScheduleCSV(plan);
  assert.ok(csv.startsWith('﻿'), 'BOM がある（Excel 文字化け対策）');
  for (const sf of plan.staff) assert.ok(csv.includes(sf.name));
  assert.ok(csv.includes('集計'));
  assert.ok(csv.includes('2026年6月'));
});

test('希望テンプレートを配り、書き戻して取り込める（往復）', () => {
  const plan = demoPlan(2026, 6);
  for (const sf of plan.staff) sf.requests = {};   // 希望をまっさらに
  const tpl = requestTemplateCSV(plan);
  const rows = parseCSV(tpl.replace(/^﻿/, ''));
  // 佐藤の行に休み希望とシフト希望を書き込む
  const header = rows[0];
  const satoRow = rows.findIndex(r => r[0] === '佐藤');
  assert.ok(satoRow > 0);
  const col5 = header.findIndex(h => String(h) === '5');
  const col6 = header.findIndex(h => String(h) === '6');
  rows[satoRow][col5] = '休';
  rows[satoRow][col6] = '夜';
  const text = rows.map(r => r.join(',')).join('\n');

  const result = importRequestsCSV(plan, text);
  assert.equal(result.applied, 2);
  assert.equal(result.unknownStaff.length, 0);
  const sato = plan.staff.find(s => s.name === '佐藤');
  assert.equal(sato.requests['5'], 'off');
  assert.equal(sato.requests['6'], 'want:st-night');
});

test('知らない名前・知らない略称は報告される', () => {
  const plan = demoPlan(2026, 6);
  const text = '名前,1,2\n架空さん,休,\n佐藤,Z,';
  const r = importRequestsCSV(plan, text);
  assert.deepEqual(r.unknownStaff, ['架空さん']);
  assert.deepEqual(r.unknownShift, ['Z']);
});

/* ---------- iCal ---------- */
test('iCal: 構造が正しく、夜勤は翌日に終わる', () => {
  const plan = demoPlan(2026, 6);
  // 佐藤に 10 日の夜勤を直接置く
  plan.assign['sf-01'] = { 10: 'st-night', 11: OFF };
  const ics = exportICal(plan, 'sf-01');
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.endsWith('END:VCALENDAR'));
  assert.ok(ics.includes('SUMMARY:夜勤'));
  assert.ok(ics.includes('DTSTART:20260610T160000'));
  assert.ok(ics.includes('DTEND:20260611T090000'), '夜勤の終了は翌 11 日 9:00');
});

test('iCal: 月末の夜勤は翌月にまたいで終わる', () => {
  const plan = demoPlan(2026, 6);
  plan.assign['sf-01'] = { 30: 'st-night' };
  const ics = exportICal(plan, 'sf-01');
  assert.ok(ics.includes('DTEND:20260701T090000'));
});

/* ---------- 保存 ---------- */
test('JSON 保存 → 復元の往復で計画は変わらない', () => {
  const plan = demoPlan(2026, 6);
  solve(plan, { seed: 2, iterations: 8000 });
  const json = serializePlan(plan);
  const back = deserializePlan(json);
  assert.equal(back.year, plan.year);
  assert.equal(back.staff.length, plan.staff.length);
  assert.deepEqual(back.assign, plan.assign);
  assert.deepEqual(back.rules, plan.rules);
  assert.equal(getAssign(back, 'sf-01', 1), getAssign(plan, 'sf-01', 1));
});

test('localStorage 互換ストアへの保存と読み込み（注入式）', () => {
  const fake = new Map();
  const storage = {
    setItem: (k, v) => fake.set(k, v),
    getItem: k => fake.get(k) ?? null,
    removeItem: k => fake.delete(k),
  };
  const plan = demoPlan(2026, 6);
  assert.equal(saveLocal(plan, storage), true);
  const back = loadLocal(storage);
  assert.ok(back);
  assert.equal(back.staff.length, plan.staff.length);
});

test('壊れた JSON・未知バージョンは拒否する', () => {
  assert.throws(() => deserializePlan('{"version": 99}'));
  assert.throws(() => deserializePlan('not json'));
});
