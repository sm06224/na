/* ============================================================
   レイアウト計算 — モデル＋（あれば）@layout から座標を出す。純粋・決定的。
   ガント：日付を解決し、タイムライン上の棒に（done/active/crit/milestone）。
   フローチャート：向き(TD/LR…)に従い、依存の深さで自動段組み（最長経路）。
   @layout pos があればそれを優先（手で動かした位置）。
   DOM もキャンバスも知らない。返すのは数だけ。
   ============================================================ */
import { diffDays, addDays, weekday } from './date.js';

export const GANTT = { PAD: 16, LABEL_W: 176, AXIS_H: 44, ROW_H: 32, SEC_H: 26, DAY_W: 26, BAR_H: 18 };
export const FLOW = { PAD: 28, NODE_H: 48, GAP_MAIN: 70, GAP_CROSS: 30, GROUP_PAD: 18, GROUP_HEAD: 24 };

// ---- ガント ---------------------------------------------------------------

function ganttBase(model) {
  if (model.meta.start) return model.meta.start;
  let min = null;
  for (const it of model.items) {
    const d = model.layout.at[it.id] || it.at;
    if (d && (min === null || diffDays(d, min) > 0)) min = d;
  }
  return min || model.meta.today || '2026-01-01';
}

export function layoutGantt(model) {
  const G = GANTT, base = ganttBase(model), errors = [];
  const byId = new Map(model.items.map((it) => [it.id, it]));
  const startDay = {};
  const durOf = (it) => it.dur;

  // 開始日：@layout at > at > after の依存終了 > 0。依存が解けるまで反復。
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
        for (const dep of it.after) { const e = startDay[dep] + (byId.get(dep) ? durOf(byId.get(dep)) : 0); if (e > s) s = e; }
        startDay[it.id] = s; changed = true;
      }
    }
  }
  for (const it of model.items) if (!(it.id in startDay)) {
    startDay[it.id] = 0; errors.push(`task ${it.id}: 依存が解決できません（循環か未定義）`);
  }
  // 終了日（_end）が絶対指定なら、開始日との差を期間にする。
  for (const it of model.items) if (it._end != null) {
    const d = diffDays(base, it._end) - startDay[it.id];
    if (d != null && d >= 0) it.dur = d;
  }

  // 行の並び：@layout order を尊重し、漏れは元の順で補う。
  const ordSet = new Set(model.layout.order);
  const order = model.layout.order.filter((id) => byId.has(id))
    .concat(model.order.filter((id) => !ordSet.has(id)));

  const bars = [], sections = [];
  let y = G.AXIS_H + G.PAD, curSec;
  for (const id of order) {
    const it = byId.get(id); if (!it) continue;
    if (it.section !== curSec) {
      curSec = it.section;
      if (curSec) { sections.push({ name: curSec, y: y + 4 }); y += G.SEC_H; }
    }
    const sd = startDay[id], dur = it.dur;
    bars.push({
      id, label: it.label, type: it.type, status: it.status, section: it.section,
      x: G.LABEL_W + sd * G.DAY_W, y: y + (G.ROW_H - G.BAR_H) / 2,
      w: Math.max(it.type === 'milestone' ? G.BAR_H : 4, dur * G.DAY_W), h: G.BAR_H,
      rowY: y, startDay: sd, dur, startDate: addDays(base, sd), endDate: addDays(base, sd + dur),
    });
    y += G.ROW_H;
  }

  let maxDay = 1;
  for (const b of bars) maxDay = Math.max(maxDay, b.startDay + b.dur);
  maxDay += 2;
  const width = G.LABEL_W + maxDay * G.DAY_W + G.PAD;
  const height = Math.max(y + G.PAD, G.AXIS_H + 80);

  const days = [];
  for (let d = 0; d <= maxDay; d++) {
    const date = addDays(base, d);
    days.push({ d, date, x: G.LABEL_W + d * G.DAY_W, weekend: [0, 6].includes(weekday(date)) });
  }
  const today = model.meta.today
    ? { x: G.LABEL_W + diffDays(base, model.meta.today) * G.DAY_W, date: model.meta.today } : null;

  return { kind: 'gantt', base, dayW: G.DAY_W, labelW: G.LABEL_W, axisH: G.AXIS_H, rowH: G.ROW_H,
    bars, sections, days, today, width, height, errors };
}

// ---- フローチャート --------------------------------------------------------

export function nodeSize(label, shape) {
  let w = 0; for (const ch of label) w += (ch.charCodeAt(0) > 0x2e7f ? 16 : 9);
  w = Math.max(84, Math.min(280, w + 36));
  let h = FLOW.NODE_H;
  if (shape === 'circle') { const d = Math.max(w, h, 64); return { w: d, h: d }; }
  if (shape === 'rhombus' || shape === 'hexagon') { w += 24; h += 8; }
  if (shape === 'stadium' || shape === 'cylinder') h += 4;
  return { w, h };
}

