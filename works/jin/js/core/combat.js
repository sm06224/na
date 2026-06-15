/* ============================================================
   陣 — 戦闘の算術。命中・会心・威力・追撃・反撃・三すくみ・地形・特効、
   そして閃き（技）の発動。すべて決定的（同じ盤面と種からは、同じ結果）。

   表示用に forecast()（予報）を、実処理に resolveCombat()（交戦）を返す。
   ============================================================ */

import { manhattan } from './grid.js';
import { effectiveStats, attackSpeed, equippedWeapon, hasSkill, isAlive } from './unit.js';
import { classDef } from './classes.js';
import { triangle } from './items.js';
import { rateOf } from './skills.js';
import { hasStatus, addStatus } from './status.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function doubleThresh(u) { return 4 - (hasSkill(u, 'quickblade') ? 1 : 0); }

export function effectiveTags(u) {
  const cd = classDef(u.classId);
  const tags = [u.mode];
  if (cd && cd.tags) tags.push(...cd.tags);
  return tags;
}

function loneBonus(u, board) {
  if (!board) return 0;
  let near = 0;
  for (const a of board.alliesOf(u)) if (a.pos && manhattan(a.pos, u.pos) <= 2) near++;
  return Math.max(0, 3 - near) * 8;
}

/* 片側の一撃ぶんの数値（src が tgt を打つ） */
export function strikeInfo(src, tgt, board) {
  const w = equippedWeapon(src);
  if (!w || w.wtype === 'staff') return null;
  const sa = effectiveStats(src), sd = effectiveStats(tgt);
  const magic = !!w.magic;
  const dw = equippedWeapon(tgt);
  const tri = dw ? triangle(w.wtype, dw.wtype) : { atk: 0, hit: 0 };

  let might = w.mt + tri.atk;
  const tags = effectiveTags(tgt);
  let eff = false;
  if (w.eff) for (const e of w.eff) if (tags.includes(e)) eff = true;
  if (eff) might += w.mt * 2;                       // 特効は威力三倍ぶん

  const atkStat = magic ? sa.mag : sa.str;
  const atk = atkStat + Math.max(0, might);
  const terr = (tgt.pos && board) ? board.terrainAt(tgt.pos.x, tgt.pos.y) : { def: 0, avo: 0 };
  const flierTgt = tgt.mode === 'fly';
  const terrDef = flierTgt ? 0 : (terr.def || 0);       // 飛行は地形の守りを受けない
  const terrAvo = flierTgt ? 0 : (terr.avo || 0);
  const defStat = (magic ? sd.res : sd.def) + terrDef;
  const dmg = Math.max(0, atk - defStat);

  const hitStat = w.hit + sa.skl * 2 + Math.floor(sa.lck / 2) + tri.hit;
  const avo = attackSpeed(tgt) * 2 + sd.lck + terrAvo;
  const hit = clamp(Math.round(hitStat - avo), 0, 100);

  let critStat = (w.crit || 0) + Math.floor(sa.skl / 2) + (classDef(src.classId).critBonus || 0);
  if (hasSkill(src, 'focus')) critStat += loneBonus(src, board);
  const crit = clamp(critStat - sd.lck, 0, 100);

  return { atk, dmg, hit, crit, magic, defStat, weapon: w, eff };
}

/* この間合いで src は tgt に届くか */
export function inAttackRange(src, tgt) {
  const w = equippedWeapon(src);
  if (!w || w.wtype === 'staff' || !src.pos || !tgt.pos) return false;
  const d = manhattan(src.pos, tgt.pos);
  return d >= w.min && d <= w.max;
}

/* 予報（UI 表示用）。攻撃側 a が、間合い dist から b を攻撃する想定。 */
export function forecast(a, b, board) {
  const ai = strikeInfo(a, b, board);
  if (!ai) return null;
  const dist = (a.pos && b.pos) ? manhattan(a.pos, b.pos) : 1;
  const counter = canCounter(b, a, dist) ? strikeInfo(b, a, board) : null;
  const aDouble = (attackSpeed(a) - attackSpeed(b)) >= doubleThresh(a) && !hasSkill(b, 'wary');
  const bDouble = counter && (attackSpeed(b) - attackSpeed(a)) >= doubleThresh(b) && !hasSkill(a, 'wary');
  return {
    atk: ai.atk, dmg: ai.dmg, hit: ai.hit, crit: ai.crit, doubles: aDouble, eff: ai.eff,
    counter: counter ? { dmg: counter.dmg, hit: counter.hit, crit: counter.crit, doubles: bDouble, eff: counter.eff } : null,
  };
}

export function canCounter(def, att, dist) {
  if (!isAlive(def)) return false;
  const w = equippedWeapon(def);
  if (!w || w.wtype === 'staff') return false;
  if (hasStatus(def, 'sleep') || hasStatus(def, 'freeze')) return false;
  return dist >= w.min && dist <= w.max;
}

