/* ============================================================
   陣 — 編成。荷駄と各人の持ち物をやりとりし、得物を持ち替え、
   雫（能力上昇）を使い、機が来れば上級へ転職する。コアは DOM 非依存。
   ============================================================ */

import { item as itemDef } from './items.js';
import { classDef, classCaps } from './classes.js';
import { canUse, autoEquip, promote } from './unit.js';
import { capStats } from './stats.js';

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
