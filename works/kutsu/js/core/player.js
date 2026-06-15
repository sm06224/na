/* ============================================================
   窟 — 潜る者。経験で強くなり、腹が減り、深みをめざす。
   始まりの装備はささやか。すべては種で決まる。
   ============================================================ */

import { Actor } from './entity.js';
import { makeItem } from './factory.js';
import { addToInv, equipItem } from './inventory.js';
import { getClass } from './classes.js';

export const HUNGER = { FULL: 1200, HUNGRY: 150, FAINT: 0, START: 900, MAX: 1500 };

export function makePlayer(rng, classKey = 'warrior', name = '潜る者') {
  const cls = getClass(classKey);
  const p = new Actor({
    name, glyph: '@', color: '#ffe9a8', faction: 'player',
    maxhp: cls.hp, hp: cls.hp,
    stats: { ...cls.stats },
    sight: 8, energy: 100,
  });
  p.cls = cls.key; p.clsName = cls.name;
  p.xp = 0; p.level = 1; p.nextXP = xpForLevel(2);
  p.hunger = HUNGER.START;
  p.depthMax = 1;
  p.gold = 0; p.kills = 0; p.turns = 0;
  p.maxFocus = cls.focus; p.focus = cls.focus;
  p.abilities = cls.abilities.slice();

  // 始まりの装備
  for (const [key, ench] of cls.kit) {
    const it = makeItem(rng, key, { enchant: ench });
    addToInv(p, it); equipItem(p, it);
  }
  const ration = makeItem(rng, 'f_ration'); ration.count = 2; addToInv(p, ration);
  const heal = makeItem(rng, 'p_heal'); heal.count = cls.potions || 2; addToInv(p, heal);
  if (cls.scrolls) { const s = makeItem(rng, 's_identify'); s.count = cls.scrolls; addToInv(p, s); }
  return p;
}

/* 気力は数手ごとに少し戻る */
export function regenFocus(p) {
  if (p.focus < p.maxFocus && p.turns % 3 === 0) p.focus = Math.min(p.maxFocus, p.focus + 1);
}

export function xpForLevel(lvl) { return Math.round(18 * Math.pow(lvl - 1, 1.85)); }

/* 経験を得て、足りれば成長する。messages を返す。 */
export function gainXP(p, amount) {
  const msgs = [];
  p.xp += amount;
  while (p.xp >= p.nextXP) {
    p.level++;
    const hpGain = 4 + Math.floor(p.level / 2);
    p.maxhp += hpGain; p.hp += hpGain;
    if (p.level % 2 === 0) p.stats.acc += 1;
    if (p.level % 3 === 0) { p.stats.str += 1; }
    if (p.level % 4 === 0) p.stats.eva += 1;
    p.nextXP = xpForLevel(p.level + 1);
    msgs.push(`成長した！ レベル ${p.level}（最大HP +${hpGain}）`);
  }
  return msgs;
}

/* 一手ごとに腹が減る。閾値の知らせと、餓えのダメージを返す。 */
export function tickHunger(p, cost = 1) {
  const before = p.hunger;
  p.hunger = Math.max(-50, p.hunger - cost);
  const events = [];
  if (before > HUNGER.HUNGRY && p.hunger <= HUNGER.HUNGRY) events.push({ msg: '腹が減ってきた。' });
  if (before > HUNGER.FAINT && p.hunger <= HUNGER.FAINT) events.push({ msg: '飢えで目がくらむ……！' });
  if (p.hunger < HUNGER.FAINT && (p.hunger % 6 === 0)) events.push({ starve: 1 });
  return events;
}

export function eat(p, item) {
  const nut = item.d.nutrition || 100;
  p.hunger = Math.min(HUNGER.MAX, p.hunger + nut);
  return p.hunger >= HUNGER.FULL ? '満腹だ。' : 'ひと心地ついた。';
}

export function hungerWord(p) {
  if (p.hunger < HUNGER.FAINT) return '飢餓';
  if (p.hunger < HUNGER.HUNGRY) return '空腹';
  if (p.hunger >= HUNGER.FULL) return '満腹';
  return '';
}
