/* ============================================================
   宙 — space. メガデモの宇宙の数学。DOM を知らない純関数。
   3D の回転と投影、ワープ星空、プラズマ星雲、トンネル。
   どれも時刻 t の関数で、種を決めれば同じ宇宙になる。
   ============================================================ */

import { hashSeed, mulberry32 } from './rng.js';

/* 点 (x,y,z) を各軸まわりに回す。長さは保たれる。 */
export function rotate(x, y, z, ax, ay, az) {
  let s = Math.sin(ax), c = Math.cos(ax);
  let y1 = y * c - z * s, z1 = y * s + z * c;
  s = Math.sin(ay); c = Math.cos(ay);
  let x2 = x * c + z1 * s, z2 = -x * s + z1 * c;
  s = Math.sin(az); c = Math.cos(az);
  let x3 = x2 * c - y1 * s, y3 = x2 * s + y1 * c;
  return [x3, y3, z2];
}

/* 透視投影。z>0（前方）なら画面座標と倍率を返す。z<=0 は null（背後）。 */
export function project(x, y, z, fov = 300) {
  if (z <= 0.0001) return null;
  const k = fov / z;
  return { x: x * k, y: y * k, scale: k };
}

/* ---- ワープ星空：箱の中の星が、手前へ流れ、近づくと奥へ巻き戻る ---- */
export const STAR_FAR = 1000, STAR_NEAR = 1;
export function makeStars(n, seed) {
  const rng = mulberry32(hashSeed(seed) ^ 0x73746172);   // 'star'
  const stars = [];
  for (let i = 0; i < n; i++) {
    stars.push({
      x: (rng() * 2 - 1) * 800,
      y: (rng() * 2 - 1) * 800,
      z: STAR_NEAR + rng() * (STAR_FAR - STAR_NEAR),
    });
  }
  return stars;
}
/* z を near..far の輪に巻き戻す（手前を抜けた星は奥へ）。 */
export function wrapZ(z) {
  const span = STAR_FAR - STAR_NEAR;
  let zz = z;
  while (zz < STAR_NEAR) zz += span;
  while (zz >= STAR_FAR) zz -= span;
  return zz;
}

/* ---- プラズマ星雲：正弦の重ね合わせ。値は 0..1 ---- */
export function plasma(x, y, t) {
  let v = Math.sin(x * 0.9 + t);
  v += Math.sin((y * 0.8 - t * 0.7));
  v += Math.sin((x * 0.4 + y * 0.6 + t * 0.5));
  const cx = x + 0.5 * Math.sin(t * 0.3), cy = y + 0.5 * Math.cos(t * 0.4);
  v += Math.sin(Math.sqrt(cx * cx + cy * cy) * 1.2 - t);
  return (v / 4) * 0.5 + 0.5;                 // -1..1 → 0..1
}

/* ---- トンネル（ワームホール）：方向と距離からテクスチャ座標へ ---- */
export function tunnel(nx, ny, t) {
  const dist = Math.sqrt(nx * nx + ny * ny) + 1e-6;
  const angle = Math.atan2(ny, nx);
  const u = angle / Math.PI;                  // -1..1（巻き）
  const v = 1 / dist + t;                     // 奥へ吸い込まれる
  const shade = Math.min(1, dist);            // 中心は明るく、縁は暗い
  return { u, v, shade, dist, angle };
}

/* ---- 球面に点を撒く（ベクターボール＝回る惑星） ---- */
export function sphere(n) {
  const pts = [];
  const phi = Math.PI * (3 - Math.sqrt(5));   // 黄金角（フィボナッチ球）
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = phi * i;
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r]);
  }
  return pts;
}
