/* ============================================================
   陣 — ひとり（ユニット）。職と経験が能力を作り、得物が戦い方を決める。
   すべて素のオブジェクト（保存できる）。計算はここの関数が引き受ける。
   ============================================================ */

import { classDef, classCaps } from './classes.js';
import { item as itemDef, isWeapon, rankValue, WEXP_THRESHOLDS, rankFromWexp } from './items.js';
import { STAT_KEYS, cloneStats, addStats, capStats, rollLevelUp, expToLevel } from './stats.js';

let _uid = 1;
export function resetUid(n = 1) { _uid = n; }

/* ユニットを作る。level まで自動で育てる（決定的）。 */
export function createUnit(spec, rng) {
  const cd = classDef(spec.classId) || classDef('soldier');
  const caps = classCaps(cd.id);
  const growths = mergeGrowths(cd.growths, spec.growths || {});
  let base = cloneStats(cd.bases);

  const targetLv = spec.level || 1;
  for (let lv = 2; lv <= targetLv; lv++) {
    const r = rng ? rng.derive(`${spec.id || spec.name}:lv${lv}`) : null;
    if (r) base = addStats(base, rollLevelUp(growths, r, caps, base));
  }
  // 個別の素の下駄（ボス補正など）
  if (spec.statBoost) base = addStats(base, spec.statBoost);
  base = capStats(base, caps);

  const skills = uniq([...(cd.skills || []), ...(spec.skills || [])]);
  const items = (spec.items || []).map(it => typeof it === 'string'
    ? makeItemStack(it) : { id: it.id, uses: it.uses });

  // 武器熟練度：扱える型に初期段を与える（レベル・段位で底上げ、持ち物は必ず使える）
  const wexp = seedWexp(cd, targetLv, items, spec.wexp);

  const u = {
    uid: _uid++,
    name: spec.name || cd.name,
    classId: cd.id,
    level: targetLv,
    exp: 0,
    side: spec.side || 'enemy',
    statsBase: base,
    growths,
    maxHp: base.hp,
    hp: base.hp,
    mov: cd.mov,
    mode: cd.mode,
    items,
    equipped: -1,
    skills,
    wexp,                  // { sword: n, ... } 武器熟練度
    status: [],            // [{ id, turns }]
    buffs: {},             // { str: {amt, turns}, ... }
    pos: spec.pos ? { ...spec.pos } : null,
    facing: spec.facing ?? (spec.side === 'enemy' ? 3 : 1),   // 0北 1東 2南 3西
    hasMoved: false,
    hasActed: false,
    boss: !!spec.boss,
    aiKind: spec.aiKind || (spec.boss ? 'boss' : 'charge'),
    aiAnchor: spec.aiAnchor || null,
    portrait: spec.portrait || null,
    recruit: spec.recruit || null,
    accessory: spec.accessory || null,
    deathQuote: spec.deathQuote || null,
    bio: spec.bio || '',
  };
  autoEquip(u);
  return u;
}

function mergeGrowths(a, b) {
  const o = {};
  for (const k of STAT_KEYS) o[k] = (a[k] || 0) + (b[k] || 0);
  return o;
}
function uniq(arr) { return [...new Set(arr)]; }
export function makeItemStack(id) {
  const d = itemDef(id);
  return { id, uses: d && d.uses ? d.uses : (d && d.kind === 'weapon' ? null : (d ? d.uses : null)) };
}

/* 装備中の得物 */
export function equippedWeapon(u) {
  if (u.equipped < 0 || u.equipped >= u.items.length) return null;
  const it = itemDef(u.items[u.equipped].id);
  return isWeapon(it) ? it : null;
}
/* 扱える型に初期熟練度を配る。tier/level で底上げし、所持品は必ず使える段に。 */
export function seedWexp(cd, level, items, override) {
  const wexp = {};
  const allowed = cd.weapons || {};
  for (const type in allowed) {
    const capIdx = rankValue(allowed[type]);
    let startIdx = Math.min(capIdx, Math.floor((level || 1) / 4) + (cd.tier === 2 ? 2 : 0));
    for (const st of (items || [])) {
      const it = itemDef(st.id);
      if (it && it.kind === 'weapon' && it.wtype === type) startIdx = Math.max(startIdx, rankValue(it.rank));
    }
    startIdx = Math.min(capIdx, Math.max(0, startIdx));
    wexp[type] = WEXP_THRESHOLDS[startIdx];
  }
  if (override) for (const k in override) wexp[k] = override[k];
  return wexp;
}
/* この者の、その型での現在の段（クラス上限で頭打ち） */
export function unitRank(u, type) {
  const cd = classDef(u.classId);
  const cap = cd.weapons && cd.weapons[type];
  if (!cap) return -1;
  const capIdx = rankValue(cap);
  const cur = u.wexp ? rankValue(rankFromWexp(u.wexp[type] || 0)) : capIdx;
  return Math.min(capIdx, cur);
}
export function canUse(u, it) {
  if (!it || it.kind !== 'weapon') return false;
  const cd = classDef(u.classId);
  if (!cd.weapons || !cd.weapons[it.wtype]) return false;
  return unitRank(u, it.wtype) >= rankValue(it.rank);
}
/* 武器を使った熟練度の上昇。段が上がったら letter を返す（なければ null）。 */
export function gainWexp(u, type, amt = 1) {
  const cd = classDef(u.classId);
  if (!cd.weapons || !cd.weapons[type]) return null;
  if (!u.wexp) u.wexp = {};
  const capW = WEXP_THRESHOLDS[rankValue(cd.weapons[type])];
  const before = rankFromWexp(u.wexp[type] || 0);
  u.wexp[type] = Math.min(capW, (u.wexp[type] || 0) + amt);
  const after = rankFromWexp(u.wexp[type]);
  return after !== before ? after : null;
}
export function autoEquip(u) {
  for (let i = 0; i < u.items.length; i++) {
    const it = itemDef(u.items[i].id);
    if (it && it.kind === 'weapon' && it.wtype !== 'staff' && canUse(u, it)) { u.equipped = i; return; }
  }
  // 杖しか無いなら杖
  for (let i = 0; i < u.items.length; i++) {
    const it = itemDef(u.items[i].id);
    if (it && it.kind === 'weapon' && canUse(u, it)) { u.equipped = i; return; }
  }
  u.equipped = -1;
}

