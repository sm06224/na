/* ============================================================
   窟 — 階を建てる。深さに応じて彫り方を選び、繋ぎ、装飾し、階段を据える。
   すべては rng（種から分けた流れ）の純粋関数。同じ深さ・同じ種なら同じ階。
   ============================================================ */

import { Level } from '../level.js';
import { T } from '../tile.js';
import { genRooms } from './rooms.js';
import { genCave } from './cave.js';
import { genBSP } from './bsp.js';
import { genMaze } from './maze.js';
import { ensureConnected } from './connect.js';
import { placeDoors, placeStairs, placeTraps, decorateTerrain } from './decorate.js';

export const GENERATORS = { rooms: genRooms, cave: genCave, bsp: genBSP, maze: genMaze };

/* 深さごとの彫り方の傾き（重み） */
function themeWeights(depth) {
  if (depth <= 2) return { rooms: 5, bsp: 3, cave: 2 };
  if (depth <= 5) return { cave: 5, rooms: 3, bsp: 2, maze: 1 };
  if (depth <= 9) return { cave: 4, bsp: 3, maze: 2, rooms: 2 };
  return { cave: 4, maze: 3, bsp: 2, rooms: 1 };
}

/* 階の大きさ（深いほど少しずつ広く・上限つき） */
function levelSize(depth, rng) {
  const w = Math.min(84, 56 + depth * 2 + rng.range(-2, 4));
  const h = Math.min(44, 30 + depth + rng.range(-1, 3));
  return { w, h };
}

export function buildLevel(rng, depth, opts = {}) {
  const { w, h } = opts.size || levelSize(depth, rng);
  const level = new Level(w, h, depth);
  if (opts.entrance) level.entrance = { ...opts.entrance };

  const theme = opts.theme || rng.weightedKey(themeWeights(depth));
  const gen = GENERATORS[theme] || genRooms;
  gen(level, rng, opts.genOpts || {});

  ensureConnected(level, rng);
  level.keepLargestRegion();

  // 入口を、歩ける場所に正す（前の階の階段位置のヒントがあれば近くへ）
  if (!level.entrance || !level.walkable(level.entrance.x, level.entrance.y)) {
    level.entrance = nearestFloor(level, level.entrance) || level.randomFloor(rng);
  }

  decorateTerrain(level, rng, opts.terrain || {});
  placeDoors(level, rng, opts.doors || {});
  placeTraps(level, rng, depth);
  placeStairs(level, rng, opts.stairs || {});

  level.sealBorder();

  // 階段が万一塞がれていないか念のため確かめ、無ければ置き直す
  if (!level.stairsDown || !level.walkable(level.stairsDown.x, level.stairsDown.y)) {
    const p = level.randomFloor(rng);
    if (p) { level.set(p.x, p.y, T.STAIRS_DOWN); level.stairsDown = p; }
  }

  level.meta.floorCount = level.findTiles((c, x, y) => level.walkable(x, y)).length;
  level.meta.theme = theme;
  return level;
}

function nearestFloor(level, hint) {
  if (!hint) return null;
  let best = null, bd = Infinity;
  for (let y = 1; y < level.h - 1; y++) for (let x = 1; x < level.w - 1; x++) {
    if (!level.walkable(x, y)) continue;
    const d = (x - hint.x) ** 2 + (y - hint.y) ** 2;
    if (d < bd) { bd = d; best = { x, y }; }
  }
  return best;
}
