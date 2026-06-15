/* ============================================================
   窟 — 棲みつき。階に魔物と宝を配る。深いほど多く、強い。
   群れは固まって湧き、まれにヌシが待つ。護符は最深に眠る。
   ============================================================ */

import { monstersForDepth, allMonsters } from './monsterdb.js';
import { makeMonster, makeItem, randomItemForDepth, makeGold } from './factory.js';
import { isStairs } from './tile.js';
import { chebyshev } from './util.js';

export const FINAL_DEPTH = 15;

/* 入口から十分離れた、空いた歩けるマス */
function spawnSpot(game, board, rng, minFromEntrance = 6, tries = 60) {
  const ent = board.level.entrance;
  for (let i = 0; i < tries; i++) {
    const p = board.level.randomFloor(rng);
    if (!p) break;
    if (board.actorAt(p.x, p.y)) continue;
    if (isStairs(board.level.get(p.x, p.y))) continue;
    if (ent && chebyshev(p.x, p.y, ent.x, ent.y) < minFromEntrance) continue;
    return p;
  }
  return board.level.randomFloor(rng);
}

export function populate(game, board, rng, depth) {
  const pool = monstersForDepth(depth);
  // 数：階の広さと深さに応じる
  const floorCount = board.level.meta.floorCount || 400;
  const base = Math.round(floorCount / 55) + Math.floor(depth * 0.6);
  const count = Math.max(3, base + rng.range(-1, 3));

  let placed = 0, guard = 0;
  while (placed < count && guard++ < count * 6) {
    const def = rng.weighted(pool, d => d.rarity);
    if (!def) break;
    const spot = spawnSpot(game, board, rng);
    if (!spot) break;
    const m = makeMonster(rng, def.key, spot.x, spot.y);
    board.addActor(m);
    placed++;
    // 群れ
    if (def.packMin) {
      const extra = rng.range(def.packMin - 1, def.packMax - 1);
      for (let k = 0; k < extra; k++) {
        const near = board.freeNear(spot.x + rng.range(-2, 2), spot.y + rng.range(-2, 2), rng, 3);
        if (near && !board.actorAt(near.x, near.y)) { board.addActor(makeMonster(rng, def.key, near.x, near.y)); placed++; }
      }
    }
  }

  // ヌシ（まれ）
  const bosses = allMonsters().filter(m => m.boss && depth >= m.depth[0] && depth <= m.depth[1]);
  if (bosses.length && rng.oneIn(7)) {
    const b = rng.pick(bosses);
    const spot = spawnSpot(game, board, rng, 8);
    if (spot) {
      const m = makeMonster(rng, b.key, spot.x, spot.y);
      m.flags.sleeping = true;
      board.addActor(m);
      game.chronicle.record(game.player.turns, depth, 'boss', `第 ${depth} 階に${m.name}が潜んでいた。`);
    }
  }

  // 宝
  const items = Math.max(2, Math.round(floorCount / 120) + rng.range(1, 3));
  for (let i = 0; i < items; i++) {
    const spot = spawnSpot(game, board, rng, 3);
    if (!spot) continue;
    if (rng.chance(0.28)) board.addItem(makeGold(rng, depth), spot.x, spot.y);
    else { const it = randomItemForDepth(rng, depth); if (it) board.addItem(it, spot.x, spot.y); }
  }

  // 護符（最深）
  if (depth >= FINAL_DEPTH && !game.flags.amuletPlaced) {
    const spot = board.level.stairsDown || spawnSpot(game, board, rng, 10);
    const am = makeItem(rng, 'amulet');
    board.addItem(am, spot.x, spot.y);
    game.flags.amuletPlaced = true;
    game.chronicle.record(game.player.turns, depth, 'find', `第 ${depth} 階に「窟の護符」が眠っていた。`);
  }

  return placed;
}
