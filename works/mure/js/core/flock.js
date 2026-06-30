/* ============================================================
   群 のこころ臓 — むれは、誰にも率いられていない。
   一羽一羽が見ているのは、近くの数羽だけ。その三つの約束——
     ・整列（align）  ：近くの仲間と、向きをそろえる
     ・結束（cohere） ：近くの仲間の、真ん中へ寄る
     ・分離（separate）：近すぎる仲間からは、離れる
   ——だけで、何百羽が一つの体のようにうねる（椋鳥のむれ＝murmuration）。
   隼がよぎれば、おびえが波となって群れを走る（驚きの波）。
   種から決定的。DOM もキャンバスも知らない。返すのは位置と速さだけ。
   生・言・歌と続く「ひとりでに」の系譜の、夕の章。
   ============================================================ */
import { RNG } from './rng.js';

export const DEFAULTS = {
  N: 160, W: 320, H: 200,
  view: 26, sep: 9,                       // 知覚半径・分離半径
  wAlign: 1.0, wCohere: 0.9, wSep: 1.5,   // 三つの約束の重み
  roost: 0.010, edge: 22, edgeTurn: 0.22, // ねぐらへの寄り・端の避け
  maxSpeed: 2.3, minSpeed: 1.15, maxForce: 0.18,
  fearR: 46, wFlee: 3.2, alarmSpread: 0.9, // 隼への恐れ・おびえの伝播
};

const hyp = (x, y) => Math.sqrt(x * x + y * y);
function limit(x, y, max) { const m = hyp(x, y); return m > max ? [x / m * max, y / m * max] : [x, y]; }

export function makeFlock(seed, opts = {}) {
  const p = { ...DEFAULTS, ...opts };
  const rng = new RNG(seed).fork('flock');
  const birds = [];
  for (let i = 0; i < p.N; i++) {
    const a = rng.float(0, Math.PI * 2), s = rng.float(p.minSpeed, p.maxSpeed);
    // はじまりはばらばら——種から散らした位置と、てんでの向き。
    birds.push({ x: rng.float(p.W * 0.25, p.W * 0.75), y: rng.float(p.H * 0.25, p.H * 0.75),
      vx: Math.cos(a) * s, vy: Math.sin(a) * s, alarm: 0 });
  }
  return { birds, p, seed, step: 0 };
}

/* ひと刻み進める。predator（隼）は {x,y} か null。
   隣探しは素朴な総当たり（数百羽なら充分）。 */
export function step(F, predator = null) {
  const { birds, p } = F;
  const next = [];
  for (let i = 0; i < birds.length; i++) {
    const b = birds[i];
    let ax = 0, ay = 0, cx = 0, cy = 0, sx = 0, sy = 0, n = 0, alarm = b.alarm * 0.94;
    for (let j = 0; j < birds.length; j++) {
      if (j === i) continue;
      const o = birds[j], dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 > p.view * p.view) continue;
      const d = Math.sqrt(d2) || 1e-6;
      ax += o.vx; ay += o.vy;                 // 整列：仲間の速度
      cx += o.x; cy += o.y;                    // 結束：仲間の位置
      if (d < p.sep) { sx -= dx / d; sy -= dy / d; }  // 分離：近すぎる相手から離れる
      if (o.alarm > alarm) alarm = o.alarm * p.alarmSpread;  // おびえは伝わる
      n++;
    }
    let fx = 0, fy = 0;
    if (n > 0) {
      // 整列
      let [dxv, dyv] = limit(ax / n, ay / n, p.maxSpeed);
      let [stx, sty] = limit(dxv - b.vx, dyv - b.vy, p.maxForce);
      fx += stx * p.wAlign; fy += sty * p.wAlign;
      // 結束
      const tx = cx / n - b.x, ty = cy / n - b.y;
      let [cdx, cdy] = limit(tx, ty, p.maxSpeed);
      [stx, sty] = limit(cdx - b.vx, cdy - b.vy, p.maxForce);
      fx += stx * p.wCohere; fy += sty * p.wCohere;
      // 分離
      if (sx || sy) {
        let [sdx, sdy] = limit(sx, sy, p.maxSpeed);
        [stx, sty] = limit(sdx - b.vx, sdy - b.vy, p.maxForce);
        fx += stx * p.wSep; fy += sty * p.wSep;
      }
    }
    // ねぐら（中心）への淡い寄り——むれが空に留まり、輪を描く。
    fx += (p.W / 2 - b.x) * p.roost * 0.06; fy += (p.H / 2 - b.y) * p.roost * 0.06;
    // 端を避けて折り返す。
    if (b.x < p.edge) fx += p.edgeTurn; else if (b.x > p.W - p.edge) fx -= p.edgeTurn;
    if (b.y < p.edge) fy += p.edgeTurn; else if (b.y > p.H - p.edge) fy -= p.edgeTurn;
    // 隼への恐れ——近いほど強く逃げ、おびえが灯る。
    if (predator) {
      const dx = b.x - predator.x, dy = b.y - predator.y, d = hyp(dx, dy);
      if (d < p.fearR) {
        const k = (1 - d / p.fearR);
        fx += (dx / (d || 1e-6)) * p.wFlee * k; fy += (dy / (d || 1e-6)) * p.wFlee * k;
        alarm = Math.max(alarm, k);
      }
    }
    // 速度を更新し、速さを [min,max] に保つ（鳥は止まれない）。
    let vx = b.vx + fx, vy = b.vy + fy, sp = hyp(vx, vy);
    if (sp > p.maxSpeed) { vx = vx / sp * p.maxSpeed; vy = vy / sp * p.maxSpeed; }
    else if (sp < p.minSpeed) { const s = sp || 1e-6; vx = vx / s * p.minSpeed; vy = vy / s * p.minSpeed; }
    let x = b.x + vx, y = b.y + vy;
    x = Math.max(0, Math.min(p.W, x)); y = Math.max(0, Math.min(p.H, y));
    next.push({ x, y, vx, vy, alarm });
  }
  F.birds = next; F.step++;
  return F;
}

export function advance(F, steps, predator = null) { for (let s = 0; s < steps; s++) step(F, predator); return F; }

// 整列度（order parameter φ∈[0,1]）。ばらばらなら 0、ひとつの向きなら 1。
export function order(F) {
  let sx = 0, sy = 0;
  for (const b of F.birds) { const s = hyp(b.vx, b.vy) || 1e-6; sx += b.vx / s; sy += b.vy / s; }
  return hyp(sx, sy) / F.birds.length;
}

// おびえている鳥の割合（驚きの波の大きさ）。
export function alarmed(F, thresh = 0.15) {
  let c = 0; for (const b of F.birds) if (b.alarm > thresh) c++;
  return c / F.birds.length;
}

// いちばん近い仲間までの平均距離（むれの密度の目安・分離の検証に使う）。
export function meanNearest(F) {
  const { birds } = F; let sum = 0;
  for (let i = 0; i < birds.length; i++) {
    let best = Infinity;
    for (let j = 0; j < birds.length; j++) if (j !== i) {
      const dx = birds[j].x - birds[i].x, dy = birds[j].y - birds[i].y, d = dx * dx + dy * dy;
      if (d < best) best = d;
    }
    sum += Math.sqrt(best);
  }
  return sum / birds.length;
}

// 種から、刻みを与えて、できあがったむれを返す（CLI・テストの入口）。
export function flock(seed, steps = 600, opts = {}) {
  const F = makeFlock(seed, opts);
  advance(F, steps);
  return F;
}
