/* ============================================================
   陣 — 敵を、種から湧かせる。難度に応じて職と得物を選び、配する。
   ボスは強く、名を持ち、持ち場（玉座）を守る。
   ============================================================ */

import { createUnit } from './unit.js';
import { classDef } from './classes.js';

const WEAPON_BY_TYPE = {
  sword: ['iron_sword', 'steel_sword', 'silver_sword'],
  lance: ['iron_lance', 'steel_lance', 'silver_lance'],
  axe: ['iron_axe', 'steel_axe', 'silver_axe'],
  bow: ['iron_bow', 'steel_bow', 'silver_bow'],
  anima: ['fire', 'elfire', 'bolting'],
  light: ['lightning', 'shine', 'purge'],
  dark: ['flux', 'nosferatu'],
  staff: ['heal', 'mend', 'recover'],
  dagger: ['iron_dagger', 'iron_dagger'],
  fist: ['steel_knuckle', 'steel_knuckle'],
};

/* 難度の浅い→深いで湧く職 */
const POOL_EARLY = ['brigand', 'soldier', 'fighter', 'archer', 'mercenary'];
const POOL_MID = ['soldier', 'fighter', 'archer', 'mercenary', 'cavalier', 'knight', 'mage', 'thief'];
const POOL_LATE = ['mercenary', 'cavalier', 'knight', 'mage', 'shaman', 'pegasus', 'wyvern', 'archer', 'soldier'];
const POOL_MONSTER = ['revenant', 'gargoyle', 'mogall', 'brigand'];

function poolFor(chapter, monster) {
  if (monster) return POOL_MONSTER;
  if (chapter <= 2) return POOL_EARLY;
  if (chapter <= 6) return POOL_MID;
  return POOL_LATE;
}

function mainType(classId) {
  const w = classDef(classId).weapons || {};
  return Object.keys(w)[0] || 'sword';
}
function weaponFor(classId, tier, rng) {
  const t = mainType(classId);
  const list = WEAPON_BY_TYPE[t] || ['iron_sword'];
  const idx = Math.min(list.length - 1, tier);
  // たまに一段下の得物（ばらつき）
  const pick = rng.chance(0.25) ? Math.max(0, idx - 1) : idx;
  return list[pick];
}

/* 敵の一群を生成して board に置く。返り値は置いたユニット配列。 */
export function generateEnemies(rng, board, spawns, opts = {}) {
  const chapter = opts.chapter || 1;
  const level = opts.level || (3 + chapter * 2);
  const monster = !!opts.monster;
  const pool = poolFor(chapter, monster);
  const units = [];
  const r = rng.derive('foe');
  for (let i = 0; i < spawns.length; i++) {
    const sp = spawns[i];
    const classId = r.derive('cls' + i).pick(pool);
    const cd = classDef(classId);
    const tier = chapter <= 4 ? 0 : (chapter <= 8 ? 1 : 2);
    const lv = Math.max(1, level + r.derive('lv' + i).range(-2, 2));
    const items = [weaponFor(classId, tier, r.derive('w' + i))];
    if (r.derive('vuln' + i).chance(0.3)) items.push('vulnerary');
    const u = createUnit({
      id: 'foe' + i, name: cd.name, classId, level: lv, side: 'enemy',
      items, pos: sp, aiKind: 'charge',
    }, r.derive('mk' + i));
    board.add(u, sp.x, sp.y);
    units.push(u);
  }
  return units;
}

/* ボスを一体、持ち場（anchor）に据える。 */
export function placeBoss(rng, board, spec) {
  const r = rng.derive('boss');
  const classId = spec.classId || 'commander';
  const cd = classDef(classId);
  const u = createUnit({
    id: 'boss', name: spec.name || cd.name, classId,
    level: spec.level || 12, side: 'enemy', boss: true,
    items: spec.items || [weaponFor(classId, 2, r)],
    pos: spec.pos, aiKind: 'boss', aiAnchor: spec.pos,
    statBoost: spec.statBoost || { hp: 8, def: 2, str: 2 },
    deathQuote: spec.deathQuote || 'ぐ……このわたしが……',
  }, r);
  board.add(u, spec.pos.x, spec.pos.y);
  return u;
}
