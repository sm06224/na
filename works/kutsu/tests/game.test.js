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
  // 地形だけで道を引く（魔物のマスは踏み込んで＝攻撃して抜ける）
  const path = aStar(lv, p.x, p.y, sd.x, sd.y, (x, y) => lv.walkable(x, y));
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

test('自動潜行：例外なく進み、不変条件を保ち、深みへ降りていく', () => {
  const g = new Game(777);
  for (let i = 0; i < 3000 && g.state === 'play'; i++) {
    autoStep(g);
    // 不変条件
    assert.ok(g.player.hp <= g.player.maxhp);
    assert.ok(g.player.x >= 0 && g.player.x < g.level.w && g.player.y >= 0 && g.player.y < g.level.h);
    for (const m of g.board.monsters()) assert.ok(g.level.inBounds(m.x, m.y));
  }
  assert.ok(g.player.turns > 50, `手数 ${g.player.turns}`);
  assert.ok(g.player.depthMax >= 2, `最深 ${g.player.depthMax}`);
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

test('降りると深さが増え、階段は到達可能', () => {
  const g = new Game(99);
  const d0 = g.depth;
  // 階段へ寄せて降りる
  for (let i = 0; i < 1500 && g.depth === d0 && g.state === 'play'; i++) autoStep(g);
  assert.ok(g.depth > d0, `降りられなかった（depth ${g.depth}）`);
  assert.ok(g.level.stairsDown);
});

test('serialize は例外なく回り、要点を含む', () => {
  const g = play(55, 300);
  const s = g.serialize();
  assert.equal(s.seed, 55);
  assert.ok(Array.isArray(s.levels) && s.levels.length >= 1);
  assert.ok(s.player && s.player.hp <= s.player.maxhp);
});
