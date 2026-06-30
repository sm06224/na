/* ============================================================
   レイアウト計算 — モデル＋（あれば）@layout から座標を出す。純粋・決定的。
   ガント：日付を解決し、タイムライン上の棒に。
   アーキ：@pos があればそれを、なければ依存から自動で段組み（最長経路）。
   DOM もキャンバスも知らない。返すのは数だけ。UI はそれを SVG に写す。
   ============================================================ */
import { diffDays, addDays, weekday } from './date.js';

export const GANTT = { PAD: 16, LABEL_W: 168, AXIS_H: 44, ROW_H: 32, SEC_H: 26, DAY_W: 26, BAR_H: 18 };
export const ARCH = { PAD: 28, NODE_H: 46, COL_GAP: 64, ROW_GAP: 26, GROUP_PAD: 16, GROUP_HEAD: 22 };

// ---- ガント ---------------------------------------------------------------

function ganttBase(model) {
  if (model.meta.start) return model.meta.start;
  let min = null;
  for (const it of model.items) {
    const d = model.layout.at[it.id] || it.at;
    if (d && (min === null || diffDays(d, min) > 0)) min = d;
  }
  return min || '2026-01-01';
}

export function layoutGantt(model) {
  const G = GANTT, base = ganttBase(model), errors = [];
  const byId = new Map(model.items.map((it) => [it.id, it]));
  const startDay = {};                          // id → 開始日（base からの日数）

  // 開始日を解決する：明示日 > after の依存終了 > 0。依存が解けるまで反復。
  const explicit = (it) => model.layout.at[it.id] || it.at || null;
  let changed = true, guard = 0;
  while (changed && guard++ <= model.items.length + 1) {
    changed = false;
    for (const it of model.items) {
      if (it.id in startDay) continue;
      const ex = explicit(it);
      if (ex) {
        const d = diffDays(base, ex);
        if (d == null) { errors.push(`task ${it.id}: 日付が不正「${ex}」`); startDay[it.id] = 0; }
        else startDay[it.id] = d;
        changed = true;
      } else if (it.after.length === 0) { startDay[it.id] = 0; changed = true; }
      else if (it.after.every((d) => d in startDay)) {
        let s = 0;
        for (const dep of it.after) { const e = startDay[dep] + (byId.get(dep)?.dur ?? 0); if (e > s) s = e; }
        startDay[it.id] = s; changed = true;
      }
    }
  }
  for (const it of model.items) if (!(it.id in startDay)) {
    startDay[it.id] = 0; errors.push(`task ${it.id}: 依存が解決できません（循環か未定義）`);
  }

  // 行の並び：@layout order があればそれを尊重し、漏れは元の順で補う。
  const ordSet = new Set(model.layout.order);
  const order = model.layout.order.filter((id) => byId.has(id))
    .concat(model.order.filter((id) => !ordSet.has(id)));

  // 縦に並べる（セクション見出しを挟む）。
  const bars = [], sections = [];
  let y = G.AXIS_H + G.PAD, curSec = undefined;
  for (const id of order) {
    const it = byId.get(id); if (!it) continue;
    if (it.section !== curSec) {
      curSec = it.section;
      if (curSec) { sections.push({ name: curSec, y: y + 4 }); y += G.SEC_H; }
    }
    const sd = startDay[id], dur = it.dur;
    bars.push({
      id, label: it.label, type: it.type, done: it.done, section: it.section,
      x: G.LABEL_W + sd * G.DAY_W, y: y + (G.ROW_H - G.BAR_H) / 2,
      w: Math.max(it.type === 'milestone' ? G.BAR_H : 4, dur * G.DAY_W), h: G.BAR_H,
      rowY: y, startDay: sd, dur, startDate: addDays(base, sd), endDate: addDays(base, sd + dur),
    });
    y += G.ROW_H;
  }

  // 期間の総日数（軸の幅）。
  let maxDay = 1;
  for (const b of bars) maxDay = Math.max(maxDay, b.startDay + b.dur);
  maxDay += 2;
  const width = G.LABEL_W + maxDay * G.DAY_W + G.PAD;
  const height = Math.max(y + G.PAD, G.AXIS_H + 80);

  // 週末の薄帯＋日付目盛り。
  const days = [];
  for (let d = 0; d <= maxDay; d++) {
    const date = addDays(base, d);
    days.push({ d, date, x: G.LABEL_W + d * G.DAY_W, weekend: [0, 6].includes(weekday(date)) });
  }
  const today = model.meta.today ? { x: G.LABEL_W + diffDays(base, model.meta.today) * G.DAY_W, date: model.meta.today } : null;

  return { kind: 'gantt', base, dayW: G.DAY_W, labelW: G.LABEL_W, axisH: G.AXIS_H, rowH: G.ROW_H,
    bars, sections, days, today, width, height, errors };
}

