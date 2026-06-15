/* ============================================================
   窟 — 幾何のこまごま。方向・矩形・距離・線・座標の畳み方。
   迷宮はすべて格子の上にある。ここはその格子の文法。
   ============================================================ */

/* 4 近傍（東 南 西 北）と 8 近傍 */
export const DIR4 = [
  { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 },
];
export const DIR8 = [
  { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 1 },
  { x: -1, y: 0 }, { x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 },
];

/* 向きの名づけ（年代記やUIで使う） */
export const DIRNAME = {
  '1,0': '東', '0,1': '南', '-1,0': '西', '0,-1': '北',
  '1,1': '南東', '-1,1': '南西', '-1,-1': '北西', '1,-1': '北東',
};
export function dirName(dx, dy) {
  return DIRNAME[`${Math.sign(dx)},${Math.sign(dy)}`] || 'そこ';
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = v => (v > 0 ? 1 : v < 0 ? -1 : 0);

/* 距離いろいろ */
export const chebyshev = (ax, ay, bx, by) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
export const manhattan = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
export const euclid2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
export const euclid = (ax, ay, bx, by) => Math.sqrt(euclid2(ax, ay, bx, by));

/* 座標を 1 個の整数キーに畳む（Map / Set 用） */
export const key = (x, y) => x * 100003 + y;     // 幅は 100003 未満の前提
export const keyOf = (x, y) => `${x},${y}`;       // 文字列キー（読みやすい）
export function unkey(k) { const [x, y] = k.split(',').map(Number); return { x, y }; }

/* 隣接（はす向かいを許すか） */
export function neighbors(x, y, diagonal = true) {
  return (diagonal ? DIR8 : DIR4).map(d => ({ x: x + d.x, y: y + d.y }));
}

/* ----- 矩形 ----- */
export class Rect {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
  }
  get x2() { return this.x + this.w; }
  get y2() { return this.y + this.h; }
  get cx() { return this.x + (this.w >> 1); }
  get cy() { return this.y + (this.h >> 1); }
  get area() { return this.w * this.h; }
  center() { return { x: this.cx, y: this.cy }; }

  contains(px, py) { return px >= this.x && px < this.x2 && py >= this.y && py < this.y2; }

  /* もう一方の矩形と（縁を含めて pad だけ）重なるか */
  intersects(o, pad = 0) {
    return this.x - pad < o.x2 && this.x2 + pad > o.x &&
      this.y - pad < o.y2 && this.y2 + pad > o.y;
  }

  /* 内側へ縮める／外へ広げる */
  shrink(n) { return new Rect(this.x + n, this.y + n, this.w - 2 * n, this.h - 2 * n); }
  expand(n) { return new Rect(this.x - n, this.y - n, this.w + 2 * n, this.h + 2 * n); }

  /* 各セルを巡る（縁を skipBorder で除ける） */
  each(fn, skipBorder = false) {
    const x0 = this.x + (skipBorder ? 1 : 0), x1 = this.x2 - (skipBorder ? 1 : 0);
    const y0 = this.y + (skipBorder ? 1 : 0), y1 = this.y2 - (skipBorder ? 1 : 0);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) fn(x, y);
  }

  /* 内側のランダムな点 */
  randomPoint(rng, inset = 1) {
    return {
      x: rng.range(this.x + inset, this.x2 - 1 - inset),
      y: rng.range(this.y + inset, this.y2 - 1 - inset),
    };
  }
  clone() { return new Rect(this.x, this.y, this.w, this.h); }
}

/* ブレゼンハムの直線（始点・終点を含む点列） */
export function line(x0, y0, x1, y1) {
  const pts = [];
  let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0, y = y0;
  for (;;) {
    pts.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return pts;
}

/* 直線が「通っている」か、各点を述語で確かめながら歩く */
export function lineOfClear(x0, y0, x1, y1, passable) {
  const pts = line(x0, y0, x1, y1);
  for (let i = 1; i < pts.length - 1; i++) {
    if (!passable(pts[i].x, pts[i].y)) return false;
  }
  return true;
}

/* 二次元配列を作る（初期値関数つき） */
export function makeGrid(w, h, fill) {
  const g = new Array(h);
  for (let y = 0; y < h; y++) {
    g[y] = new Array(w);
    for (let x = 0; x < w; x++) g[y][x] = typeof fill === 'function' ? fill(x, y) : fill;
  }
  return g;
}

/* 連結成分（4 連結 / 8 連結）。passable(x,y) が真のセルを島に分ける。 */
export function connectedRegions(w, h, passable, diagonal = false) {
  const seen = makeGrid(w, h, false);
  const regions = [];
  const dirs = diagonal ? DIR8 : DIR4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (seen[y][x] || !passable(x, y)) continue;
      const region = [];
      const stack = [{ x, y }];
      seen[y][x] = true;
      while (stack.length) {
        const c = stack.pop();
        region.push(c);
        for (const d of dirs) {
          const nx = c.x + d.x, ny = c.y + d.y;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (seen[ny][nx] || !passable(nx, ny)) continue;
          seen[ny][nx] = true;
          stack.push({ x: nx, y: ny });
        }
      }
      regions.push(region);
    }
  }
  return regions;
}

/* 角丸の整数（表示や計算の安定に） */
export const ri = v => Math.round(v);
