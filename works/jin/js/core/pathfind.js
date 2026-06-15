/* ============================================================
   陣 — 道をさがす。移動できるマス（ダイクストラ）と、最短路（A*）。
   `史`・`窟` の経路探索の血を、盤上の機動に。
   コストは地形＋「他のユニットがいるマスは通れる（味方）／通れない（敵）」を
   blocked(x,y) と costAt(x,y) で外から差す。決定的（タイブレークは座標順）。
   ============================================================ */

import { manhattan, key, DIRS4 } from './grid.js';

/* 小さな二分ヒープ（決定的・安定） */
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(item) {
    const a = this.a; a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this._less(a[i], a[p])) { [a[i], a[p]] = [a[p], a[i]]; i = p; } else break;
    }
  }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) { a[0] = last; this._down(0); }
    return top;
  }
  _down(i) {
    const a = this.a, n = a.length;
    for (;;) {
      let l = 2 * i + 1, r = l + 1, m = i;
      if (l < n && this._less(a[l], a[m])) m = l;
      if (r < n && this._less(a[r], a[m])) m = r;
      if (m === i) break;
      [a[i], a[m]] = [a[m], a[i]]; i = m;
    }
  }
  _less(x, y) { return x.f !== y.f ? x.f < y.f : (x.g !== y.g ? x.g < y.g : x.t < y.t); }
}

/* 到達可能なマス（移動力 mp 以内）。各マスへの最小コストと、来た方向を返す。
   opts.costAt(x,y) -> 進入コスト（Infinity で不可）。
   opts.blocked(x,y) -> true なら通り抜け不可（敵ユニットなど。始点は除く）。 */
export function reachable(grid, start, mp, opts = {}) {
  const costAt = opts.costAt || (() => 1);
  const blocked = opts.blocked || (() => false);
  const dist = new Map();        // key -> cost
  const from = new Map();        // key -> prev key
  const sk = key(start.x, start.y);
  dist.set(sk, 0);
  const heap = new Heap();
  heap.push({ x: start.x, y: start.y, g: 0, f: 0, t: 0 });
  let tie = 1;
  while (heap.size) {
    const cur = heap.pop();
    const ck = key(cur.x, cur.y);
    if (cur.g > (dist.get(ck) ?? Infinity)) continue;
    for (const d of DIRS4) {
      const nx = cur.x + d.x, ny = cur.y + d.y;
      if (!grid.inBounds(nx, ny)) continue;
      if (blocked(nx, ny)) continue;
      const step = costAt(nx, ny);
      if (!isFinite(step)) continue;
      const ng = cur.g + step;
      if (ng > mp) continue;
      const nk = key(nx, ny);
      if (ng < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, ng);
        from.set(nk, ck);
        heap.push({ x: nx, y: ny, g: ng, f: ng, t: tie++ });
      }
    }
  }
  return { dist, from };
}

/* 最短路（A*）— start から goal まで。届かなければ null。 */
export function findPath(grid, start, goal, opts = {}) {
  const costAt = opts.costAt || (() => 1);
  const blocked = opts.blocked || (() => false);
  const gk = key(goal.x, goal.y);
  const g = new Map(); const from = new Map();
  const sk = key(start.x, start.y);
  g.set(sk, 0);
  const heap = new Heap();
  heap.push({ x: start.x, y: start.y, g: 0, f: manhattan(start, goal), t: 0 });
  let tie = 1;
  while (heap.size) {
    const cur = heap.pop();
    const ck = key(cur.x, cur.y);
    if (ck === gk) return rebuild(from, sk, gk);
    if (cur.g > (g.get(ck) ?? Infinity)) continue;
    for (const d of DIRS4) {
      const nx = cur.x + d.x, ny = cur.y + d.y;
      if (!grid.inBounds(nx, ny)) continue;
      const isGoal = nx === goal.x && ny === goal.y;
      if (blocked(nx, ny) && !isGoal) continue;
      const step = costAt(nx, ny);
      if (!isFinite(step)) continue;
      const ng = cur.g + step;
      const nk = key(nx, ny);
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng); from.set(nk, ck);
        heap.push({ x: nx, y: ny, g: ng, f: ng + manhattan({ x: nx, y: ny }, goal), t: tie++ });
      }
    }
  }
  return null;
}

function rebuild(from, sk, gk) {
  const path = [];
  let k = gk;
  while (k !== undefined) {
    const [x, y] = k.split(',').map(Number);
    path.push({ x, y });
    if (k === sk) break;
    k = from.get(k);
  }
  return path.reverse();
}

/* 反復で「ある目標へいちばん近づける到達マス」を選ぶ（AI の前進に使う） */
export function stepToward(grid, reach, goal) {
  let best = null, bestD = Infinity, bestCost = Infinity;
  for (const [k, cost] of reach.dist) {
    const [x, y] = k.split(',').map(Number);
    const d = manhattan({ x, y }, goal);
    if (d < bestD || (d === bestD && cost < bestCost)) {
      best = { x, y }; bestD = d; bestCost = cost;
    }
  }
  return best;
}

/* 射線（地形 blocksSight を遮蔽として通すか）— 矢・魔法の通り */
export function hasLineOfSight(grid, a, b, blocksSight) {
  let x0 = a.x, y0 = a.y; const x1 = b.x, y1 = b.y;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (let guard = 0; guard < 999; guard++) {
    if (!(x0 === a.x && y0 === a.y) && !(x0 === x1 && y0 === y1)) {
      if (blocksSight(x0, y0)) return false;
    }
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return true;
}
