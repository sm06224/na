/* ============================================================
   窟 — 魔物の知恵。眠り・追跡・遠隔・呪文・群れ・臆病・盗み・擬態。
   獲物の匂い（ダイクストラ地図）を下って寄り、視線が通れば撃つ。
   ============================================================ */

import { DIR8 } from './util.js';
import { isHelpless } from './status.js';

/* 一体ぶんの手番。game の道具を使って動く。 */
export function monsterTurn(game, m) {
  if (!m.alive) return;
  if (isHelpless(m)) return;                 // 麻痺・気絶は動けない
  const player = game.player;

  // 眠っているなら、起きるか確かめる
  if (m.flags.sleeping) {
    if (game.canSeePlayer(m) && game.rng.chance(wakeChance(game, m))) {
      m.flags.sleeping = false;
      if (game.inSight(m.x, m.y)) game.log(`${m.name}が目を覚ました。`);
    } else { if (game.rng.chance(0.2)) wander(game, m); return; }
  }

  // 擬態：見破られるか隣接するまで品物のふり
  if (m.ai === 'mimic' && !m.aiState.revealed) {
    if (game.adjacentToPlayer(m)) { m.aiState.revealed = true; game.log('品物だと思ったら——擬態だ！'); }
    else return;
  }

  // 混乱・恐慌の上書き
  if (m.hasStatus('confuse')) { stagger(game, m); return; }
  const afraid = m.hasStatus('fear') || (m.ai === 'coward' && m.hp < m.maxhp * 0.3);

  const sees = game.canSeePlayer(m);
  if (sees) { m.aiState.lastSeen = { x: player.x, y: player.y }; m.aiState.lost = 0; m.flags.seen = true; }

  if (afraid) { flee(game, m); return; }

  const dist = game.chebToPlayer(m.x, m.y);

  // 隣接：盗賊は盗んで逃げ、それ以外は殴る
  if (game.adjacentToPlayer(m)) {
    if (m.special === 'steal' && !m.aiState.stole) {
      if (game.steal(m)) { m.aiState.stole = true; flee(game, m); return; }
    }
    game.attack(m, player);
    return;
  }

  // 遠隔・呪文：視線が通り、間合いなら撃つ
  if (sees) {
    if (m.ranged && dist <= (m.ranged.range || 6) && game.lineToPlayer(m)) {
      game.monsterRanged(m, player, m.ranged); return;
    }
    if (m.spell && dist <= (m.spellRange || 6) && game.lineToPlayer(m)) {
      if (m.special === 'summon' && m.hp < m.maxhp * 0.6 && game.rng.oneIn(4)) { game.monsterSummon(m); return; }
      game.monsterCast(m, player); return;
    }
    if (m.special === 'summon' && game.rng.oneIn(8)) { game.monsterSummon(m); return; }
  }

  // 追う（見えていれば匂いを下る。見失ったら最後の位置へ。）
  if (sees || m.aiState.lastSeen) {
    if (m.ai === 'erratic' && game.rng.chance(0.5)) { wander(game, m); return; }
    if (chase(game, m)) return;
  }

  // 何も無ければうろつく
  if (game.rng.chance(0.4)) wander(game, m);
}

function wakeChance(game, m) {
  const d = game.chebToPlayer(m.x, m.y);
  let p = 0.5 - d * 0.05;
  if (game.player.hasStatus('invisible')) p -= 0.3;
  return Math.max(0.05, p);
}

/* 匂い地図を下って獲物へ一歩 */
function chase(game, m) {
  let best = null, bestD = game.distToPlayer(m.x, m.y);
  for (const d of DIR8) {
    const nx = m.x + d.x, ny = m.y + d.y;
    const dd = game.distToPlayer(nx, ny);
    if (dd < bestD && game.monsterCanEnter(m, nx, ny)) {
      // 斜めに壁の角を抜けない
      if (d.x && d.y && !game.monsterCanEnter(m, m.x + d.x, m.y) && !game.monsterCanEnter(m, m.x, m.y + d.y)) continue;
      bestD = dd; best = { x: nx, y: ny };
    }
  }
  if (best) { game.tryMove(m, best.x, best.y); return true; }
  // 行き止まり：最後に見た方へ単純に寄る
  if (m.aiState.lastSeen) {
    const ls = m.aiState.lastSeen;
    if (++m.aiState.lost > 12) m.aiState.lastSeen = null;
    return stepTowards(game, m, ls.x, ls.y);
  }
  return false;
}

/* 獲物から遠ざかる */
function flee(game, m) {
  let best = null, bestD = game.distToPlayer(m.x, m.y);
  for (const d of DIR8) {
    const nx = m.x + d.x, ny = m.y + d.y;
    const dd = game.distToPlayer(nx, ny);
    if (dd > bestD && game.monsterCanEnter(m, nx, ny)) { bestD = dd; best = { x: nx, y: ny }; }
  }
  if (best) game.tryMove(m, best.x, best.y);
  else if (game.rng.chance(0.5)) wander(game, m);
}

function stepTowards(game, m, tx, ty) {
  const dx = Math.sign(tx - m.x), dy = Math.sign(ty - m.y);
  const opts = [{ x: m.x + dx, y: m.y + dy }, { x: m.x + dx, y: m.y }, { x: m.x, y: m.y + dy }];
  for (const o of opts) if ((o.x !== m.x || o.y !== m.y) && game.monsterCanEnter(m, o.x, o.y)) { game.tryMove(m, o.x, o.y); return true; }
  return false;
}

/* よろめき（混乱）：でたらめな隣へ */
function stagger(game, m) {
  const d = game.rng.pick(DIR8);
  const nx = m.x + d.x, ny = m.y + d.y;
  if (game.monsterCanEnter(m, nx, ny)) game.tryMove(m, nx, ny);
}

function wander(game, m) {
  const dirs = game.rng.shuffle(DIR8.slice());
  for (const d of dirs) {
    const nx = m.x + d.x, ny = m.y + d.y;
    if (game.monsterCanEnter(m, nx, ny) && !game.level.prop(nx, ny).deadly) { game.tryMove(m, nx, ny); return; }
  }
}
