/* ============================================================
   窟 — 持ち物と装備。鞄に詰め、重ね、身につけ、外す。
   呪われた品は外せない（解呪するまで）。
   ============================================================ */

import { getItemDef } from './itemdb.js';

export const SLOTS = ['weapon', 'armor', 'shield', 'helm', 'boots', 'cloak', 'ring', 'ring2'];
const SLOT_NAME = { weapon: '武器', armor: '鎧', shield: '盾', helm: '兜', boots: '靴', cloak: '外套', ring: '指輪', ring2: '指輪(2)' };
export const slotName = s => SLOT_NAME[s] || s;

/* 鞄に入れる（重ねられるものは重ねる）。入った Item を返す。 */
export function addToInv(actor, item, cap = 26) {
  if (item.stackable) {
    const same = actor.inv.find(i => i.def === item.def && i.identified === item.identified && i.enchant === item.enchant);
    if (same) { same.count += item.count; return same; }
  }
  if (actor.inv.length >= cap) return null;
  item.x = item.y = 0;
  actor.inv.push(item);
  return item;
}

/* 鞄から減らす（count 個）。0 になったら取り除く。 */
export function removeFromInv(actor, item, count = 1) {
  if (item.stackable && item.count > count) { item.count -= count; return item.clone(count); }
  const i = actor.inv.indexOf(item);
  if (i >= 0) actor.inv.splice(i, 1);
  return item;
}

/* 装備の合計補正（stats へ足す） */
export function equipBonus(actor) {
  const b = { str: 0, def: 0, acc: 0, eva: 0, regen: 0 };
  const resist = {};
  for (const slot of SLOTS) {
    const it = actor.equip[slot];
    if (!it) continue;
    const d = it.d;
    if (d.category === 'armor') { b.def += (d.defense || 0) + it.enchant; b.eva += d.eva || 0; }
    if (d.category === 'weapon') { b.acc += (d.acc || 0) + it.enchant; }
    if (d.category === 'ring' && d.passive) {
      for (const [k, v] of Object.entries(d.passive)) {
        if (k === 'resistFire') resist.fire = v;
        else b[k] = (b[k] || 0) + v + (k === 'def' || k === 'str' || k === 'acc' || k === 'eva' ? it.enchant : 0);
      }
    }
  }
  b.resist = resist;
  return b;
}

/* いま着ている武器のダメージ仕様（無ければ素手） */
export function weaponDamage(actor) {
  const w = actor.equip.weapon;
  if (w) { const d = w.d; return { damage: d.damage, enchant: w.enchant, reach: !!d.reach }; }
  return { damage: actor.naturalDamage, enchant: 0, reach: false };
}

/* 装備する。空いた slot を探し、呪い判定し、入れ替えた品を返す。 */
export function equipItem(actor, item) {
  const d = item.d;
  let slot = d.slot;
  if (!slot) return { ok: false, msg: 'それは身につけられない。' };
  if (slot === 'ring' && actor.equip.ring && !actor.equip.ring2) slot = 'ring2';
  const prev = actor.equip[slot];
  if (prev && prev.cursed) return { ok: false, msg: `${prev.displayName()}は呪われていて外せない。` };
  // 鞄から出して装備
  const idx = actor.inv.indexOf(item);
  if (idx >= 0) actor.inv.splice(idx, 1);
  actor.equip[slot] = item;
  if (prev) actor.inv.push(prev);
  return { ok: true, slot, replaced: prev, cursed: item.cursed };
}

/* 外す。呪われていたら外せない。 */
export function unequip(actor, slot) {
  const it = actor.equip[slot];
  if (!it) return { ok: false, msg: '何も着けていない。' };
  if (it.cursed) return { ok: false, msg: `${it.displayName()}は呪われていて外せない。` };
  actor.equip[slot] = null;
  actor.inv.push(it);
  return { ok: true, item: it };
}

export function isEquipped(actor, item) {
  return Object.values(actor.equip).some(it => it === item);
}

export { getItemDef };
