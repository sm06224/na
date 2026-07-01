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
export const SEQ = { PAD: 24, TOP: 14, ACTOR_H: 36, GAP: 30, MSG_H: 34, SELF_W: 44, HEAD_GAP: 20 };

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

  // 交差をほどく：隣の段の重心（barycenter）で段の中の並びを整える。決定的（同点は元の順）。
  const succs = new Map(nodes.map((n) => [n.id, []]));
  for (const e of model.edges) if (byId.has(e.from) && byId.has(e.to)) succs.get(e.from).push(e.to);
  const pos = new Map();
  const setPos = () => { for (const c of keys) layers[c].forEach((id, i) => pos.set(id, i)); };
  setPos();
  for (let sweep = 0; sweep < 4; sweep++) {
    const down = sweep % 2 === 0;
    const ks = down ? keys.slice(1) : keys.slice(0, -1).reverse();
    const ref = down ? preds : succs;
    for (const c of ks) {
      const arr = layers[c].map((id, i) => {
        const ns = (ref.get(id) || []).map((p) => pos.get(p)).filter((v) => v != null);
        return { id, i, b: ns.length ? ns.reduce((a, v) => a + v, 0) / ns.length : i };
      });
      arr.sort((p, q) => p.b - q.b || p.i - q.i);
      layers[c] = arr.map((o) => o.id);
      setPos();
    }
  }

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
      const base = { id, label: byId.get(id).label, shape: byId.get(id).shape, w: s.w, h: s.h };
      if (byId.get(id).link) base.link = byId.get(id).link;
      if (vertical) placed.set(id, { ...base, x: cross, y: main });
      else placed.set(id, { ...base, x: main, y: cross });
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

  // エッジは主軸に沿うベジェ曲線。ラベルは曲線の中点（t=0.5）へ。
  const edges = [];
  for (const e of model.edges) {
    const a = placed.get(e.from), b = placed.get(e.to);
    if (!a || !b) continue;
    const c = clip(a, b);
    const [x1, y1] = c.from, [x2, y2] = c.to;
    let c1x, c1y, c2x, c2y;
    if (vertical) { const d = (y2 - y1) * 0.45; c1x = x1; c1y = y1 + d; c2x = x2; c2y = y2 - d; }
    else { const d = (x2 - x1) * 0.45; c1x = x1 + d; c1y = y1; c2x = x2 - d; c2y = y2; }
    const mx = (x1 + 3 * c1x + 3 * c2x + x2) / 8, my = (y1 + 3 * c1y + 3 * c2y + y2) / 8;
    edges.push({ ...e, x1, y1, x2, y2, c1x, c1y, c2x, c2y, mx, my });
  }

  let width = FLOW.PAD, height = FLOW.PAD;
  for (const r of placed.values()) { width = Math.max(width, r.x + r.w); height = Math.max(height, r.y + r.h); }
  for (const g of groups) { width = Math.max(width, g.x + g.w); height = Math.max(height, g.y + g.h); }
  return { kind: 'flowchart', dir, nodes: [...placed.values()], edges, groups,
    width: width + FLOW.PAD, height: height + FLOW.PAD, errors: [] };
}

// ---- シーケンス図 -----------------------------------------------------------

export function layoutSeq(model) {
  const S = SEQ, errors = [];
  const byId = new Map(model.items.map((a) => [a.id, a]));
  const ordSet = new Set(model.layout.order);
  const order = model.layout.order.filter((id) => byId.has(id))
    .concat(model.order.filter((id) => !ordSet.has(id)));

  // 参加者を左から並べる（幅はラベルなり）。
  const wOf = (label) => { let w = 0; for (const ch of label) w += ch.charCodeAt(0) > 0x2e7f ? 15 : 8.5; return Math.max(76, Math.min(220, w + 28)); };
  const actors = []; let x = S.PAD;
  for (const id of order) {
    const a = byId.get(id); if (!a) continue;
    const w = wOf(a.label);
    actors.push({ id, label: a.label, x, y: S.TOP, w, h: S.ACTOR_H, cx: x + w / 2 });
    x += w + S.GAP;
  }
  const cxOf = new Map(actors.map((a) => [a.id, a.cx]));

  // 出来事を上から順に積む。枠（loop/alt…）はスタックで開き、end で閉じる。
  let y = S.TOP + S.ACTOR_H + S.HEAD_GAP;
  const msgs = [], notes = [], frames = [], stack = [];
  let num = 0;
  for (const ev of (model.events || [])) {
    if (ev.type === 'fstart') { stack.push({ kind: ev.kind, label: ev.label, y0: y, divs: [] }); y += 26; continue; }
    if (ev.type === 'fdiv') { const f = stack[stack.length - 1]; if (f) { f.divs.push({ y, label: ev.label }); y += 24; } continue; }
    if (ev.type === 'fend') { const f = stack.pop(); if (f) frames.push({ ...f, y1: y + 4 }); y += 18; continue; }
    if (ev.type === 'note') {
      const cxs = ev.ids.map((id) => cxOf.get(id)).filter((v) => v != null);
      if (!cxs.length) { errors.push(`Note の相手が見つからない: ${ev.ids.join(',')}`); continue; }
      const tw = Math.max(64, ev.label.length * 8 + 22);
      let nx, nw;
      if (ev.pos === 'over') { const lo = Math.min(...cxs), hi = Math.max(...cxs); nw = Math.max(hi - lo + 40, tw); nx = (lo + hi) / 2 - nw / 2; }
      else if (ev.pos === 'left of') { nw = tw; nx = cxs[0] - tw - 12; }
      else { nw = tw; nx = cxs[0] + 12; }
      notes.push({ x: nx, y, w: nw, h: 26, label: ev.label });
      y += 38; continue;
    }
    const x1 = cxOf.get(ev.from), x2 = cxOf.get(ev.to);
    if (x1 == null || x2 == null) { errors.push(`メッセージの相手が見つからない: ${ev.from}→${ev.to}`); continue; }
    num++;
    const self = ev.from === ev.to;
    msgs.push({ ...ev, n: num, x1, x2, y, self });
    y += self ? S.MSG_H + 12 : S.MSG_H;
  }
  while (stack.length) { const f = stack.pop(); frames.push({ ...f, y1: y }); }

  const height = y + S.PAD;
  const width = Math.max(x - S.GAP + S.PAD, 220);
  for (const f of frames) { f.x = S.PAD / 2 + 2; f.w = width - S.PAD - 4; }   // 枠は全幅に淡く

  return { kind: 'sequence', actors, msgs, notes, frames,
    lifeTop: S.TOP + S.ACTOR_H, selfW: S.SELF_W, autonumber: !!model.meta.autonumber,
    width, height, errors };
}

export function layout(model) {
  if (model.kind === 'flowchart') return layoutFlow(model);
  if (model.kind === 'sequence') return layoutSeq(model);
  return layoutGantt(model);
}
