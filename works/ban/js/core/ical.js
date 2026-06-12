import { OFF, EMPTY, getAssign, planDays, shiftTypeById, shiftStartMin, shiftEndMin } from './model.js';

/* ============================================================
   iCal — 確定したシフトを、各スタッフが自分のスマホの
   カレンダー（Google/Apple）に取り込めるようにする。
   ============================================================ */

function pad(n, len = 2) { return String(n).padStart(len, '0'); }

function dtLocal(y, m, d, minutes) {
  // フローティング時刻（タイムゾーン指定なし = 端末のローカル）
  const h = (minutes / 60) | 0, mi = minutes % 60;
  return `${y}${pad(m)}${pad(d)}T${pad(h)}${pad(mi)}00`;
}

/* 日またぎを考慮した終了日時 */
function endDate(y, m, d, startMin, endMin) {
  if (endMin > startMin) return { y, m, d, minutes: endMin };
  // 翌日へ
  const dt = new Date(y, m - 1, d + 1);
  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate(), minutes: endMin };
}

function escText(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;')
    .replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function exportICal(plan, staffId) {
  const sf = plan.staff.find(s => s.id === staffId);
  if (!sf) return null;
  const days = planDays(plan);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//na/ban//shift//JA',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escText(sf.name)} ${plan.year}-${pad(plan.month)} シフト`,
  ];
  const stamp = `${plan.year}${pad(plan.month)}01T000000Z`;
  for (let d = 1; d <= days; d++) {
    const v = getAssign(plan, sf.id, d);
    if (v === OFF || v === EMPTY) continue;
    const st = shiftTypeById(plan, v);
    if (!st) continue;
    const s = shiftStartMin(st), e = shiftEndMin(st);
    const end = endDate(plan.year, plan.month, d, s, e);
    lines.push(
      'BEGIN:VEVENT',
      `UID:ban-${plan.year}${pad(plan.month)}${pad(d)}-${sf.id}@local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dtLocal(plan.year, plan.month, d, s)}`,
      `DTEND:${dtLocal(end.y, end.m, end.d, end.minutes)}`,
      `SUMMARY:${escText(st.name)}`,
      `DESCRIPTION:${escText(`${plan.year}年${plan.month}月のシフト（番で作成）`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
