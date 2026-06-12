import { moveCost } from './terrain.js';

/* ============================================================
   経路探索 — A*。集落と集落を結ぶ道はここで生まれる。
   既に道があるタイルは安く通れるので、道は自然と幹線に合流する。
   ============================================================ */

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(node) {
    const a = this.a;
    a.push(node);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

const SQRT2 = Math.SQRT2;

/* from→to の経路（タイル index の配列）を返す。届かなければ null。
   road は Uint8Array（1 なら道があり、コストが安くなる）。 */
export function findPath(terrain, road, from, to, maxNodes = 24000) {
  const N = terrain.size;
  const fx = from % N, fy = (from / N) | 0;
  const tx = to % N, ty = (to / N) | 0;
  const h = (x, y) => {
    const dx = Math.abs(x - tx), dy = Math.abs(y - ty);
    return Math.max(dx, dy) + (SQRT2 - 1) * Math.min(dx, dy);
  };

  const gScore = new Map();
  const came = new Map();
  const open = new MinHeap();
  gScore.set(from, 0);
  open.push({ i: from, f: h(fx, fy) });
  let explored = 0;

  while (open.size) {
    const { i: cur } = open.pop();
    if (cur === to) {
      const path = [cur];
      let c = cur;
      while (came.has(c)) { c = came.get(c); path.push(c); }
      return path.reverse();
    }
    if (++explored > maxNodes) return null;
    const cx = cur % N, cy = (cur / N) | 0;
    const g = gScore.get(cur);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const j = ny * N + nx;
        let c = moveCost(terrain, j);
        if (c === Infinity) continue;
        if (road && road[j]) c = Math.min(c, 0.5);   // 既存の道は歩きやすい
        const step = (dx && dy) ? c * SQRT2 : c;
        const ng = g + step;
        if (ng < (gScore.get(j) ?? Infinity)) {
          gScore.set(j, ng);
          came.set(j, cur);
          open.push({ i: j, f: ng + h(nx, ny) });
        }
      }
    }
  }
  return null;
}
