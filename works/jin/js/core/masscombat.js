/* ============================================================
   陣 — 会戦（マスコンバット）。盤上の一手ではなく、軍と軍の大ぶつかり。
   各連隊の兵力・攻・守からラウンドごとの損耗を決定的に計算し、
   士気が崩れた側が敗走する。`史` の国どうしの戦の、戦術版。
   コアは DOM 非依存。同じ種・同じ軍なら、同じ会戦。
   ============================================================ */

import { effectiveStats, equippedWeapon } from './unit.js';

/* ユニットひとり → 一個連隊（兵力は格・能力で決まる） */
export function regimentOf(u) {
  const es = effectiveStats(u);
  const w = equippedWeapon(u);
  const mt = w ? (w.mt || 0) : 0;
  const atk = Math.max(es.str, es.mag) + mt + 4;
  const def = Math.round((es.def + es.res) / 2) + 4;
  const troops = 8 + (u.level | 0) + Math.round(u.maxHp / 6);
  return { name: u.name, troops, atk, def, troops0: troops };
}
export function makeArmy(name, units) {
  return { name, regiments: units.filter(u => u && (u.hp == null || u.hp > 0)).map(regimentOf) };
}
export function armyTroops(army) { return army.regiments.reduce((s, r) => s + Math.max(0, r.troops), 0); }
export function armyTroops0(army) { return army.regiments.reduce((s, r) => s + r.troops0, 0); }
function armyPower(army) { return army.regiments.reduce((s, r) => s + Math.max(0, r.troops) * r.atk, 0); }
function armyDef(army) {
  const t = armyTroops(army); if (t <= 0) return 1;
  return army.regiments.reduce((s, r) => s + Math.max(0, r.troops) * r.def, 0) / t;
}

/* 損耗を連隊へ、兵力に比例して割り振る */
function applyCasualties(army, loss) {
  const total = armyTroops(army);
  if (total <= 0) return;
  let remaining = loss;
  for (const r of army.regiments) {
    if (r.troops <= 0) continue;
    const share = Math.round(loss * (r.troops / total));
    const cut = Math.min(r.troops, share);
    r.troops -= cut; remaining -= cut;
  }
  // 端数は生き残りから削る
  for (const r of army.regiments) { if (remaining <= 0) break; if (r.troops > 0) { const c = Math.min(r.troops, remaining); r.troops -= c; remaining -= c; } }
}

/* 会戦を解く。決定的（rng で小さな揺らぎ）。 */
export function resolveMassCombat(a, b, rng, opts = {}) {
  const maxRounds = opts.maxRounds || 40;
  const RATE = 0.018;
  const ROUT = 0.25;                 // 兵力が初期の25%を切れば敗走
  const rounds = [];
  let r = 0;
  for (; r < maxRounds; r++) {
    const pA = armyPower(a), pB = armyPower(b);
    const dA = armyDef(a), dB = armyDef(b);
    const jA = rng ? (0.9 + rng.next() * 0.2) : 1;
    const jB = rng ? (0.9 + rng.next() * 0.2) : 1;
    const lossB = Math.max(1, Math.round(pA * RATE * jA / dB));
    const lossA = Math.max(1, Math.round(pB * RATE * jB / dA));
    applyCasualties(b, lossB);
    applyCasualties(a, lossA);
    rounds.push({ round: r + 1, a: armyTroops(a), b: armyTroops(b), lossA, lossB });
    const fracA = armyTroops(a) / Math.max(1, armyTroops0(a));
    const fracB = armyTroops(b) / Math.max(1, armyTroops0(b));
    if (fracA < ROUT || fracB < ROUT || armyTroops(a) <= 0 || armyTroops(b) <= 0) break;
  }
  const ta = armyTroops(a), tb = armyTroops(b);
  const winner = ta === tb ? 'draw' : (ta > tb ? 'a' : 'b');
  return { winner, rounds, survivorsA: ta, survivorsB: tb, troops0A: armyTroops0(a), troops0B: armyTroops0(b) };
}
