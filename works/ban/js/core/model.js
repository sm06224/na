import { parseHM, shiftMinutes, shiftEndAbs, daysInMonth, weekdayOf } from './time.js';

/* ============================================================
   モデル — 計画（Plan）がすべての中心。
   Plan = 月 + シフト種別 + スタッフ + 必要人数 + ルール設定 + 割当。
   DOM に依存しない。テストも保存もこの形のまま行う。
   ============================================================ */

export const OFF = 'OFF';      // 休み
export const EMPTY = '';       // 未定（ソルバが埋める対象）

let _uid = 1;
export function uid(prefix = 'id') {
  return `${prefix}${_uid++}_${Date.now().toString(36)}`;
}
/* テスト用：ID 採番を決定的にリセット */
export function _resetUid(v = 1) { _uid = v; }

/* ---------- シフト種別 ---------- */
export function makeShiftType(partial = {}) {
  const st = {
    id: partial.id || uid('st'),
    name: partial.name || '日勤',
    short: partial.short || (partial.name ? partial.name[0] : '日'),
    color: partial.color || '#6aa3d8',
    start: partial.start || '09:00',
    end: partial.end || '18:00',
    breakMin: partial.breakMin ?? 60,
    isNight: partial.isNight ?? null,   // null = 自動判定（日をまたぐなら夜勤）
    // 必要人数: 曜日ごと [日,月,火,水,木,金,土]
    required: partial.required || [2, 2, 2, 2, 2, 2, 2],
    // 特定日の上書き { "15": 4 } — 行事や繁忙日に
    requiredOverride: partial.requiredOverride || {},
  };
  return st;
}

export function shiftStartMin(st) { return parseHM(st.start) ?? 540; }
export function shiftEndMin(st) { return parseHM(st.end) ?? 1080; }
export function shiftWorkMinutes(st) {
  return shiftMinutes(shiftStartMin(st), shiftEndMin(st), st.breakMin);
}
export function shiftEndAbsMin(st) {
  return shiftEndAbs(shiftStartMin(st), shiftEndMin(st));
}
export function shiftIsNight(st) {
  if (st.isNight !== null && st.isNight !== undefined) return st.isNight;
  return shiftEndMin(st) <= shiftStartMin(st);   // 日をまたぐ = 夜勤
}
export function requiredOn(st, day, wd) {
  const ov = st.requiredOverride?.[String(day)];
  return ov !== undefined ? ov : (st.required[wd] ?? 0);
}

/* ---------- スタッフ ---------- */
export function makeStaff(partial = {}) {
  return {
    id: partial.id || uid('sf'),
    name: partial.name || '名無し',
    // 働けるシフト種別 id（空配列 = すべて可）
    canWork: partial.canWork || [],
    maxConsecutive: partial.maxConsecutive ?? null,   // null = 全体設定に従う
    maxPerWeek: partial.maxPerWeek ?? null,           // 週の出勤上限
    targetPerMonth: partial.targetPerMonth ?? null,   // 月の出勤目標（null = 自動）
    maxNightPerMonth: partial.maxNightPerMonth ?? null,
    // 希望: { "12": "off" } 休み希望 / { "3": "want:st1" } / { "8": "ng:st2" }
    requests: partial.requests || {},
    memo: partial.memo || '',
  };
}

/* ---------- ペア制約 ---------- */
export function makePair(partial = {}) {
  return {
    id: partial.id || uid('pr'),
    type: partial.type || 'apart',   // 'apart' 同じ日の同じシフトに入れない / 'together' なるべく組ませる
    a: partial.a || null,
    b: partial.b || null,
    hard: partial.hard ?? (partial.type !== 'together'),
  };
}

/* ---------- 全体ルール設定（調査に基づく既定値） ----------
   - 勤務間インターバル 11 時間（努力義務として推奨されている値）
   - 連勤上限 5 日（健康面の推奨。法定上限は 12 日）
   - 夜勤の連続 2 回まで・月 8 回まで（看護職ガイドラインの目安）     */
export function makeRuleConfig(partial = {}) {
  return {
    minRestHours: partial.minRestHours ?? 11,
    maxConsecutive: partial.maxConsecutive ?? 5,
    maxNightStreak: partial.maxNightStreak ?? 2,
    maxNightPerMonth: partial.maxNightPerMonth ?? 8,
    forbidLoneOff: partial.forbidLoneOff ?? false,  // 飛び石休みを避ける（ソフト）
    fairWeekends: partial.fairWeekends ?? true,     // 土日出勤を均す
    fairNights: partial.fairNights ?? true,         // 夜勤を均す
    fairTotals: partial.fairTotals ?? true,         // 出勤数を均す
    preferStablePattern: partial.preferStablePattern ?? true, // 同じシフトが続くのを好む
  };
}

