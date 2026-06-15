/* ============================================================
   窟 — 装飾。彫り上がった地形に、扉・罠・水・草・像・階段を置く。
   どれも種から決まる。同じ種なら、同じ場所に同じ泉が湧く。
   ============================================================ */

import { T, isStairs } from '../tile.js';
import { dijkstraMap, farthestCell } from '../pathfind.js';
import { carveDisc } from './carve.js';

/* 通路と部屋の境目（くびれ）に扉を置く。 */
export function placeDoors(level, rng, opts = {}) {
  const prob = opts.prob ?? 0.6;
  const secretProb = opts.secretProb ?? 0.08;
  for (let y = 1; y < level.h - 1; y++) for (let x = 1; x < level.w - 1; x++) {
    const c = level.get(x, y);
    if (c !== T.FLOOR && c !== T.CORRIDOR) continue;
    if (isDoorway(level, x, y)) {
      if (!rng.chance(prob)) continue;
      level.set(x, y, rng.chance(secretProb) ? T.DOOR_SECRET : T.DOOR_CLOSED);
    }
  }
}

/* くびれ判定：上下が壁・左右が床、またはその逆（一マスの通り道） */
function isDoorway(level, x, y) {
  const N = level.get(x, y - 1) === T.WALL, S = level.get(x, y + 1) === T.WALL;
  const E = level.get(x + 1, y) === T.WALL, W = level.get(x - 1, y) === T.WALL;
  const open = c => level.walkable(...c) && !level.prop(...c).door;
  const horiz = N && S && open([x - 1, y]) && open([x + 1, y]);
  const vert = E && W && open([x, y - 1]) && open([x, y + 1]);
  // 斜めに開けていると扉として不自然なので、四隅のいずれかが壁であることを要求
  return (horiz || vert);
}

/* 上り階段（入口）と下り階段（最遠点）を置く。 */
export function placeStairs(level, rng, opts = {}) {
  // 入口：既定は無作為な床。深さ>1 なら上り階段を置く。
  let entrance = level.entrance;
  if (!entrance) {
    entrance = level.randomFloor(rng);
    level.entrance = entrance;
  }
  if (opts.upStairs !== false && level.depth > 1) {
    level.set(entrance.x, entrance.y, T.STAIRS_UP);
    level.stairsUp = { x: entrance.x, y: entrance.y };
  }
  // 下り階段：入口からいちばん遠い歩けるセル
  const dist = dijkstraMap(level, [entrance], (x, y) => level.walkable(x, y));
  const far = farthestCell(dist, level) || level.randomFloor(rng);
  if (far) {
    level.set(far.x, far.y, T.STAIRS_DOWN);
    level.stairsDown = { x: far.x, y: far.y };
  }
  return { entrance, down: far };
}

/* 罠を撒く（深さで増える）。床に紛れる。 */
export function placeTraps(level, rng, depth) {
  const n = Math.max(0, rng.range(0, 2) + Math.floor(depth / 2));
  let placed = 0, guard = 0;
  while (placed < n && guard++ < n * 40) {
    const p = level.randomFloor(rng);
    if (!p) break;
    const c = level.get(p.x, p.y);
    if (c !== T.FLOOR && c !== T.CORRIDOR) continue;
    if (nearStairs(level, p.x, p.y)) continue;
    level.set(p.x, p.y, T.TRAP);
    placed++;
  }
  return placed;
}

function nearStairs(level, x, y) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
    if (isStairs(level.get(x + dx, y + dy))) return true;
  return false;
}

/* 地形の彩り：水たまり・溶岩・草地・瓦礫・苔。テーマと深さで変わる。 */
export function decorateTerrain(level, rng, opts = {}) {
  const theme = level.theme;
  const depth = level.depth;

  // 水・溶岩はセルオートマトン風の塊で
  if (opts.water ?? rng.chance(theme === 'cave' ? 0.6 : 0.3)) {
    blob(level, rng, T.WATER, rng.range(2, 5), p => level.get(p.x, p.y) === T.FLOOR);
  }
  if ((opts.lava ?? (depth >= 4 && rng.chance(0.35)))) {
    blob(level, rng, T.LAVA, rng.range(1, 3), p => level.get(p.x, p.y) === T.FLOOR);
  }
  if (opts.grass ?? rng.chance(0.5)) {
    blob(level, rng, theme === 'cave' ? T.MOSS : T.GRASS, rng.range(2, 6), p => level.get(p.x, p.y) === T.FLOOR);
  }
  // 瓦礫を点々と
  const rubble = rng.range(0, 8);
  for (let i = 0; i < rubble; i++) { const p = level.randomFloor(rng); if (p && level.get(p.x, p.y) === T.FLOOR) level.set(p.x, p.y, T.RUBBLE); }

  // 像・泉・祭壇はまれ
  if (rng.chance(0.25)) feature(level, rng, T.STATUE);
  if (rng.chance(0.18)) feature(level, rng, T.FOUNTAIN);
  if (rng.chance(0.10)) feature(level, rng, T.ALTAR);
}

/* 種から塊を撒く（小さな丸を数個） */
function blob(level, rng, tile, count, ok) {
  for (let i = 0; i < count; i++) {
    const p = level.randomFloor(rng);
    if (!p) continue;
    const r = rng.range(1, 3);
    for (let y = p.y - r; y <= p.y + r; y++) for (let x = p.x - r; x <= p.x + r; x++) {
      if (!level.inBounds(x, y)) continue;
      if ((x - p.x) ** 2 + (y - p.y) ** 2 > r * r) continue;
      if (ok({ x, y }) && rng.chance(0.8)) level.set(x, y, tile);
    }
  }
}

function feature(level, rng, tile) {
  for (let i = 0; i < 30; i++) {
    const p = level.randomFloor(rng);
    if (!p) return;
    if (level.get(p.x, p.y) === T.FLOOR && !nearStairs(level, p.x, p.y)) { level.set(p.x, p.y, tile); return; }
  }
}
