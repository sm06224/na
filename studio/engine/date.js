/* ============================================================
   日付のちいさな道具 — 依存ゼロ、UTC 固定で時差の罠を避ける。
   ガントは「日」を単位に動く。ここはその物差し。
   ============================================================ */

// "2026-07-01" → UTC ミリ秒（不正なら null）。
export function toMs(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return Date.UTC(y, mo - 1, d);
}

const DAY = 86400000;

// 2 つの日付の差（日数, b - a）。
export function diffDays(a, b) {
  const ma = toMs(a), mb = toMs(b);
  if (ma == null || mb == null) return null;
  return Math.round((mb - ma) / DAY);
}

// 日付に n 日足す → "YYYY-MM-DD"。
export function addDays(s, n) {
  const ms = toMs(s);
  if (ms == null) return null;
  const d = new Date(ms + n * DAY);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`;
}

// 日付の曜日（0=日 .. 6=土）。週末の薄帯を引くため。
export function weekday(s) {
  const ms = toMs(s);
  if (ms == null) return null;
  return new Date(ms).getUTCDay();
}

// "5d" / "5" / 5 → 日数（既定は日）。"2w" は週。
export function parseDur(tok) {
  if (typeof tok === 'number') return tok;
  const m = /^(\d+(?:\.\d+)?)\s*([dw])?$/.exec(String(tok).trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === 'w' ? n * 7 : n;
}
