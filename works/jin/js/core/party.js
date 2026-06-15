/* ============================================================
   陣 — 編成。荷駄と各人の持ち物をやりとりし、得物を持ち替え、
   雫（能力上昇）を使い、機が来れば上級へ転職する。コアは DOM 非依存。
   ============================================================ */

import { item as itemDef } from './items.js';
import { classDef, classCaps } from './classes.js';
import { canUse, autoEquip, promote, createUnit, isAlive } from './unit.js';
import { capStats } from './stats.js';
import { RNG } from './rng.js';

export const MAX_ITEMS = 5;

/* 荷駄 → 兵の持ち物（空きがあれば） */
export function giveItem(game, unit, convoyIndex) {
  if (unit.items.length >= MAX_ITEMS) return false;
  const id = game.convoy[convoyIndex];
  if (id == null) return false;
  const d = itemDef(id);
  unit.items.push({ id, uses: d && d.uses ? d.uses : null });
  game.convoy.splice(convoyIndex, 1);
  if (unit.equipped < 0) autoEquip(unit);
  return true;
}
/* 兵の持ち物 → 荷駄 */
export function takeItem(game, unit, itemIndex) {
  const st = unit.items[itemIndex];
  if (!st) return false;
  game.convoy.push(st.id);
  unit.items.splice(itemIndex, 1);
  if (unit.equipped === itemIndex) autoEquip(unit);
  else if (unit.equipped > itemIndex) unit.equipped--;
  return true;
}
/* 得物を持ち替える（扱えるものだけ） */
export function equipItem(unit, itemIndex) {
  const st = unit.items[itemIndex];
  const it = st && itemDef(st.id);
  if (!it || it.kind !== 'weapon' || !canUse(unit, it)) return false;
  unit.equipped = itemIndex;
  return true;
}
/* 装飾を着ける／外す（荷駄から） */
export function equipAccessory(game, unit, convoyIndex) {
  const id = game.convoy[convoyIndex];
  const it = id && itemDef(id);
  if (!it || it.kind !== 'accessory') return false;
  if (unit.accessory) game.convoy.push(unit.accessory);     // 付け替えは元を荷駄へ
  unit.accessory = id;
  game.convoy.splice(convoyIndex, 1);
  return true;
}

/* 雫など能力上昇の品（恒久）を使う */
export function useBooster(game, unit, convoyIndex) {
  const id = game.convoy[convoyIndex];
  const it = id && itemDef(id);
  if (!it || it.kind !== 'booster') return false;
  const caps = classCaps(unit.classId);
  if (it.stat === 'hp') { unit.statsBase.hp += it.amount; unit.maxHp = unit.statsBase.hp; unit.hp += it.amount; }
  else {
    unit.statsBase[it.stat] = Math.min((caps[it.stat] ?? 99), (unit.statsBase[it.stat] | 0) + it.amount);
  }
  unit.statsBase = capStats(unit.statsBase, { ...caps, hp: 99 });
  unit.maxHp = unit.statsBase.hp;
  game.convoy.splice(convoyIndex, 1);
  return true;
}

/* 上級転職できるか（Lv10 以上で転職先がある） */
/* ---- 斡旋（雇用）と解雇 ---- */
const HIRE_POOL = ['soldier', 'mercenary', 'fighter', 'archer', 'cavalier', 'knight', 'mage', 'monk', 'cleric', 'thief', 'pegasus'];
const HIRE_NAMES = ['ベルク', 'ナタ', 'ロイ', 'エマ', 'ティム', 'サラ', 'ゴウ', 'ミナ', 'レフ', 'クルト', 'アヤ', 'ダン', 'ノヴァ', 'リコ', 'ハル', 'ユーリ', 'メル', 'ガイ', 'セシル', 'トト'];
const HIRE_WEAPON = { soldier: 'iron_lance', mercenary: 'iron_sword', fighter: 'iron_axe', archer: 'iron_bow', cavalier: 'iron_lance', knight: 'iron_lance', mage: 'fire', monk: 'lightning', cleric: 'heal', thief: 'iron_dagger', pegasus: 'iron_lance' };

/* 章ごとの斡旋名簿（種から決定的・各候補は一度だけ雇える） */
export function hireRoster(game, chapterIndex = game.chapterIndex) {
  const rng = new RNG((game.seed ^ 0x9e3779b9 ^ Math.imul(chapterIndex + 1, 2246822519)) >>> 0);
  const lv = Math.max(1, Math.round(game.party.reduce((s, u) => s + u.level, 0) / Math.max(1, game.party.length)));
  const out = [];
  for (let i = 0; i < 4; i++) {
    const cr = rng.derive('h' + i);
    const classId = cr.pick(HIRE_POOL);
    const level = Math.max(1, lv + cr.range(-2, 2));
    out.push({
      id: `h${chapterIndex}_${i}`, name: cr.pick(HIRE_NAMES), classId, level,
      items: [HIRE_WEAPON[classId] || 'iron_sword', 'vulnerary'],
      cost: 700 + level * 180,
    });
  }
  return out;
}
export function canHire(game, cand) {
  return !(game.hired || []).includes(cand.id) && game.gold >= cand.cost && game.party.length < 16;
}
export function hire(game, cand) {
  if (!canHire(game, cand)) return null;
  game.gold -= cand.cost;
  (game.hired = game.hired || []).push(cand.id);
  const u = createUnit({ ...cand, side: 'player', bio: '斡旋所で雇い入れた者。' }, game.rng.derive('hired:' + cand.id));
  game.party.push(u);
  return u;
}
export function canDismiss(game, unit) {
  return !unit.isLord && isAlive(unit) && game.party.filter(isAlive).length > 1;
}
export function dismiss(game, unit) {
  if (!canDismiss(game, unit)) return false;
  const i = game.party.indexOf(unit);
  if (i < 0) return false;
  for (const it of unit.items) game.convoy.push(it.id);   // 持ち物は荷駄へ返す
  game.party.splice(i, 1);
  return true;
}

export function canPromote(unit) {
  const cd = classDef(unit.classId);
  return !!(cd.promotesTo && cd.promotesTo.length && unit.level >= 10);
}
export function promotionOptions(unit) {
  const cd = classDef(unit.classId);
  return canPromote(unit) ? cd.promotesTo.slice() : [];
}
export function doPromote(unit, toClassId) {
  if (!canPromote(unit)) return false;
  return promote(unit, toClassId);
}