// ---- アーキ図 --------------------------------------------------------------

function nodeSize(label) {
  // 日本語まじりをざっくり見積もる（全角を広めに）。
  let w = 0; for (const ch of label) w += (ch.charCodeAt(0) > 0x2e7f ? 16 : 9);
  return { w: Math.max(84, Math.min(260, w + 28)), h: ARCH.NODE_H };
}

// 中心 A→中心 B の線を、矩形 A・B の境界でクリップする。
function clip(a, b) {
  const acx = a.x + a.w / 2, acy = a.y + a.h / 2, bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
  const edge = (r, cx, cy, tx, ty) => {
    const dx = tx - cx, dy = ty - cy;
    if (dx === 0 && dy === 0) return [cx, cy];
    const sx = dx === 0 ? Infinity : (r.w / 2) / Math.abs(dx);
    const sy = dy === 0 ? Infinity : (r.h / 2) / Math.abs(dy);
    const s = Math.min(sx, sy);
    return [cx + dx * s, cy + dy * s];
  };
  return { from: edge(a, acx, acy, bcx, bcy), to: edge(b, bcx, bcy, acx, acy) };
}

export function layoutArch(model) {
  const nodes = model.items.filter((it) => it.type === 'node');
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const preds = new Map(nodes.map((n) => [n.id, []]));
  for (const e of model.edges) if (byId.has(e.from) && byId.has(e.to)) preds.get(e.to).push(e.from);

  // 段（depth）＝ソースからの最長経路。循環は後退辺を 0 扱いで切る。
  const depth = {}, visiting = new Set();
  const calc = (id) => {
    if (id in depth) return depth[id];
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let d = 0;
    for (const p of preds.get(id) || []) d = Math.max(d, calc(p) + 1);
    visiting.delete(id); depth[id] = d; return d;
  };
  for (const n of nodes) calc(n.id);

  // 段ごとに列、列内は元の順で積む。
  const cols = {};
  for (const n of nodes) (cols[depth[n.id]] ||= []).push(n.id);

  const placed = new Map();
  const colKeys = Object.keys(cols).map(Number).sort((a, b) => a - b);
  let x = ARCH.PAD;
  const colW = {};
  for (const c of colKeys) { let w = 84; for (const id of cols[c]) w = Math.max(w, nodeSize(byId.get(id).label).w); colW[c] = w; }
  for (const c of colKeys) {
    let yy = ARCH.PAD + ARCH.GROUP_HEAD;
    for (const id of cols[c]) {
      const sz = nodeSize(byId.get(id).label);
      placed.set(id, { id, label: byId.get(id).label, x, y: yy, w: colW[c], h: sz.h });
      yy += sz.h + ARCH.ROW_GAP;
    }
    x += colW[c] + ARCH.COL_GAP;
  }

  // @layout pos があれば上書き（手で動かした位置）。
  for (const n of nodes) {
    const p = model.layout.pos[n.id];
    if (p) { const r = placed.get(n.id); r.x = p[0]; r.y = p[1]; }
  }

  // グループ枠：メンバーの外接矩形＋余白。
  const groups = [];
  for (const g of model.groups) {
    const members = g.ids.map((id) => placed.get(id)).filter(Boolean);
    if (!members.length) continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const m of members) { x0 = Math.min(x0, m.x); y0 = Math.min(y0, m.y); x1 = Math.max(x1, m.x + m.w); y1 = Math.max(y1, m.y + m.h); }
    groups.push({ name: g.name, x: x0 - ARCH.GROUP_PAD, y: y0 - ARCH.GROUP_PAD - ARCH.GROUP_HEAD,
      w: (x1 - x0) + ARCH.GROUP_PAD * 2, h: (y1 - y0) + ARCH.GROUP_PAD * 2 + ARCH.GROUP_HEAD });
  }

  const edges = [];
  for (const e of model.edges) {
    const a = placed.get(e.from), b = placed.get(e.to);
    if (a && b) { const c = clip(a, b); edges.push({ from: e.from, to: e.to, x1: c.from[0], y1: c.from[1], x2: c.to[0], y2: c.to[1] }); }
  }

  let width = ARCH.PAD, height = ARCH.PAD;
  for (const r of placed.values()) { width = Math.max(width, r.x + r.w); height = Math.max(height, r.y + r.h); }
  for (const g of groups) { width = Math.max(width, g.x + g.w); height = Math.max(height, g.y + g.h); }
  return { kind: 'arch', nodes: [...placed.values()], edges, groups, width: width + ARCH.PAD, height: height + ARCH.PAD, errors: [] };
}

// 種別で振り分ける入口。
export function layout(model) {
  return model.kind === 'arch' ? layoutArch(model) : layoutGantt(model);
}