/* ---------- 計画（Plan） ---------- */
export function makePlan(partial = {}) {
  const now = new Date();
  const plan = {
    version: 1,
    title: partial.title || '',
    year: partial.year || now.getFullYear(),
    month: partial.month || (now.getMonth() + 1),
    shiftTypes: partial.shiftTypes || [],
    staff: partial.staff || [],
    pairs: partial.pairs || [],
    rules: makeRuleConfig(partial.rules || {}),
    // 割当: { staffId: { day(1始まり): shiftTypeId | OFF | EMPTY } }
    assign: partial.assign || {},
    // ロック: { "staffId:day": true } — ソルバが触らないセル
    locks: partial.locks || {},
    // 前月末の勤務（新しい順でなく日付順の配列、最大 7 日分）。
    // 月初の連勤・夜勤連続・勤務間インターバルを正しく判定するための引き継ぎ。
    // { staffId: [shiftTypeId | OFF, ...] }
    prevTail: partial.prevTail || {},
  };
  return plan;
}

/* 今月の月末 k 日ぶんを「翌月への引き継ぎ」として取り出す */
export function extractTail(plan, k = 7) {
  const days = planDays(plan);
  const tail = {};
  for (const sf of plan.staff) {
    const arr = [];
    for (let d = Math.max(1, days - k + 1); d <= days; d++) {
      arr.push(getAssign(plan, sf.id, d) || OFF);
    }
    tail[sf.id] = arr;
  }
  return tail;
}

export function planDays(plan) { return daysInMonth(plan.year, plan.month); }
export function planWeekday(plan, day) { return weekdayOf(plan.year, plan.month, day); }

export function getAssign(plan, staffId, day) {
  return plan.assign[staffId]?.[day] ?? EMPTY;
}
export function setAssign(plan, staffId, day, value) {
  if (!plan.assign[staffId]) plan.assign[staffId] = {};
  if (value === EMPTY) delete plan.assign[staffId][day];
  else plan.assign[staffId][day] = value;
}
export function isLocked(plan, staffId, day) {
  return !!plan.locks[`${staffId}:${day}`];
}
export function setLock(plan, staffId, day, locked) {
  const key = `${staffId}:${day}`;
  if (locked) plan.locks[key] = true;
  else delete plan.locks[key];
}

export function shiftTypeById(plan, id) {
  return plan.shiftTypes.find(s => s.id === id) || null;
}
export function staffById(plan, id) {
  return plan.staff.find(s => s.id === id) || null;
}

/* スタッフがそのシフトに入れるか（スキル/担当の制約） */
export function canWork(staff, shiftTypeId) {
  return staff.canWork.length === 0 || staff.canWork.includes(shiftTypeId);
}

/* 希望の取得: null | {kind:'off'} | {kind:'want', shiftId} | {kind:'ng', shiftId} */
export function requestOf(staff, day) {
  const r = staff.requests[String(day)];
  if (!r) return null;
  if (r === 'off') return { kind: 'off' };
  const m = /^(want|ng):(.+)$/.exec(r);
  if (m) return { kind: m[1], shiftId: m[2] };
  return null;
}

/* 月の出勤目標（指定がなければ「必要人数の総量 ÷ 人数」から自動算出） */
export function autoTargetPerMonth(plan) {
  const days = planDays(plan);
  let slots = 0;
  for (let d = 1; d <= days; d++) {
    const wd = planWeekday(plan, d);
    for (const st of plan.shiftTypes) slots += requiredOn(st, d, wd);
  }
  const n = Math.max(1, plan.staff.length);
  return Math.round(slots / n);
}

/* 割当の整合性を軽く保証する（存在しないスタッフ・シフトの掃除） */
export function sanitizePlan(plan) {
  const staffIds = new Set(plan.staff.map(s => s.id));
  const stIds = new Set(plan.shiftTypes.map(s => s.id));
  for (const sid of Object.keys(plan.assign)) {
    if (!staffIds.has(sid)) { delete plan.assign[sid]; continue; }
    for (const [day, v] of Object.entries(plan.assign[sid])) {
      if (v !== OFF && v !== EMPTY && !stIds.has(v)) delete plan.assign[sid][day];
      if (+day < 1 || +day > planDays(plan)) delete plan.assign[sid][day];
    }
  }
  for (const key of Object.keys(plan.locks)) {
    const [sid] = key.split(':');
    if (!staffIds.has(sid)) delete plan.locks[key];
  }
  for (const p of plan.pairs.slice()) {
    if (!staffIds.has(p.a) || !staffIds.has(p.b)) {
      plan.pairs.splice(plan.pairs.indexOf(p), 1);
    }
  }
  return plan;
}
