import { OFF, EMPTY, getAssign, planDays, planWeekday, shiftTypeById } from './model.js';
import { WEEKDAY_JA } from './time.js';
import { buildCtx, countsFor } from './rules.js';

/* ============================================================
   CSV — Excel との行き来。
   日本語版 Excel がそのまま開けるよう BOM 付き UTF-8 で出す。
   ============================================================ */

const BOM = '﻿';

function esc(v) {
  const s = String(v ?? '');
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function row(cells) { return cells.map(esc).join(','); }

/* ---------- シフト表の書き出し ---------- */
export function exportScheduleCSV(plan) {
  const days = planDays(plan);
  const lines = [];
  lines.push(row([`${plan.year}年${plan.month}月`, ...range1(days).map(d => `${d}`)]));
  lines.push(row(['', ...range1(days).map(d => WEEKDAY_JA[planWeekday(plan, d)])]));
  for (const sf of plan.staff) {
    const cells = [sf.name];
    for (let d = 1; d <= days; d++) {
      const v = getAssign(plan, sf.id, d);
      if (v === OFF) cells.push('休');
      else if (v === EMPTY) cells.push('');
      else cells.push(shiftTypeById(plan, v)?.short ?? '?');
    }
    lines.push(row(cells));
  }
  /* 集計行 */
  const ctx = buildCtx(plan);
  lines.push('');
  lines.push(row(['集計', '出勤', '夜勤', '土日', '労働時間']));
  for (const sf of plan.staff) {
    const c = countsFor(plan, sf, ctx);
    lines.push(row([sf.name, c.total, c.night, c.weekend, (c.minutes / 60).toFixed(1)]));
  }
  return BOM + lines.join('\r\n');
}

/* ---------- 希望の取り込み ----------
   形式: 1 列目スタッフ名、2 列目以降に日付の希望。
     名前,1,2,3,...
     佐藤,休,,夜,...
   「休」= 休み希望、シフトの略称 = そのシフト希望、空 = 希望なし。  */
export function importRequestsCSV(plan, text) {
  const rows = parseCSV(text.replace(/^﻿/, ''));
  if (rows.length < 1) return { applied: 0, unknownStaff: [], unknownShift: [] };

  const header = rows[0];
  const dayOfCol = [];   // 列番号 -> 日
  for (let c = 1; c < header.length; c++) {
    const d = parseInt(String(header[c]).replace(/[^\d]/g, ''), 10);
    dayOfCol[c] = (d >= 1 && d <= planDays(plan)) ? d : null;
  }
  const shortMap = new Map(plan.shiftTypes.map(s => [s.short, s.id]));
  const nameMap = new Map(plan.staff.map(s => [s.name, s]));

  let applied = 0;
  const unknownStaff = [], unknownShift = [];
  for (let r = 1; r < rows.length; r++) {
    const name = String(rows[r][0] ?? '').trim();
    if (!name) continue;
    if (rows[r].length < 2) continue;   // 説明行など、日付列のない行は無視
    const sf = nameMap.get(name);
    if (!sf) { unknownStaff.push(name); continue; }
    for (let c = 1; c < rows[r].length; c++) {
      const d = dayOfCol[c];
      if (!d) continue;
      const cell = String(rows[r][c] ?? '').trim();
      if (!cell) continue;
      if (cell === '休' || cell === 'X' || cell === '×') {
        sf.requests[String(d)] = 'off';
        applied++;
      } else if (shortMap.has(cell)) {
        sf.requests[String(d)] = `want:${shortMap.get(cell)}`;
        applied++;
      } else {
        if (!unknownShift.includes(cell)) unknownShift.push(cell);
      }
    }
  }
  return { applied, unknownStaff, unknownShift };
}

/* ---------- 希望のテンプレート（配って書いてもらう用） ---------- */
export function requestTemplateCSV(plan) {
  const days = planDays(plan);
  const lines = [];
  lines.push(row(['名前', ...range1(days)]));
  lines.push(row(['', ...range1(days).map(d => WEEKDAY_JA[planWeekday(plan, d)])]));
  for (const sf of plan.staff) lines.push(row([sf.name, ...range1(days).map(() => '')]));
  lines.push('');
  lines.push(row(['記入方法: 休み希望は「休」、シフト希望は略称（' +
    plan.shiftTypes.map(s => s.short).join('・') + '）を書いてください']));
  return BOM + lines.join('\r\n');
}

/* ---------- 素朴で正しい CSV パーサ（引用符・改行対応） ---------- */
export function parseCSV(text) {
  const rows = [];
  let cur = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',') {
      cur.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      cur.push(field); field = '';
      rows.push(cur); cur = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

function range1(n) {
  return Array.from({ length: n }, (_, i) => i + 1);
}
