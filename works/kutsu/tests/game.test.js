import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/core/game.js';
import { T } from '../js/core/tile.js';
import { aStar } from '../js/core/pathfind.js';
import * as A from '../js/core/actions.js';

/* 決定的な自動潜行：A* で階段へ向かい、道の魔物は殴り、傷つけば薬を飲む */
function autoStep(game) {
  const p = game.player, lv = game.level;
  if (p.hp < p.maxhp * 0.35) {
    const pot = p.inv.find(i => i.def === 'p_heal');
    if (pot) { A.drink(game, pot); return; }
  }
  if (lv.get(p.x, p.y) === T.STAIRS_DOWN) { A.descend(game); return; }
  if (game.board.itemsAt(p.x, p.y).length) { A.pickup(game); return; }
  const sd = lv.stairsDown;
  // 致命の地形（溶岩・奈落）は避けて道を引く。魔物のマスは踏み込んで＝攻撃して抜ける
  const safe = (x, y) => lv.walkable(x, y) && !lv.prop(x, y).deadly && !lv.prop(x, y).chasm;
  const path = aStar(lv, p.x, p.y, sd.x, sd.y, safe) || aStar(lv, p.x, p.y, sd.x, sd.y, (x, y) => lv.walkable(x, y));
  if (path && path.length > 1) {
    const next = path[1];
    A.move(game, next.x - p.x, next.y - p.y);
  } else {
    A.wait(game);
  }
}

function play(seed, steps) {
  const g = new Game(seed);
  for (let i = 0; i < steps && g.state === 'play'; i++) autoStep(g);
  return g;
}

test('新しい窟：プレイヤーは歩ける床に立ち、第 1 階から始まる', () => {
  const g = new Game(2026);
  assert.equal(g.depth, 1);
  assert.ok(g.level.walkable(g.player.x, g.player.y));
  assert.ok(g.board.monsters().length >= 1);
  assert.ok(g.player.hp > 0 && g.player.hp <= g.player.maxhp);
});

test('自動潜行：多くの種で例外なく進み、不変条件を保ち、誰かは深く潜る', () => {
  let maxDepth = 0, totalTurns = 0;
  for (const seed of [1, 2, 3, 777, 99, 2026, 55, 314, 42, 2024]) {
    const g = new Game(seed);
    for (let i = 0; i < 2500 && g.state === 'play'; i++) {
      autoStep(g);
      assert.ok(g.player.hp <= g.player.maxhp);
      assert.ok(g.level.inBounds(g.player.x, g.player.y));
      for (const m of g.board.monsters()) assert.ok(g.level.inBounds(m.x, m.y));
    }
    maxDepth = Math.max(maxDepth, g.player.depthMax);
    totalTurns += g.player.turns;
  }
  assert.ok(maxDepth >= 4, `最深 ${maxDepth}`);
  assert.ok(totalTurns > 1000, `総手数 ${totalTurns}`);
});

test('決定性：同じ種からは、同じ潜行（手数・深さ・HP・撃破・金）', () => {
  const a = play(12321, 800), b = play(12321, 800);
  assert.equal(a.player.turns, b.player.turns);
  assert.equal(a.depth, b.depth);
  assert.equal(a.player.hp, b.player.hp);
  assert.equal(a.player.kills, b.player.kills);
  assert.equal(a.player.gold, b.player.gold);
  assert.equal(a.state, b.state);
});

test('種がちがえば、潜行もちがう', () => {
  const a = play(1, 600), b = play(2, 600);
  const diff = a.player.turns !== b.player.turns || a.depth !== b.depth || a.player.kills !== b.player.kills;
  assert.ok(diff);
});

test('多くの種で、少なくとも一段は降りられる（階段は到達可能）', () => {
  let descended = 0;
  for (const seed of [1, 2, 3, 777, 99, 55, 314, 42]) {
    const g = new Game(seed);
    for (let i = 0; i < 1800 && g.depth === 1 && g.state === 'play'; i++) autoStep(g);
    assert.ok(g.level.stairsDown);
    if (g.depth > 1) descended++;
  }
  assert.ok(descended >= 6, `降りられた種 ${descended}/8`);
});

test('serialize は例外なく回り、要点を含む', () => {
  const g = play(55, 300);
  const s = g.serialize();
  assert.equal(s.seed, 55);
  assert.ok(Array.isArray(s.levels) && s.levels.length >= 1);
  assert.ok(s.player && s.player.hp <= s.player.maxhp);
});
