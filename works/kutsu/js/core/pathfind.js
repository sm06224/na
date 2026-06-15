/* ============================================================
   窟 — 道さがし。A* と、ダイクストラ地図（魔物が獲物へ寄る／逃げる）。
   `史` が街道を A* で結んだように、ここでは魔物が床を読む。
   ============================================================ */

import { DIR4, DIR8, chebyshev } from './util.js';

const INF = 0x7fffffff;

/* 最小ヒープ（A* 用） */
class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(node, pri) { this.a.push({ node, pri }); this._up(this.a.length - 1); }
  pop() {
    const top = this.a[0], last = this.a.pop();
    if (this.a.length) { this.a[0] = last; this._down(0); }
    return top.node;
  }
  _up(i) {
    while (i > 0) { const p = (i - 1) >> 1; if (this.a[p].pri <= this.a[i].pri) break; [this.a[p], this.a[i]] = [this.a[i], this.a[p]]; i = p; }
  }
  _down(i) {
    const n = this.a.length;
    for (;;) {
      let s = i, l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.a[l].pri < this.a[s].pri) s = l;
      if (r < n && this.a[r].pri < this.a[s].pri) s = r;
      if (s === i) break;
      [this.a[s], this.a[i]] = [this.a[i], this.a[s]]; i = s;
    }
  }
}

/* A* — (sx,sy)→(tx,ty) の道。passable(x,y) が通れるセル。
   斜め可。見つからなければ null。 */
export function aStar(level, sx, sy, tx, ty, passable, opts = {}) {
  const { w, h } = level;
  const diagonal = opts.diagonal !== false;
  const dirs = diagonal ? DIR8 : DIR4;
  const idx = (x, y) => y * w + x;
  const g = new Int32Array(w * h).fill(INF);
  const came = new Int32Array(w * h).fill(-1);
  const open = new Heap();
  g[idx(sx, sy)] = 0;
  open.push(idx(sx, sy), chebyshev(sx, sy, tx, ty));
  const goal = idx(tx, ty);

  while (open.size) {
    const cur = open.pop();
    if (cur === goal) return rebuild(came, cur, w);
    const cx = cur % w, cy = (cur / w) | 0;
    for (const d of dirs) {
      const nx = cx + d.x, ny = cy + d.y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = idx(nx, ny);
      const isGoal = ni === goal;
      if (!isGoal && !passable(nx, ny)) continue;
      // 斜めに壁の角を抜けない
      if (d.x !== 0 && d.y !== 0) {
        if (!passable(cx + d.x, cy) && !passable(cx, cy + d.y)) continue;
      }
      const step = (d.x !== 0 && d.y !== 0) ? 1.4142 : 1;
      const ng = g[cur] + step;
      if (ng < g[ni]) {
        g[ni] = ng; came[ni] = cur;
        open.push(ni, ng + chebyshev(nx, ny, tx, ty));
      }
    }
  }
  return null;
}

function rebuild(came, cur, w) {
  const path = [];
  while (cur !== -1) { path.push({ x: cur % w, y: (cur / w) | 0 }); cur = came[cur]; }
  return path.reverse();
}

/* ダイクストラ地図：goals からの距離場。魔物はここを「下る」と獲物へ着く。
   返り値は Int32Array（idx→距離、届かないところは INF）。 */
export function dijkstraMap(level, goals, passable, diagonal = true) {
  const { w, h } = level;
  const dist = new Int32Array(w * h).fill(INF);
  const q = [];
  for (const gxy of goals) {
    const i = gxy.y * w + gxy.x;
    if (dist[i] !== 0) { dist[i] = 0; q.push(i); }
  }
  const dirs = diagonal ? DIR8 : DIR4;
  let head = 0;
  while (head < q.length) {
    const cur = q[head++];
    const cx = cur % w, cy = (cur / w) | 0, d = dist[cur];
    for (const dd of dirs) {
      const nx = cx + dd.x, ny = cy + dd.y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (!passable(nx, ny)) continue;
      const ni = ny * w + nx;
      if (d + 1 < dist[ni]) { dist[ni] = d + 1; q.push(ni); }
    }
  }
  return dist;
}

/* 逃げ地図：距離場を負へ反転して薄め、もう一度下らせると「遠ざかる」。 */
export function fleeMap(dist, w, h, passable, scale = -1.2) {
  const flee = new Int32Array(w * h).fill(INF);
  const q = [];
  // 反転して種をまく
  const seeds = [];
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] === INF) continue;
    flee[i] = Math.round(dist[i] * scale);
  }
  // 値の小さい順に緩和（簡略化：数回の緩めで充分）
  const dirs = DIR8;
  for (let pass = 0; pass < 8; pass++) {
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!passable(x, y)) continue;
      let best = flee[i];
      for (const d of dirs) {
        const ni = (y + d.y) * w + (x + d.x);
        if (flee[ni] + 1 < best) best = flee[ni] + 1;
      }
      flee[i] = best;
    }
  }
  return flee;
}

/* BFS の到達集合（連結確認・領域抽出に） */
export function reachable(level, sx, sy, passable) {
  const { w, h } = level;
  const seen = new Uint8Array(w * h);
  const out = [];
  const q = [{ x: sx, y: sy }];
  seen[sy * w + sx] = 1;
  let head = 0;
  while (head < q.length) {
    const c = q[head++];
    out.push(c);
    for (const d of DIR4) {
      const nx = c.x + d.x, ny = c.y + d.y;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (seen[ni] || !passable(nx, ny)) continue;
      seen[ni] = 1; q.push({ x: nx, y: ny });
    }
  }
  return out;
}

/* 距離場の上で「いちばん遠い歩けるセル」を返す（下り階段を置くのに） */
export function farthestCell(dist, level) {
  let best = null, bd = -1;
  for (let y = 0; y < level.h; y++) for (let x = 0; x < level.w; x++) {
    const i = y * level.w + x;
    if (dist[i] === INF || !level.walkable(x, y)) continue;
    if (dist[i] > bd) { bd = dist[i]; best = { x, y, d: dist[i] }; }
  }
  return best;
}

export const PATH_INF = INF;