/* 実効ステータス（素＋装飾＋一時バフ、上限で頭打ち） */
export function effectiveStats(u) {
  const s = cloneStats(u.statsBase);
  if (u.accessory) {
    const acc = itemDef(u.accessory);
    if (acc && acc.bonus) for (const k in acc.bonus) if (k in s) s[k] += acc.bonus[k];
  }
  for (const k in u.buffs) if (k in s) s[k] += u.buffs[k].amt;
  const caps = classCaps(u.classId);
  return capStats(s, { ...caps, hp: 99 });
}

/* 攻撃速度：速さ −（重さ − 力/...）。FE 風に重い武器が速さを削ぐ。 */
export function attackSpeed(u) {
  const s = effectiveStats(u);
  const w = equippedWeapon(u);
  const burden = w ? Math.max(0, (w.wt || 0) - Math.floor(s.str / 5)) : 0;
  return s.spd - burden;
}

/* この相手に何マスから攻撃できるか（装備の射程） */
export function attackRange(u) {
  const w = equippedWeapon(u);
  if (!w) return { min: 0, max: 0 };
  return { min: w.min, max: w.max };
}

export function hasSkill(u, id) { return u.skills && u.skills.includes(id); }
export function isAlive(u) { return u.hp > 0; }

/* 経験を与え、レベルアップを処理（決定的に rng で）。上がった分の記録を返す。 */
export function gainExp(u, amount, rng) {
  const caps = classCaps(u.classId);
  const ups = [];
  u.exp += amount;
  while (u.exp >= expToLevel(u.level) && u.level < (classDef(u.classId).tier === 2 ? 20 : 20)) {
    u.exp -= expToLevel(u.level);
    u.level++;
    const r = rng ? rng.derive(`${u.uid}:up${u.level}:${u.exp}`) : null;
    const gain = r ? rollLevelUp(u.growths, r, caps, u.statsBase) : {};
    u.statsBase = capStats(addStats(u.statsBase, gain), caps);
    const newMax = u.statsBase.hp;
    u.hp += (newMax - u.maxHp);
    u.maxHp = newMax;
    ups.push({ level: u.level, gain });
  }
  return ups;
}

/* 上級転職 */
export function promote(u, toClassId) {
  const cd = classDef(u.classId);
  if (!cd.promotesTo || !cd.promotesTo.includes(toClassId)) return false;
  const to = classDef(toClassId);
  // 転職ボーナス：上級職の基本値との差分の一部を加える
  for (const k of STAT_KEYS) {
    const bonus = Math.max(0, Math.round(((to.bases[k] || 0) - (cd.bases[k] || 0)) * 0.6) + (k === 'hp' ? 2 : 0));
    u.statsBase[k] += bonus;
  }
  u.classId = toClassId;
  u.mov = to.mov; u.mode = to.mode;
  u.skills = uniq([...u.skills, ...(to.skills || [])]);
  u.statsBase = capStats(u.statsBase, classCaps(toClassId));
  u.maxHp = u.statsBase.hp; u.hp = Math.min(u.hp, u.maxHp);
  u.level = 1; u.exp = 0;
  // 熟練度：上級職で新たに扱える型は底を与えつつ、これまでの段は保つ
  const reseed = seedWexp(to, 10, u.items);
  u.wexp = u.wexp || {};
  for (const t in reseed) u.wexp[t] = Math.max(u.wexp[t] || 0, reseed[t]);
  autoEquip(u);
  return true;
}
