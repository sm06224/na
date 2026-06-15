import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/core/game.js';
import { T } from '../js/core/tile.js';
import { F } from '../js/core/level.js';
import { makeMonster, makeItem } from '../js/core/factory.js';
import { applyEffect } from '../js/core/effects.js';
import * as A from '../js/core/actions.js';

function arena(game, clear = true) {
  for (const m of game.board.monsters()) game.board.removeActor(m);
  const p = game.player;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = p.x + dx, y = p.y + dy;
    if (x > 0 && y > 0 && x < game.level.w - 1 && y < game.level.h - 1) game.level.set(x, y, T.FLOOR);
  }
  game.recomputeFOV(); game.recomputeDist();
}

test('休む：傷が癒え、手数が進む', () => {
  const g = new Game(1); arena(g);
  g.player.hp = 5;
  const t0 = g.player.turns;
  A.rest(g);
  assert.ok(g.player.hp > 5, '回復していない');
  assert.ok(g.player.turns > t0, '手数が進んでいない');
});

test('休む：近くに魔物がいると休めない', () => {
  const g = new Game(2); arena(g);
  g.player.hp = 5;
  const m = makeMonster(g.rng, 'rat', g.player.x + 2, g.player.y); m.flags.sleeping = false; g.board.addActor(m);
  g.recomputeFOV();
  const hp0 = g.player.hp;
  A.rest(g);
  assert.equal(g.player.hp, hp0, '魔物がいるのに休んだ');
});

test('罠外し：隣の見つけた罠を外せる', () => {
  const g = new Game(3); arena(g);
  const p = g.player;
  g.level.set(p.x + 1, p.y, T.TRAP);
  g.level.setFlag(p.x + 1, p.y, F.DISCOVERED, true);
  // 決定的に成功するまで何度か試す（成功率 0.7）
  let cleared = false;
  for (let i = 0; i < 20; i++) { A.disarm(g); if (g.level.get(p.x + 1, p.y) === T.FLOOR) { cleared = true; break; } g.level.set(p.x + 1, p.y, T.TRAP); g.level.setFlag(p.x + 1, p.y, F.DISCOVERED, true); }
  assert.ok(cleared, '罠を一度も外せなかった');
});

test('祭壇：祈ると何かが起き、祭壇は消える（一度きり）', () => {
  const g = new Game(7); arena(g);
  const p = g.player;
  g.level.set(p.x, p.y, T.ALTAR);
  const t0 = p.turns;
  assert.ok(A.interact(g));               // 足元が祭壇 → 祈る
  assert.equal(g.level.get(p.x, p.y), T.FLOOR, '祭壇が残っている');
  assert.ok(p.turns > t0, '手番が進んでいない');
});

test('新しい効能：英雄の薬で剛力と俊足、瞬きで移動', () => {
  const g = new Game(4); arena(g);
  applyEffect(g, 'heroism', { user: g.player, item: makeItem(g.rng, 'p_heroism') });
  assert.ok(g.player.hasStatus('might') && g.player.hasStatus('haste'));
  const x0 = g.player.x, y0 = g.player.y;
  applyEffect(g, 'blink', { user: g.player, item: makeItem(g.rng, 's_blink') });
  assert.ok(g.player.x !== x0 || g.player.y !== y0, '瞬きで動いていない');
});
