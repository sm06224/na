/* ============================================================
   窟 — 彫りのこまごま。階に床を刻む低レベルの道具。
   部屋・横線・縦線・トンネル・円。生成器はこれを組み合わせる。
   ============================================================ */

import { T } from '../tile.js';
import { Rect, sign } from '../util.js';

export function carveRect(level, rect, tile = T.FLOOR) {
  rect.each((x, y) => { if (level.inBounds(x, y)) level.set(x, y, tile); });
}

/* 縁を壁に残して内側だけ床にする部屋 */
export function carveRoom(level, rect, tile = T.FLOOR) {
  rect.each((x, y) => { if (level.inBounds(x, y)) level.set(x, y, tile); }, true);
}

export function hLine(level, x0, x1, y, tile = T.CORRIDOR) {
  if (x1 < x0) [x0, x1] = [x1, x0];
  for (let x = x0; x <= x1; x++) if (level.inBounds(x, y)) level.set(x, y, tile);
}
export function vLine(level, y0, y1, x, tile = T.CORRIDOR) {
  if (y1 < y0) [y0, y1] = [y1, y0];
  for (let y = y0; y <= y1; y++) if (level.inBounds(x, y)) level.set(x, y, tile);
}

/* L 字のトンネル（先に横か縦かを rng で選ぶ） */
export function tunnelL(level, ax, ay, bx, by, rng, tile = T.CORRIDOR) {
  if (rng.chance(0.5)) { hLine(level, ax, bx, ay, tile); vLine(level, ay, by, bx, tile); }
  else { vLine(level, ay, by, ax, tile); hLine(level, ax, bx, by, tile); }
}

/* まっすぐ歩く一筆トンネル（蛇行つき）。床でないところだけ彫る。 */
export function tunnelDrunk(level, ax, ay, bx, by, rng, tile = T.CORRIDOR, wander = 0.2) {
  let x = ax, y = ay, guard = 0;
  const max = (level.w + level.h) * 3;
  while ((x !== bx || y !== by) && guard++ < max) {
    if (level.get(x, y) === T.WALL) level.set(x, y, tile);
    if (rng.chance(wander)) {
      if (rng.chance(0.5)) x += rng.chance(0.5) ? 1 : -1;
      else y += rng.chance(0.5) ? 1 : -1;
    } else if (rng.chance(0.5)) {
      x += sign(bx - x) || (rng.chance(0.5) ? 1 : -1);
    } else {
      y += sign(by - y) || (rng.chance(0.5) ? 1 : -1);
    }
    x = Math.max(1, Math.min(level.w - 2, x));
    y = Math.max(1, Math.min(level.h - 2, y));
  }
  if (level.get(bx, by) === T.WALL) level.set(bx, by, tile);
}

/* 円い部屋（洞窟の広間に） */
export function carveDisc(level, cx, cy, r, tile = T.FLOOR) {
  const r2 = r * r;
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (!level.inBounds(x, y)) continue;
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r2) level.set(x, y, tile);
    }
  }
}

/* 壁にぶつかるまで歩いて床を撒く（虫食い） */
export function wormDig(level, x, y, steps, rng, tile = T.FLOOR) {
  for (let i = 0; i < steps; i++) {
    level.set(x, y, tile);
    const d = rng.pick([[1, 0], [-1, 0], [0, 1], [0, -1]]);
    x = Math.max(1, Math.min(level.w - 2, x + d[0]));
    y = Math.max(1, Math.min(level.h - 2, y + d[1]));
  }
}

/* 矩形を無作為に作る（最小・最大の幅と高さ、盤に収まる位置） */
export function randomRoomRect(level, rng, minW, maxW, minH, maxH, margin = 1) {
  const w = rng.range(minW, maxW), h = rng.range(minH, maxH);
  const x = rng.range(margin, level.w - w - margin - 1);
  const y = rng.range(margin, level.h - h - margin - 1);
  return new Rect(x, y, w, h);
}