function clip(a, b) {
  const acx = a.x + a.w / 2, acy = a.y + a.h / 2, bcx = b.x + b.w / 2, bcy = b.y + b.h / 2;
  const edge = (r, cx, cy, tx, ty) => {
    const dx = tx - cx, dy = ty - cy;
    if (!dx && !dy) return [cx, cy];
    const s = Math.min(dx ? (r.w / 2) / Math.abs(dx) : Infinity, dy ? (r.h / 2) / Math.abs(dy) : Infinity);
    return [cx + dx * s, cy + dy * s];
  };
  return { from: edge(a, acx, acy, bcx, bcy), to: edge(b, bcx, bcy, acx, acy) };
}

export function layoutFlow(model) {
  const dir = (model.meta.dir || 'TD').toUpperCase();
  const vertical = dir === 'TD' || dir === 'TB' || dir === 'BT';   // 段が縦に進む
  const reverse = dir === 'BT' || dir === 'RL';
  const nodes = model.items.filter((it) => it.type === 'node');
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const preds = new Map(nodes.map((n) => [n.id, []]));
  for (const e of model.edges) if (byId.has(e.from) && byId.has(e.to)) preds.get(e.to).push(e.from);

  const depth = {}, visiting = new Set();
  const calc = (id) => {
    if (id in depth) return depth[id];
    if (visiting.has(id)) return 0;
    visiting.add(id);
    let d = 0; for (const p of preds.get(id) || []) d = Math.max(d, calc(p) + 1);
    visiting.delete(id); depth[id] = d; return d;
  };
  for (const n of nodes) calc(n.id);

  const layers = {};
  for (const n of nodes) (layers[depth[n.id]] ||= []).push(n.id);
  const keys = Object.keys(layers).map(Number).sort((a, b) => a - b);
  const maxDepth = keys.length ? keys[keys.length - 1] : 0;

  const placed = new Map();
  const sizeOf = (id) => nodeSize(byId.get(id).label, byId.get(id).shape);
  // 段ごとの主軸サイズ（縦なら高さ、横なら幅）の最大で段の位置を決める。
  const layerExtent = {};
  for (const c of keys) { let m = 0; for (const id of layers[c]) { const s = sizeOf(id); m = Math.max(m, vertical ? s.h : s.w); } layerExtent[c] = m; }
  const layerPos = {}; let acc = FLOW.PAD + (vertical ? 0 : 0);
  for (const c of keys) { layerPos[c] = acc; acc += layerExtent[c] + FLOW.GAP_MAIN; }

  for (const c of keys) {
    let cross = FLOW.PAD + FLOW.GROUP_HEAD;
    for (const id of layers[c]) {
      const s = sizeOf(id);
      const d = reverse ? (maxDepth - c) : c;
      const main = (layerPos[d] ?? layerPos[c]);
      if (vertical) placed.set(id, { id, label: byId.get(id).label, shape: byId.get(id).shape, x: cross, y: main, w: s.w, h: s.h });
      else placed.set(id, { id, label: byId.get(id).label, shape: byId.get(id).shape, x: main, y: cross, w: s.w, h: s.h });
      cross += (vertical ? s.w : s.h) + FLOW.GAP_CROSS;
    }
  }

  for (const n of nodes) { const p = model.layout.pos[n.id]; if (p) { const r = placed.get(n.id); r.x = p[0]; r.y = p[1]; } }

  const groups = [];
  for (const g of model.groups) {
    const mem = g.ids.map((id) => placed.get(id)).filter(Boolean);
    if (!mem.length) continue;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const m of mem) { x0 = Math.min(x0, m.x); y0 = Math.min(y0, m.y); x1 = Math.max(x1, m.x + m.w); y1 = Math.max(y1, m.y + m.h); }
    groups.push({ name: g.name, x: x0 - FLOW.GROUP_PAD, y: y0 - FLOW.GROUP_PAD - FLOW.GROUP_HEAD,
      w: (x1 - x0) + FLOW.GROUP_PAD * 2, h: (y1 - y0) + FLOW.GROUP_PAD * 2 + FLOW.GROUP_HEAD });
  }

  const edges = [];
  for (const e of model.edges) {
    const a = placed.get(e.from), b = placed.get(e.to);
    if (a && b) { const c = clip(a, b); edges.push({ ...e, x1: c.from[0], y1: c.from[1], x2: c.to[0], y2: c.to[1],
      mx: (c.from[0] + c.to[0]) / 2, my: (c.from[1] + c.to[1]) / 2 }); }
  }

  let width = FLOW.PAD, height = FLOW.PAD;
  for (const r of placed.values()) { width = Math.max(width, r.x + r.w); height = Math.max(height, r.y + r.h); }
  for (const g of groups) { width = Math.max(width, g.x + g.w); height = Math.max(height, g.y + g.h); }
  return { kind: 'flowchart', dir, nodes: [...placed.values()], edges, groups,
    width: width + FLOW.PAD, height: height + FLOW.PAD, errors: [] };
}

export function layout(model) {
  return model.kind === 'flowchart' ? layoutFlow(model) : layoutGantt(model);
}
