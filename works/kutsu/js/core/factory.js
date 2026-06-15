/* ============================================================
   窟 — 鋳型。名鑑（def）から、その場の一体・一個を生み出す。
   付呪や呪い、杖の残り、薬の本数——細部は種で決める。
   ============================================================ */

import { Actor } from './entity.js';
import { Item } from './item.js';
import { getMonster } from './monsterdb.js';
import { getItemDef, itemsForDepth } from './itemdb.js';

export function makeMonster(rng, key, x, y) {
  const d = getMonster(key);
  if (!d) return null;
  const hp = Math.max(1, d.hp + rng.range(-1, 2));
  const a = new Actor({
    x, y, name: d.name, glyph: d.glyph, color: d.color, faction: d.peaceful ? 'neutral' : 'monster', defId: key,
    maxhp: hp, hp,
    stats: { str: d.str, def: d.def, acc: d.acc, eva: d.eva, speed: d.speed },
    ai: d.ai, sight: d.sight, xpValue: d.xp, naturalDamage: d.damage,
    resist: d.resist || {}, tags: d.tags || [], drops: d.drops || null,
    flags: { sleeping: rng.chance(0.45), seen: false },
    energy: rng.range(0, 99),
  });
  a.ranged = d.ranged || null;
  a.spell = d.spell || null;
  a.spellPower = d.spellPower || null;
  a.spellRange = d.spellRange || 6;
  a.special = d.special || null;
  a.summonKey = d.summonKey || null;
  a.regen = d.regen || 0;
  a.boss = !!d.boss;
  a.peaceful = !!d.peaceful;
  a.packMin = d.packMin || 0; a.packMax = d.packMax || 0;
  return a;
}

export function rollEnchant(rng, depth) {
  const r = rng.next();
  if (r < 0.62) return 0;
  if (r < 0.80) return 1;
  if (r < 0.90) return 2;
  if (r < 0.95) return rng.range(3, 4);
  if (r < 0.985) return -1;       // たまに呪われた負の品
  return -2;
}

export function makeItem(rng, key, opts = {}) {
  const d = getItemDef(key);
  if (!d) return null;
  const it = new Item({ def: key, x: opts.x ?? 0, y: opts.y ?? 0 });
  if (d.enchantable) {
    it.enchant = opts.enchant ?? rollEnchant(rng, opts.depth || 1);
    if (it.enchant < 0) { it.cursed = true; }
    else if (rng.chance(0.08)) it.cursed = true;     // 見た目ふつうの呪い
  }
  if (d.category === 'wand') {
    const [lo, hi] = d.charges || [2, 5];
    it.charges = opts.charges ?? rng.range(lo, hi);
  }
  if (d.stackable) {
    if (d.category === 'potion' || d.category === 'scroll') it.count = opts.count ?? (rng.oneIn(4) ? rng.range(2, 3) : 1);
    else it.count = opts.count ?? 1;
  }
  return it;
}

export function makeGold(rng, depth) {
  const amount = rng.range(2, 8) + depth * rng.range(1, 5);
  return new Item({ def: 'gold', count: amount });
}

/* 深さに見合う落とし物をひとつ */
export function randomItemForDepth(rng, depth) {
  const pool = itemsForDepth(depth);
  if (!pool.length) return null;
  const d = rng.weighted(pool, x => x.rarity / (1 + Math.max(0, x.depth - depth) * 0.5));
  return makeItem(rng, d.key, { depth });
}

/* 倒したときの落とし物テーブル */
export function rollDrop(rng, table, depth) {
  if (!table) return null;
  const chance = { low: 0.18, mid: 0.28, high: 0.45 }[table] ?? 0.2;
  if (!rng.chance(chance)) return null;
  if (rng.chance(0.4)) return makeGold(rng, depth);
  return randomItemForDepth(rng, depth);
}
