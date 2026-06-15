/* ============================================================
   窟 — 洞窟。誰も掘らないのに掘れている穴。
   無作為に壁と床を撒き、セルオートマトンで均すと、
   ひとりでに自然な岩室と回廊が現れる。
   ============================================================ */

import { T } from '../tile.js';

export function genCave(level, rng, opts = {}) {
  const wallProb = opts.wallProb ?? 0.45;
  const steps = opts.steps ?? 5;
  const w = level.w, h = level.h;

  // 初期：縁は壁、内側は確率で壁/床
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const edge = x < 2 || y < 2 || x >= w - 2 || y >= h - 2;
    level.set(x, y, (edge || rng.chance(wallProb)) ? T.WALL : T.FLOOR);
  }

  // 4-5 規則のセルオートマトン
  for (let s = 0; s < steps; s++) {
    const next = new Int16Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = level.wallCount(x, y, 1);
      const n2 = wallCount2(level, x, y);
      let wall;
      if (s < steps - 2) wall = n >= 5 || n2 <= 2;     // 序盤は遠くの空白も埋める
      else wall = n >= 5;                               // 終盤は近傍だけで整える
      const edge = x < 1 || y < 1 || x >= w - 1 || y >= h - 1;
      next[y * w + x] = (edge || wall) ? T.WALL : T.FLOOR;
    }
    level.tiles = next;
  }

  // ひとつながりの島だけ残す
  const region = level.keepLargestRegion();

  // 広間をいくつか彫って、行き止まりだらけにしない
  const halls = opts.halls ?? rng.range(1, 3);
  for (let i = 0; i < halls && region.length; i++) {
    const c = rng.pick(region);
    const r = rng.range(2, 4);
    for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) {
      if (!level.inBounds(x, y) || x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      if ((x - c.x) ** 2 + (y - c.y) ** 2 <= r * r) level.set(x, y, T.FLOOR);
    }
  }

  level.theme = 'cave';
  level.meta.rooms = [];
  return region;
}

/* 半径 2 の壁の数（大きな空洞をつぶす規則に使う） */
function wallCount2(level, x, y) {
  let n = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue;
    if (!level.inBounds(x + dx, y + dy) || level.get(x + dx, y + dy) === T.WALL) n++;
  }
  return n;
}