/* 一撃を遂行（events を積み、HP を動かす）。 */
function performStrike(src, tgt, board, rng, events) {
  if (!isAlive(src) || !isAlive(tgt)) return;
  const info = strikeInfo(src, tgt, board);
  if (!info) return;
  const sleeping = hasStatus(tgt, 'sleep');
  const willHit = sleeping || rng.roll(info.hit);
  if (!willHit) { events.push({ type: 'miss', by: src.uid, tgt: tgt.uid }); return; }

  const nihil = hasSkill(tgt, 'nihil');
  let dmg = info.dmg;
  let drainFactor = 0;
  let lethal = false;
  let procId = null;
  let hits = 1;

  if (!nihil) {
    const order = ['lethality', 'astra', 'aether', 'luna', 'sol', 'pierce', 'colossus'];
    for (const id of order) {
      if (!hasSkill(src, id)) continue;
      if (!rng.roll(rateOf(id, src))) continue;
      procId = id;
      if (id === 'lethality') { if (!tgt.boss) lethal = true; }
      else if (id === 'astra') { hits = 5; dmg = Math.max(1, Math.floor(info.dmg * 0.5)); }
      else if (id === 'aether') { dmg = Math.max(0, info.atk - Math.floor(info.defStat / 2)); drainFactor = 0.5; }
      else if (id === 'luna') { dmg = Math.max(0, info.atk - Math.floor(info.defStat / 2)); }
      else if (id === 'sol') { drainFactor = 0.5; }
      else if (id === 'pierce') { dmg = info.atk; }
      else if (id === 'colossus') { dmg = Math.round(info.dmg * 1.5); }
      break;
    }
  }
  // 吸収武器（ノスフェラトゥ等）
  if (info.weapon.drain) drainFactor = Math.max(drainFactor, 1);

  const crit = sleeping || (!lethal && rng.roll(info.crit));
  if (procId) events.push({ type: 'skill', by: src.uid, id: procId });

  let total = 0;
  for (let h = 0; h < hits; h++) {
    if (!isAlive(tgt)) break;
    let d = dmg;
    if (crit) d *= 3;
    // 守りの閃き（被弾側）
    if (!hasSkill(src, 'nihil')) {
      const ranged = manhattan(src.pos, tgt.pos) > 1;
      if (ranged && hasSkill(tgt, 'aegis') && rng.roll(rateOf('aegis', tgt))) { d = Math.floor(d / 2); events.push({ type: 'skill', by: tgt.uid, id: 'aegis' }); }
      else if (!ranged && hasSkill(tgt, 'pavise') && rng.roll(rateOf('pavise', tgt))) { d = Math.floor(d / 2); events.push({ type: 'skill', by: tgt.uid, id: 'pavise' }); }
    }
    // 致命なら祈り
    if ((lethal || d >= tgt.hp)) {
      if (hasSkill(tgt, 'miracle') && tgt.hp > 1 && rng.roll(rateOf('miracle', tgt))) {
        d = tgt.hp - 1; lethal = false;
        events.push({ type: 'skill', by: tgt.uid, id: 'miracle' });
      }
    }
    if (lethal) { d = tgt.hp; }
    d = Math.max(0, d);
    tgt.hp = Math.max(0, tgt.hp - d);
    total += d;
    events.push({ type: crit ? 'crit' : 'hit', by: src.uid, tgt: tgt.uid, dmg: d, lethal: lethal && h === 0 });
    if (lethal) break;
  }

  // 吸収
  if (drainFactor > 0 && total > 0) {
    const heal = Math.min(src.maxHp - src.hp, Math.floor(total * drainFactor));
    if (heal > 0) { src.hp += heal; events.push({ type: 'drain', by: src.uid, amount: heal }); }
  }
  // 魔斧の反動
  if (info.weapon.backfire && rng.chance(info.weapon.backfire)) {
    const self = Math.max(0, info.dmg - effectiveStats(src).def);
    src.hp = Math.max(0, src.hp - Math.floor(self / 2));
    events.push({ type: 'backfire', by: src.uid, dmg: Math.floor(self / 2) });
  }
  // 射抜きの眠り
  if (procId === 'deadeye' && isAlive(tgt)) addStatus(tgt, 'sleep', 2);
  // 短剣の弱体
  if (info.weapon.debuff && isAlive(tgt)) {
    for (const k in info.weapon.debuff) {
      tgt.buffs[k] = { amt: (tgt.buffs[k]?.amt || 0) + info.weapon.debuff[k], turns: 2 };
    }
    events.push({ type: 'debuff', tgt: tgt.uid });
  }
}

/* 交戦：攻撃 → 反撃 → 追撃（順序は FE 風）。events と倒れた者を返す。 */
export function resolveCombat(att, def, board, rng) {
  const events = [];
  const dist = manhattan(att.pos, def.pos);
  performStrike(att, def, board, rng, events);
  if (isAlive(def) && canCounter(def, att, manhattan(att.pos, def.pos))) {
    performStrike(def, att, board, rng, events);
  }
  if (isAlive(att) && isAlive(def)) {
    const aDouble = (attackSpeed(att) - attackSpeed(def)) >= doubleThresh(att) && !hasSkill(def, 'wary');
    if (aDouble) performStrike(att, def, board, rng, events);
  }
  if (isAlive(att) && isAlive(def) && canCounter(def, att, dist)) {
    const bDouble = (attackSpeed(def) - attackSpeed(att)) >= doubleThresh(def) && !hasSkill(att, 'wary');
    if (bDouble) performStrike(def, att, board, rng, events);
  }
  const fallen = [];
  if (!isAlive(att)) fallen.push(att.uid);
  if (!isAlive(def)) fallen.push(def.uid);
  return { events, fallen };
}
