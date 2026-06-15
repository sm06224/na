/* ============================================================
   陣 — 敵の思考。誰も手で動かさないのに、敵はおのずと最善をさがす。
   到達できる全マス × 狙える全標的を評価し、いちばん良い一手を選ぶ
   （期待ダメージ・撃破・反撃の危険・標的の価値・布陣）。決定的。
   `史`・`窟` の「ひとりでに動く」血を、戦術へ。
   ============================================================ */

import { manhattan, key } from './grid.js';
import { reachable, stepToward } from './pathfind.js';
import { equippedWeapon, effectiveStats, isAlive, hasSkill } from './unit.js';
import { forecast, inAttackRange } from './combat.js';

/* 標的の価値：脆く・癒し手・魔道など「先に倒したい」者を高く */
function targetPriority(t) {
  const w = equippedWeapon(t);
  let p = 10;
  if (w && w.wtype === 'staff') p += 22;            // 癒し手は最優先
  if (w && w.magic) p += 8;
  if (t.boss) p += 6;
  p += Math.max(0, 14 - Math.floor(t.hp / 4));      // 瀕死ほど高い
  return p;
}

function nearestEnemy(board, u, enemies) {
  return enemies.reduce((m, e) => manhattan(e.pos, u.pos) < manhattan(m.pos, u.pos) ? e : m, enemies[0]);
}
function expected(fc) {
  if (!fc) return { dmg: 0, kill: 0, counter: 0 };
  const dmg = fc.hit / 100 * fc.dmg * (fc.doubles ? 2 : 1);
  const counter = fc.counter ? (fc.counter.hit / 100 * fc.counter.dmg * (fc.counter.doubles ? 2 : 1)) : 0;
  return { dmg, counter };
}

/* この敵の一手を計画する。{ move:{x,y}, target?:uid } を返す。 */
export function planTurn(board, u, rng) {
  if (!u.pos) return { move: null };
  const flier = u.mode === 'fly' || hasSkill(u, 'wing');
  const reach = reachable(board.terrain, u.pos, u.mov, {
    costAt: (x, y) => board.costForUnit(u, x, y),
    blocked: (x, y) => board.blockedForUnit(u, x, y),
    zoc: (x, y) => board.zocFor(u, x, y),
  });
  // 立てるマス（自分の今の位置か、他のユニットがいないマス）
  const standable = [];
  for (const [k] of reach.dist) {
    const [x, y] = k.split(',').map(Number);
    if ((x === u.pos.x && y === u.pos.y) || !board.occupied(x, y)) standable.push({ x, y });
  }

  const enemies = board.enemiesOf(u);
  if (!enemies.length) return { move: null };

  // 癒し手：杖を持つ者は、傷ついた味方を癒すことを最優先に考える
  const sw = equippedWeapon(u);
  if (sw && sw.wtype === 'staff' && sw.staff === 'heal') {
    const allies = board.alliesOf(u).concat([u]).filter(a => a.pos && a.hp < a.maxHp);
    let bestHeal = null;
    if (allies.length) {
      for (const tile of standable) {
        for (const a of allies) {
          if (manhattan(tile, a.pos) > sw.max || manhattan(tile, a.pos) < sw.min) continue;
          const missing = a.maxHp - a.hp;
          const safety = -manhattan(tile, nearestEnemy(board, u, enemies).pos) * 0.2;  // 前に出すぎない
          const score = missing * 2 + (a === u ? 1 : 0) + safety;
          if (!bestHeal || score > bestHeal.score) bestHeal = { score, move: tile, heal: a.uid };
        }
      }
    }
    if (bestHeal) return { move: bestHeal.move, heal: bestHeal.heal };
    // 癒す相手がいなければ、傷ついた味方の方へ寄る（無ければ後退気味に留まる）
    const wounded = board.alliesOf(u).filter(a => a.hp < a.maxHp).sort((p, q) => (q.maxHp - q.hp) - (p.maxHp - p.hp))[0];
    if (wounded) { const t = stepToward(board.terrain, reach, wounded.pos); return { move: t || u.pos }; }
    return { move: u.pos };
  }

  // 守り/ボスは持ち場から離れすぎない
  const anchor = u.aiAnchor || u.pos;
  const aggro = u.aiKind === 'boss' ? 4 : (u.aiKind === 'guard' ? 5 : 99);
  const nearestE = enemies.reduce((m, e) => manhattan(e.pos, u.pos) < manhattan(m.pos, u.pos) ? e : m, enemies[0]);
  const passive = (u.aiKind === 'boss' || u.aiKind === 'guard') && manhattan(nearestE.pos, anchor) > aggro;

  let best = null;
  const w = equippedWeapon(u);
  if (w && w.wtype !== 'staff' && !passive) {
    for (const tile of standable) {
      const savedPos = u.pos; u.pos = tile;            // 仮に立たせて間合いを測る
      for (const e of enemies) {
        if (!inAttackRange(u, e)) continue;
        const fc = forecast(u, e, board);
        if (!fc) continue;
        const ex = expected(fc);
        const killBonus = ex.dmg >= e.hp ? 200 + targetPriority(e) * 2 : 0;
        const moveCost = reach.dist.get(key(tile.x, tile.y)) || 0;
        const score = ex.dmg * 2 + killBonus + targetPriority(e)
          - ex.counter * 0.7 - moveCost * 0.05
          - (u.boss ? manhattan(tile, anchor) * 0.3 : 0);
        if (!best || score > best.score + 1e-6) best = { score, move: tile, target: e.uid };
      }
      u.pos = savedPos;
    }
  }
  if (best) return { move: best.move, target: best.target };

  // 攻撃できないなら前進（突撃）。守り/ボスで passive なら留まる。
  if (passive || u.aiKind === 'guard' || u.aiKind === 'boss') return { move: u.pos };
  const toward = stepToward(board.terrain, reach, nearestE.pos);
  // 立てるマスに丸める（占有を避ける）
  let dest = toward && (!board.occupied(toward.x, toward.y) || (toward.x === u.pos.x && toward.y === u.pos.y))
    ? toward : u.pos;
  return { move: dest };
}
