/* ============================================================
   陣 — 盤（グリッド）。正方マス・直交移動・マンハッタン射程。
   座標はすべて {x, y}。盤の上のことは、まずここに集まる。
   ============================================================ */

export const DIRS4 = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
export const DIRS8 = [
  { x: 0, y: -1 }, { x: 1, y: -1 }, { x: 1, y: 0 }, { x: 1, y: 1 },
  { x: 0, y: 1 }, { x: -1, y: 1 }, { x: -1, y: 0 }, { x: -1, y: -1 },
];

export const key = (x, y) => `${x},${y}`;
export const unkey = k => { const [x, y] = k.split(',').map(Number); return { x, y }; };

/* マンハッタン距離（射程の基準） */
export function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
export function chebyshev(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export class Grid {
  constructor(w, h, fill = 0) {
    this.w = w; this.h = h;
    this.cells = new Array(w * h).fill(fill);
  }
  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inBounds(x, y) ? this.cells[this.idx(x, y)] : undefined; }
  set(x, y, v) { if (this.inBounds(x, y)) this.cells[this.idx(x, y)] = v; }
  fill(v) { this.cells.fill(v); return this; }
  clone() {
    const g = new Grid(this.w, this.h);
    g.cells = this.cells.slice();
    return g;
  }
  /* 4近傍（盤の内側のみ） */
  neighbors4(x, y) {
    const out = [];
    for (const d of DIRS4) {
      const nx = x + d.x, ny = y + d.y;
      if (this.inBounds(nx, ny)) out.push({ x: nx, y: ny });
    }
    return out;
  }
  neighbors8(x, y) {
    const out = [];
    for (const d of DIRS8) {
      const nx = x + d.x, ny = y + d.y;
      if (this.inBounds(nx, ny)) out.push({ x: nx, y: ny });
    }
    return out;
  }
  forEach(fn) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) fn(x, y, this.cells[this.idx(x, y)]);
  }
}

/* 中心から半径 r 以内（マンハッタン）の全マス。min..max の輪も取れる */
export function tilesInRange(cx, cy, min, max) {
  const out = [];
  for (let dy = -max; dy <= max; dy++) {
    for (let dx = -max; dx <= max; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d >= min && d <= max) out.push({ x: cx + dx, y: cy + dy });
    }
  }
  return out;
}

/* 直線（ブレゼンハム）— 射線・突撃の通り道に */
export function line(a, b) {
  const pts = [];
  let x0 = a.x, y0 = a.y;
  const x1 = b.x, y1 = b.y;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  for (let guard = 0; guard < 999; guard++) {
    pts.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }
  return pts;
}
