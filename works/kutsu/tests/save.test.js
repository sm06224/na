import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/core/game.js';
import { T } from '../js/core/tile.js';
import { aStar } from '../js/core/pathfind.js';
import { makeMonster } from '../js/core/factory.js';
import * as A from '../js/core/actions.js';

function autoStep(game) {
  const p = game.player, lv = game.level;
  if (p.hp < p.maxhp * 0.35) { const pot = p.inv.find(i => i.def === 'p_heal'); if (pot) { A.drink(game, pot); return; } }
  if (lv.get(p.x, p.y) === T.STAIRS_DOWN) { A.descend(game); return; }
  if (game.board.itemsAt(p.x, p.y).length) { if (A.pickup(game)) return; }
  const sd = lv.stairsDown;
  const safe = (x, y) => lv.walkable(x, y) && !lv.prop(x, y).deadly && !lv.prop(x, y).chasm;
  const path = aStar(lv, p.x, p.y, sd.x, sd.y, safe) || aStar(lv, p.x, p.y, sd.x, sd.y, (x, y) => lv.walkable(x, y));
  if (path && path.length > 1) A.move(game, path[1].x - p.x, path[1].y - p.y); else A.wait(game);
}
function play(g, n) { for (let i = 0; i < n && g.state === 'play'; i++) autoStep(g); }
function roundtrip(g) { return Game.deserialize(JSON.parse(JSON.stringify(g.serialize()))); }

test('保存→復元で、要点が一致する', () => {
  const g = new Game(424242);
  play(g, 350);
  const g2 = roundtrip(g);
  assert.equal(g2.depth, g.depth);
  assert.equal(g2.player.hp, g.player.hp);
  assert.equal(g2.player.turns, g.player.turns);
  assert.equal(g2.player.kills, g.player.kills);
  assert.equal(g2.player.gold, g.player.gold);
  assert.equal(g2.player.level, g.player.level);
  assert.equal(g2.player.focus, g.player.focus);
  assert.equal(g2.player.cls, g.player.cls);
  assert.equal(g2.board.monsters().length, g.board.monsters().length);
  assert.equal(g2.board.items.length, g.board.items.length);
  assert.deepEqual(Array.from(g2.level.tiles), Array.from(g.level.tiles));
  assert.equal(g2.player.inv.length, g.player.inv.length);
});

test('復元後も同じ続きが流れる（決定性が保たれる）', () => {
  const g = new Game(98765, { cls: 'mage' });
  play(g, 300);
  const g2 = roundtrip(g);
  // 双方を同じだけ進める
  play(g, 200);
  play(g2, 200);
  assert.equal(g2.player.turns, g.player.turns);
  assert.equal(g2.depth, g.depth);
  assert.equal(g2.player.hp, g.player.hp);
  assert.equal(g2.player.kills, g.player.kills);
  assert.equal(g2.state, g.state);
});

test('過去の階も保たれ、上り下りで同じ盤に戻れる', () => {
  const g = new Game(31415);
  // 2 階まで降りる
  for (let i = 0; i < 1500 && g.depth < 2 && g.state === 'play'; i++) autoStep(g);
  if (g.depth >= 2) {
    const g2 = roundtrip(g);
    assert.ok(g2.levels.has(1) && g2.levels.has(g.depth));
    // 1 階の地形が一致
    assert.deepEqual(Array.from(g2.levels.get(1).level.tiles), Array.from(g.levels.get(1).level.tiles));
  }
});

test('店主の敵対状態も保存される', () => {
  const g = new Game(2024);
  // 店主を作って怒らせ、保存復元
  const k = makeMonster(g.rng, 'shopkeeper', g.player.x + 2, g.player.y);
  g.board.addActor(k);
  g.angerKeeper(k);
  const g2 = roundtrip(g);
  const k2 = g2.board.actors.find(a => a.defId === 'shopkeeper');
  assert.ok(k2);
  assert.equal(k2.faction, 'monster');
  assert.equal(k2.ai, 'melee');
});
