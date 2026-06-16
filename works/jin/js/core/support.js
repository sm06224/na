/* ============================================================
   陣 — 支援（絆の成長）。隣り合って戦うほど、二人の絆は深まる。
   絆は C → B → A と上がり、支え合う者が隣にいれば、命中・回避・会心が増す。
   点は game.supports に「名前|名前」で積まれ、符号（セーブ）に綴じられる。
   いっさい決定的——盤の上で誰が誰と近かったか、それだけで伸びる。
   ============================================================ */

import { isAlive } from './unit.js';
import { manhattan } from './grid.js';

export const SUPPORT_THRESHOLDS = [20, 50, 90];   // C, B, A
export const SUPPORT_LETTERS = ['—', 'C', 'B', 'A'];
export const SUPPORT_MAX = 90;

/* 二人の組を、順序によらぬ鍵に。 */
export function pairKey(a, b) {
  const na = a && a.name ? a.name : a;
  const nb = b && b.name ? b.name : b;
  return [na, nb].sort().join('|');
}

/* 点から段（0=なし,1=C,2=B,3=A）。 */
export function rankNum(points) {
  let r = 0;
  for (const t of SUPPORT_THRESHOLDS) if ((points | 0) >= t) r++;
  return r;
}
export function rankLetter(points) { return SUPPORT_LETTERS[rankNum(points)]; }

export function supportPoints(game, a, b) {
  return (game.supports && game.supports[pairKey(a, b)]) || 0;
}
export function supportRank(game, a, b) { return rankNum(supportPoints(game, a, b)); }

/* 絆を深める（上限まで）。新しく段が上がったらその段を返す、でなければ 0。 */
export function addSupport(game, a, b, amt) {
  if (!game.supports) game.supports = {};
  const k = pairKey(a, b);
  const before = rankNum(game.supports[k] || 0);
  game.supports[k] = Math.min(SUPPORT_MAX, (game.supports[k] || 0) + amt);
  const after = rankNum(game.supports[k]);
  return after > before ? after : 0;
}

/* 戦のあと、共に布陣した生存者どうしの絆を伸ばす（決定的）。
   近くに居続けた組ほど多く。新しく上がった組の一覧を返す。 */
export function awardSupportsAfterBattle(game, board) {
  const ups = [];
  const living = board.unitsOf('player').filter(isAlive);
  for (let i = 0; i < living.length; i++) {
    for (let j = i + 1; j < living.length; j++) {
      const a = living[i], b = living[j];
      let amt = 3;                                              // 共に戦った
      if (a.pos && b.pos && manhattan(a.pos, b.pos) <= 2) amt += 5;   // 終始よりそった
      const up = addSupport(game, a, b, amt);
      if (up) ups.push({ a: a.name, b: b.name, rank: SUPPORT_LETTERS[up] });
    }
  }
  return ups;
}

/* 戦の頭で、各ユニットに支援段の早見表を持たせる（combat が参照する）。 */
export function applySupportsToUnits(game, board) {
  const units = board.unitsOf('player');
  for (const u of units) {
    u._supports = {};
    for (const o of units) {
      if (o === u) continue;
      const r = supportRank(game, u, o);
      if (r > 0) u._supports[o.name] = r;
    }
  }
}

/* 隣接する支援相手から得る、絆の上乗せ（段ぶん）。combat.bondOf が足す。 */
export function supportBondBonus(u, board) {
  if (!u._supports || !u.pos || !board) return 0;
  let bonus = 0;
  for (const a of board.alliesOf(u)) {
    if (a.pos && manhattan(a.pos, u.pos) === 1 && u._supports[a.name]) bonus += u._supports[a.name];
  }
  return bonus;
}
