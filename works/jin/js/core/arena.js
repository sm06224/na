/* ============================================================
   陣 — 闘技場。章と章のあいだ、拠点のかたわらに立つ砂の輪。
   賭け金を積み、種と章から決定的に組まれた相手と一騎打ち。
   勝てば名と金と熟練度を得る。負けても命は獲らぬ——倒れる前に
   行司が割って入る（賭け金だけを失う）。だから主君を出しても惜しくない。
   ============================================================ */

import { RNG } from './rng.js';
import { Board } from './board.js';
import { createUnit, isAlive, effectiveStats, gainWexp, equippedWeapon } from './unit.js';
import { resolveCombat } from './combat.js';

/* 番付：序の口・中堅・猛者。賭け金と褒賞、相手の格が上がる。 */
const TIERS = [
  { id: 'rookie',   name: '序の口', dLv: -2, wager: 150, reward: 320,  pool: [['soldier', 'iron_lance'], ['fighter', 'iron_axe'], ['mercenary', 'iron_sword']] },
  { id: 'veteran',  name: '中堅',   dLv: 1,  wager: 360, reward: 760,  pool: [['knight', 'steel_lance'], ['archer', 'steel_bow'], ['mage', 'fire'], ['mercenary', 'steel_sword']] },
  { id: 'champion', name: '猛者',   dLv: 4,  wager: 820, reward: 1700, pool: [['hero', 'silver_sword'], ['general', 'silver_lance'], ['warrior', 'silver_axe'], ['sniper', 'silver_bow']] },
];

const FOE_NAMES = ['ザイル', 'グラド', 'ボーガン', 'ヴェスナ', 'カイト', 'ドラジ', 'モルガ', 'セルカ', 'ゴラン', 'バルド', 'ネビス', 'タルガ'];

/* 章と種から、その拠点の闘技場の三番付の相手を決める（決定的）。 */
export function arenaOpponents(seed, chapterIndex, avgLevel = 5) {
  const r = new RNG(((seed >>> 0) ^ ((chapterIndex + 1) * 0x9e3779b1)) >>> 0);
  return TIERS.map((t, ti) => {
    const [classId, weapon] = t.pool[r.int(t.pool.length)];
    const level = Math.max(1, avgLevel + t.dLv);
    const name = FOE_NAMES[r.int(FOE_NAMES.length)];
    return { tier: t.id, tierName: t.name, name, classId, weapon, level, wager: t.wager, reward: t.reward, index: ti };
  });
}

/* 戦闘用の使い捨て複製（本体の HP・状態は汚さない）。 */
function combatClone(u, side, pos) {
  return { ...u, side, pos: { ...pos }, status: [], buffs: {}, hasMoved: false, hasActed: false };
}

/* 相手ユニットを組む。 */
export function makeArenaFoe(opp, seed, chapterIndex) {
  const r = new RNG(((seed >>> 0) ^ ((chapterIndex + 1) * 2654435761) ^ ((opp.index + 1) * 40503)) >>> 0);
  return createUnit({
    classId: opp.classId, level: opp.level, items: [opp.weapon], side: 'enemy', name: opp.name,
  }, r);
}

/* 一騎打ちを裁く。unit（本体）は傷つかず、勝てば熟練度を得る。
   返り値：{ win, rounds, log, reward, wager, foeName, hpRatio } */
export function arenaFight(unit, opp, seed, chapterIndex, { maxRounds = 8 } = {}) {
  const foeUnit = makeArenaFoe(opp, seed, chapterIndex);
  const me = combatClone(unit, 'player', { x: 1, y: 0 });
  const foe = combatClone(foeUnit, 'enemy', { x: 2, y: 0 });
  // 互いに向き合う
  me.facing = 1; foe.facing = 3;

  const board = new Board(4, 1);
  board.add(me, 1, 0); board.add(foe, 2, 0);
  board.rebuildIndex();
  // 闘技場の「運」は挑戦ごとに定まる（種・章・番付から）。勝敗は腕＝能力が決める。
  const r = new RNG(((seed >>> 0) ^ ((chapterIndex + 1) << 8) ^ ((opp.index + 1) * 7919)) >>> 0);

  const log = [];
  let win = null;
  let round = 0;
  for (; round < maxRounds; round++) {
    const before = { me: me.hp, foe: foe.hp };
    resolveCombat(me, foe, board, r);
    log.push({ round: round + 1, me: me.hp, foe: foe.hp, dealt: before.foe - foe.hp, taken: before.me - me.hp });
    if (!isAlive(me)) { win = false; break; }      // 倒れる前に行司が止める＝負け
    if (!isAlive(foe)) { win = true; break; }
  }
  if (win === null) {
    // 時間切れ：残り体力割合で裁く
    win = (me.hp / me.maxHp) >= (foe.hp / foe.maxHp);
  }

  const w = equippedWeapon(unit);
  if (win && w && w.wtype !== 'staff') gainWexp(unit, w.wtype, 2);   // 勝者は腕を上げる

  return {
    win, rounds: round + (win === null ? 0 : 1), log,
    reward: win ? opp.reward : 0, wager: opp.wager,
    foeName: opp.name, tierName: opp.tierName,
    hpRatio: me.hp / me.maxHp,
  };
}
