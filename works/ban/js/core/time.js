/* ============================================================
   時間ユーティリティ — シフトの時刻計算と月のカレンダー。
   タイムゾーンに依存しない素朴な分単位の計算だけを使う。
   ============================================================ */

/* "HH:MM" → 分（0..1439）。不正なら null。 */
export function parseHM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const h = +m[1], min = +m[2];
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function fmtHM(minutes) {
  minutes = ((minutes % 1440) + 1440) % 1440;
  const h = (minutes / 60) | 0, m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* シフトの実働時間（分）。終了が開始より前なら日をまたぐ。休憩を引く。 */
export function shiftMinutes(startMin, endMin, breakMin = 0) {
  let span = endMin - startMin;
  if (span <= 0) span += 1440;
  return Math.max(0, span - breakMin);
}

/* シフトの「絶対終了分」(開始日 0:00 起点)。日またぎなら 1440 を超える。 */
export function shiftEndAbs(startMin, endMin) {
  return endMin > startMin ? endMin : endMin + 1440;
}

/* 前日のシフト終了から翌日のシフト開始までの休息（分）。
   prevEndAbs は前日 0:00 起点、nextStart は翌日 0:00 起点。 */
export function restBetween(prevEndAbs, nextStartMin, dayGap = 1) {
  return nextStartMin + 1440 * dayGap - prevEndAbs;
}

/* ---------- 月のカレンダー ---------- */

export function daysInMonth(year, month /* 1..12 */) {
  return new Date(year, month, 0).getDate();
}

/* 曜日 0=日,1=月,...6=土（表示と必要人数の指定に使う） */
export function weekdayOf(year, month, day) {
  return new Date(year, month - 1, day).getDay();
}

export const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

export function isWeekend(wd) { return wd === 0 || wd === 6; }

/* 月内の「週番号」（月曜はじまり）。週上限の判定に使う。 */
export function weekIndexOf(year, month, day) {
  const first = weekdayOf(year, month, 1);          // 0=日
  const mondayOffset = (first + 6) % 7;             // 月曜=0 に直した初日の曜日
  return Math.floor((day - 1 + mondayOffset) / 7);
}
