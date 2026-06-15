/* ============================================================
   窟 — 棲みつき。階に魔物と宝を配る。深いほど多く、強い。
   群れは固まって湧き、まれにヌシが待つ。護符は最深に眠る。
   ============================================================ */

import { monstersForDepth, allMonsters } from './monsterdb.js';
import { makeMonster, makeItem, randomItemForDepth, makeGold } from './factory.js';
import { itemKeysByCategory, getItemDef } from './itemdb.js';
import { isStairs } from './tile.js';
import { chebyshev } from './util.js';
import { vaultsForDepth, stampVault } from './gen/vault.js';
import { ensureConnected } from './gen/connect.js';

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

/* 深さに合う武具・薬の鍵をひとつ（カテゴリ指定） */
function itemKeyOfCat(rng, cat, depth) {
  const keys = itemKeysByCategory(cat).filter(k => { const d = getItemDef(k); return d.depth && d.depth <= depth + 1 && d.rarity > 0; });
  if (!keys.length) return null;
  return rng.weighted(keys, k => getItemDef(k).rarity);
}
/* vault の階級に合う魔物 */
function vaultMonster(rng, depth, tier) {
  if (tier === 'boss') {
    const bosses = allMonsters().filter(m => m.boss && depth >= m.depth[0] - 2);
    if (bosses.length) return rng.pick(bosses).key;
    const tough = monstersForDepth(depth + 3).sort((a, b) => b.hp - a.hp);
    return (tough[0] || monstersForDepth(depth)[0]).key;
  }
  const pool = monstersForDepth(tier === 'tough' ? depth + 2 : depth);
  if (!pool.length) return 'rat';
  const filt = tier === 'tough' ? pool.filter(m => m.hp >= 12) : pool.filter(m => m.hp <= 12);
  const use = (filt.length ? filt : pool);
  return rng.weighted(use, m => m.rarity).key;
}

/* vault の中身を湧かせる */
function spawnVaultContents(game, board, rng, depth, result) {
  for (const s of result.spawns) {
    if (s.type === 'gold') board.addItem(makeGold(rng, depth + 2), s.x, s.y);
    else if (s.type === 'item') {
      const key = s.cat ? itemKeyOfCat(rng, s.cat, depth) : null;
      const it = key ? makeItem(rng, key, { depth: depth + 1 }) : randomItemForDepth(rng, depth + 1);
      if (it) board.addItem(it, s.x, s.y);
    } else if (s.type === 'monster') {
      if (board.actorAt(s.x, s.y)) continue;
      const m = makeMonster(rng, vaultMonster(rng, depth, s.tier), s.x, s.y);
      m.flags.sleeping = true;
      board.addActor(m);
    }
  }
}

/* まれに特殊部屋を埋め込む */
function maybeVault(game, board, rng, depth) {
  if (!rng.chance(0.55)) return;
  const pool = vaultsForDepth(depth);
  if (!pool.length) return;
  const v = rng.weighted(pool, x => x.rarity);
  const res = stampVault(board.level, rng, v, { avoid: [board.level.entrance, board.level.stairsDown, board.level.stairsUp].filter(Boolean) });
  if (!res) return;
  // 連結だけ取り直す（領域は消さない＝プレイヤーや階段を切り離さない）
  ensureConnected(board.level, rng);
  board.level.meta.floorCount = board.level.findTiles((c, x, y) => board.level.walkable(x, y)).length;
  spawnVaultContents(game, board, rng, depth, res);
  const names = { treasure: '宝物庫', prison: '牢', shrine: '祠', library: '書庫', crypt: '墓室', pool: '水盤の間', pillars: '列柱の広間', guard: '守りの間', oubliette: '落とし穴の間' };
  game.chronicle.record(game.player ? game.player.turns : 0, depth, 'find', `第 ${depth} 階に〈${names[res.id] || res.id}〉があった。`);
}

export function populate(game, board, rng, depth) {
  maybeVault(game, board, rng, depth);
  const pool = monstersForDepth(depth);
  // 数：階の広さと深さに応じる
  const floorCount = board.level.meta.floorCount || 400;
  const base = Math.round(floorCount / 95) + Math.floor(depth * 0.5);
  const count = Math.max(3, base + rng.range(-1, 2));

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
