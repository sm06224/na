import { makePlan, makeShiftType, makeStaff, makePair, makeRuleConfig, sanitizePlan } from './model.js';

/* ============================================================
   保存 — データはブラウザから一歩も出ない。
   localStorage への自動保存と、JSON ファイルへの書き出し/読み込み。
   storage は注入式（Node のテストでは Map を渡せる）。
   ============================================================ */

const KEY = 'ban-plan-v1';

export function serializePlan(plan) {
  return JSON.stringify(plan);
}

export function deserializePlan(json) {
  const raw = typeof json === 'string' ? JSON.parse(json) : json;
  if (!raw || typeof raw !== 'object') throw new Error('形式が不正です');
  if (raw.version !== 1) throw new Error(`未知のバージョン: ${raw.version}`);
  const plan = makePlan({
    title: raw.title,
    year: raw.year,
    month: raw.month,
    shiftTypes: (raw.shiftTypes || []).map(makeShiftType),
    staff: (raw.staff || []).map(makeStaff),
    pairs: (raw.pairs || []).map(makePair),
    rules: makeRuleConfig(raw.rules || {}),
    assign: raw.assign || {},
    locks: raw.locks || {},
    prevTail: raw.prevTail || {},
  });
  return sanitizePlan(plan);
}

export function saveLocal(plan, storage = globalThis.localStorage) {
  if (!storage) return false;
  try {
    storage.setItem(KEY, serializePlan(plan));
    return true;
  } catch {
    return false;   // 容量超過などは静かに諦める（手動保存がある）
  }
}

export function loadLocal(storage = globalThis.localStorage) {
  if (!storage) return null;
  try {
    const json = storage.getItem(KEY);
    if (!json) return null;
    return deserializePlan(json);
  } catch {
    return null;
  }
}

export function clearLocal(storage = globalThis.localStorage) {
  if (storage) storage.removeItem(KEY);
}
