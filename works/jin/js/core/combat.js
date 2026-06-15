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
import { weatherHitMod, weatherMightMod } from './weather.js';

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

/* 向き（0北1東2南3西）どうしの位置から、背後・側面の補正を出す。
   背後を突けば命中・会心が大きく上がり、側面でも少し上がる。 */
const DIRV = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
export function dirToward(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 1 : 3;
  return dy >= 0 ? 2 : 0;
}
export function flankBonus(att, def) {
  if (att.facing == null || def.facing == null || !att.pos || !def.pos) return { hit: 0, crit: 0, kind: 'front' };
  const dir = dirToward(def.pos, att.pos);        // 守り手から見た攻め手の方角
  if (dir === def.facing) return { hit: 0, crit: 0, kind: 'front' };
  if (dir === (def.facing + 2) % 4) return { hit: 15, crit: 20, kind: 'back' };
  return { hit: 7, crit: 8, kind: 'side' };
}

/* 絆（隣り合う味方の数、最大3）— 布陣そのものが力になる */
export function bondOf(u, board) {
  if (!board || !u.pos) return 0;
  let n = 0;
  for (const a of board.alliesOf(u)) if (a.pos && manhattan(a.pos, u.pos) === 1) n++;
  return Math.min(3, n);
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
  if (w.wtype === 'light') might += Math.floor((src.faith ?? 5) / 4);   // 信仰が光を強める
  if (board && board.weather) might += weatherMightMod(board.weather, w);   // 空模様が理（火）を左右する

  const atkStat = magic ? sa.mag : sa.str;
  const atk = atkStat + Math.max(0, might);
  const terr = (tgt.pos && board) ? board.terrainAt(tgt.pos.x, tgt.pos.y) : { def: 0, avo: 0 };
  const flierTgt = tgt.mode === 'fly';
  const terrDef = flierTgt ? 0 : (terr.def || 0);       // 飛行は地形の守りを受けない
  const terrAvo = flierTgt ? 0 : (terr.avo || 0);
  const defStat = (magic ? sd.res : sd.def) + terrDef;
  let dmg = Math.max(0, atk - defStat);
  if (w.wtype === 'dark') dmg = Math.max(0, dmg - Math.floor((tgt.faith ?? 5) / 4));   // 信仰が闇をやわらげる

  const sBond = bondOf(src, board), tBond = bondOf(tgt, board);
  const flank = flankBonus(src, tgt);
  const hitStat = w.hit + sa.skl * 2 + Math.floor(sa.lck / 2) + tri.hit + sBond * 5 + flank.hit;
  const avo = attackSpeed(tgt) * 2 + sd.lck + terrAvo + tBond * 3;
  let hit = clamp(Math.round(hitStat - avo), 0, 100);
  if (board && board.weather) hit = clamp(hit + weatherHitMod(board.weather, w), 0, 100);   // 空模様が狙いを乱す

  let critStat = (w.crit || 0) + Math.floor(sa.skl / 2) + (classDef(src.classId).critBonus || 0) + sBond * 2 + flank.crit;
  if (hasSkill(src, 'focus')) critStat += loneBonus(src, board);
  if (hasSkill(src, 'wrath') && src.hp * 2 <= src.maxHp) critStat += 30;     // 憤怒
  const crit = clamp(critStat - sd.lck, 0, 100);

  return { atk, dmg, hit, crit, magic, defStat, weapon: w, eff, flank: flank.kind };
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
    atk: ai.atk, dmg: ai.dmg, hit: ai.hit, crit: ai.crit, doubles: aDouble, eff: ai.eff, flank: ai.flank,
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
    const order = ['lethality', 'astra', 'adept', 'aether', 'luna', 'sol', 'ignis', 'pierce', 'colossus'];
    for (const id of order) {
      if (!hasSkill(src, id)) continue;
      if (!rng.roll(rateOf(id, src))) continue;
      procId = id;
      if (id === 'lethality') { if (!tgt.boss) lethal = true; }
      else if (id === 'astra') { hits = 5; dmg = Math.max(1, Math.floor(info.dmg * 0.5)); }
      else if (id === 'adept') { hits = 2; }                                  // もう一撃、満幅
      else if (id === 'aether') { dmg = Math.max(0, info.atk - Math.floor(info.defStat / 2)); drainFactor = 0.5; }
      else if (id === 'luna') { dmg = Math.max(0, info.atk - Math.floor(info.defStat / 2)); }
      else if (id === 'sol') { drainFactor = 0.5; }
      else if (id === 'ignis') { const es = effectiveStats(src); dmg = info.dmg + Math.floor(Math.max(es.mag, es.str) / 2); }
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
  // 命奪：敵を倒すと癒える
  if (!isAlive(tgt) && hasSkill(src, 'lifetaker')) {
    const h = Math.min(src.maxHp - src.hp, Math.floor(src.maxHp * 0.5));
    if (h > 0) { src.hp += h; events.push({ type: 'drain', by: src.uid, amount: h }); }
  }
  // 得物による状態異常（眠り・毒・沈黙など）
  if (isAlive(tgt) && info.weapon.inflict && rng.roll(info.weapon.inflict.chance)) {
    addStatus(tgt, info.weapon.inflict.id, info.weapon.inflict.turns || 3);
    events.push({ type: 'status', tgt: tgt.uid, id: info.weapon.inflict.id });
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
  // 先制（vantage）：手負いの守り手は、攻められる前に反撃する
  const vantage = hasSkill(def, 'vantage') && def.hp * 2 <= def.maxHp && canCounter(def, att, dist);
  let countered = false;
  if (vantage) { performStrike(def, att, board, rng, events); countered = true; }
  performStrike(att, def, board, rng, events);
  if (!countered && isAlive(def) && canCounter(def, att, manhattan(att.pos, def.pos))) {
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

/* ---- マップ攻撃（範囲・反撃なし） ---- */
/* 範囲の形：disk（円）/ cross（十字）/ ring（輪）/ square（角）/ x（斜め十字） */
export function patternTiles(cx, cy, shape, r) {
  const out = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const md = Math.abs(dx) + Math.abs(dy), cd = Math.max(Math.abs(dx), Math.abs(dy));
      let ok;
      if (shape === 'cross') ok = (dx === 0 || dy === 0) && md <= r;
      else if (shape === 'ring') ok = md === r;
      else if (shape === 'square') ok = cd <= r;
      else if (shape === 'x') ok = Math.abs(dx) === Math.abs(dy) && cd <= r;
      else ok = md <= r;                 // disk
      if (ok) out.push({ x: cx + dx, y: cy + dy });
    }
  }
  return out;
}
/* 着弾点 center の範囲（形＋半径）内の、術者の敵すべて */
export function areaTargets(caster, center, board) {
  const w = equippedWeapon(caster);
  const r = (w && w.aoe) || 0;
  const set = new Set(patternTiles(center.x, center.y, w && w.shape, r).map(c => c.x + ',' + c.y));
  return board.enemiesOf(caster).filter(e => e.pos && set.has(e.pos.x + ',' + e.pos.y));
}
/* 範囲攻撃を遂行（各標的へ一方的に。反撃は起きない） */
export function resolveArea(caster, center, board, rng) {
  const events = [];
  const targets = areaTargets(caster, center, board);
  for (const t of targets) if (isAlive(t)) performStrike(caster, t, board, rng, events);
  const fallen = targets.filter(t => !isAlive(t)).map(t => t.uid);
  return { events, fallen, targets };
}
export function isAreaWeapon(u) {
  const w = equippedWeapon(u);
  return !!(w && w.aoe);
}

/* ---- 算術（カリキュレーター）：能力値が「ある数の倍数」の敵を、全員まとめて撃つ ---- */
export const ARITH_PROPS = [['Lv', 'level'], ['HP', 'hp'], ['守', 'def'], ['魔防', 'res'], ['速', 'spd']];
export const ARITH_NUMS = [2, 3, 4, 5];
export function statValue(u, prop) {
  if (prop === 'level') return u.level | 0;
  if (prop === 'hp') return u.hp | 0;
  const es = effectiveStats(u);
  return es[prop] | 0;
}
export function arithmeticTargets(caster, prop, num, board) {
  if (!num) return [];
  return board.enemiesOf(caster).filter(e => e.pos && (statValue(e, prop) % num === 0));
}
export function resolveArithmetic(caster, prop, num, board) {
  const events = [];
  const targets = arithmeticTargets(caster, prop, num, board);
  const mag = effectiveStats(caster).mag;
  for (const t of targets) {
    if (!isAlive(t)) continue;
    const d = Math.max(1, mag - effectiveStats(t).res);
    t.hp = Math.max(0, t.hp - d);
    events.push({ type: 'hit', by: caster.uid, tgt: t.uid, dmg: d });
  }
  const fallen = targets.filter(t => !isAlive(t)).map(t => t.uid);
  return { events, fallen, targets };
}
