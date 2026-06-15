/* ============================================================
   窟 — 戦い。命中はおおむね腕（acc）対 身のこなし（eva）。
   傷は武器のさいころ ＋ 力 − 鎧。まれに会心。命中時に毒や吸いも。
   ============================================================ */

import { clamp } from './util.js';
import { weaponDamage, equipBonus } from './inventory.js';
import { applyStatus, statusName } from './status.js';

/* 実効ステータス（装備・状態異常を込み） */
export function effStats(actor) {
  const s = { ...actor.stats };
  if (actor.isPlayer || actor.equip) {
    const b = equipBonus(actor);
    s.str += b.str; s.def += b.def; s.acc += b.acc; s.eva += b.eva;
    actor._regen = b.regen || 0;
    actor._resist = Object.assign({}, actor.resist, b.resist);
  } else {
    actor._regen = actor.regen || 0;
    actor._resist = actor.resist || {};
  }
  if (actor.hasStatus('might')) s.str += 4;
  if (actor.hasStatus('blind')) s.acc -= 4;
  return s;
}

/* 命中確率：0.5 を基準に、腕と身のこなしの差で前後 */
export function hitChance(atk, def) {
  const a = effStats(atk), d = effStats(def);
  let p = 0.6 + 0.06 * (a.acc - d.eva);
  if (def.hasStatus('paralyze') || def.hasStatus('stun') || def.flags.sleeping) p = 1;
  return clamp(p, 0.1, 0.97);
}

/* 近接の一撃。結果（命中・ダメージ・倒したか・付与）を返す。 */
export function meleeAttack(game, atk, def) {
  const rng = game.rng;
  const res = { attacker: atk, defender: def, hit: false, crit: false, damage: 0, killed: false, statuses: [] };
  if (!rng.chance(hitChance(atk, def))) {
    res.miss = true;
    return res;
  }
  res.hit = true;
  const a = effStats(atk);
  const wd = atk.isPlayer || atk.equip ? weaponDamage(atk) : { damage: atk.naturalDamage, enchant: 0 };
  let dmg = rng.dice(wd.damage) + (wd.enchant || 0) + Math.floor(a.str / 2);
  // 会心（1/16）：傷が増える
  if (rng.oneIn(16)) { res.crit = true; dmg = Math.round(dmg * 1.6) + 2; }
  const d = effStats(def);
  dmg = Math.max(1, dmg - Math.max(0, d.def));
  res.damage = dmg;

  game.hurt(def, dmg, atk);
  res.killed = !def.alive;

  // 命中時の状態異常（魔物の牙の毒など）
  if (!res.killed && atk.defId) {
    const mdef = game.monsterDef(atk.defId);
    if (mdef && mdef.status && rng.chance(mdef.status.chance ?? 1)) {
      const st = mdef.status;
      if (st.type === 'drain') drainLife(game, atk, def, st.power);
      else { applyStatus(def, st.type, st.turns, st.power); res.statuses.push(st.type); }
    }
  }
  return res;
}

/* 生命を吸う（怨霊・吸血鬼）。最大HPを少し削り、術者を癒す。 */
export function drainLife(game, atk, def, power) {
  if (def.isPlayer) {
    def.maxhp = Math.max(1, def.maxhp - power);
    if (def.hp > def.maxhp) def.hp = def.maxhp;
    game.log(`${atk.name}に生気を吸われた！（最大HP −${power}）`);
  }
  atk.hp = Math.min(atk.maxhp, atk.hp + power * 2);
}

/* 遠隔・術の一撃（命中は当たりやすめ、属性耐性を見る） */
export function rangedHit(game, atk, def, spec) {
  const rng = game.rng;
  const res = { hit: true, damage: 0, killed: false, element: spec.element };
  let dmg = rng.dice(spec.damage);
  if (spec.element && def._resist && def._resist[spec.element]) {
    dmg = Math.max(1, Math.round(dmg * (1 - def._resist[spec.element])));
  } else if (spec.element && def.resist && def.resist[spec.element]) {
    dmg = Math.max(1, Math.round(dmg * (1 - def.resist[spec.element])));
  }
  const d = effStats(def);
  if (!spec.element) dmg = Math.max(1, dmg - Math.floor(d.def / 2));   // 純粋な魔法は鎧を半分無視
  res.damage = dmg;
  game.hurt(def, dmg, atk);
  res.killed = !def.alive;
  return res;
}
