import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/core/game.js';
import { T } from '../js/core/tile.js';
import { makeItem, makeMonster } from '../js/core/factory.js';
import { priceOf, tagForSale, isForSale, priceTag } from '../js/core/shop.js';
import * as A from '../js/core/actions.js';

function arena(game) {
  for (const m of game.board.actors.filter(a => a.faction !== 'player')) game.board.removeActor(m);
  const p = game.player;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = p.x + dx, y = p.y + dy;
    if (x > 0 && y > 0 && x < game.level.w - 1 && y < game.level.h - 1) game.level.set(x, y, T.FLOOR);
  }
  game.recomputeFOV(); game.recomputeDist();
}

test('値づけ：付呪や残量で高くなり、最低 5 金', () => {
  const g = new Game(1);
  const plain = makeItem(g.rng, 'longsword', { enchant: 0 }); plain.cursed = false;
  const fine = makeItem(g.rng, 'longsword', { enchant: 5 }); fine.cursed = false;
  assert.ok(priceOf(fine, 5) > priceOf(plain, 5));
  assert.ok(priceOf(makeItem(g.rng, 'f_apple'), 1) >= 5);
});

test('売り物には値札がつく', () => {
  const g = new Game(2);
  const it = makeItem(g.rng, 'p_heal');
  tagForSale(it, 4);
  assert.ok(isForSale(it));
  assert.ok(priceTag(it) > 0);
});

test('購入：金が足りれば買え、足りなければ買えない', () => {
  const g = new Game(3); arena(g);
  const p = g.player;
  const it = makeItem(g.rng, 'p_heal'); tagForSale(it, 3);
  g.board.addItem(it, p.x, p.y);
  // 金不足
  p.gold = 0;
  assert.equal(A.buy(g), false);
  assert.ok(isForSale(it), 'まだ売り物のまま');
  // 金を渡して購入
  const price = priceTag(it);
  p.gold = price + 10;
  assert.ok(A.buy(g));
  assert.equal(p.gold, 10);                              // 価格ぶん減る
  assert.ok(p.inv.some(i => i.def === 'p_heal'));
  assert.equal(g.board.itemsAt(p.x, p.y).length, 0);
});

test('未購入の売り物は拾えない（値札の案内が出る）', () => {
  const g = new Game(4); arena(g);
  const p = g.player;
  const it = makeItem(g.rng, 's_identify'); tagForSale(it, 2);
  g.board.addItem(it, p.x, p.y);
  assert.equal(A.pickup(g), false);
  assert.equal(g.board.itemsAt(p.x, p.y).length, 1, '拾えてしまった');
});

test('店主：中立だが、傷つけると敵対する', () => {
  const g = new Game(5); arena(g);
  const k = makeMonster(g.rng, 'shopkeeper', g.player.x + 1, g.player.y);
  assert.equal(k.faction, 'neutral');
  g.board.addActor(k);
  g.hurt(k, 5, g.player);
  assert.equal(k.faction, 'monster');
  assert.equal(k.ai, 'melee');
});
