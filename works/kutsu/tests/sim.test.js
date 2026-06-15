import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/core/game.js';
import { T } from '../js/core/tile.js';
import { makeMonster, makeItem } from '../js/core/factory.js';
import { addToInv, equipItem, weaponDamage } from '../js/core/inventory.js';
import { applyStatus, tickStatuses } from '../js/core/status.js';
import * as A from '../js/core/actions.js';

/* プレイヤー周りを更地にし、魔物を消す（試験場） */
function arena(game) {
  for (const m of game.board.monsters()) game.board.removeActor(m);
  const p = game.player;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -6; dx <= 6; dx++) {
    const x = p.x + dx, y = p.y + dy;
    if (x > 0 && y > 0 && x < game.level.w - 1 && y < game.level.h - 1) game.level.set(x, y, T.FLOOR);
  }
  game.recomputeFOV(); game.recomputeDist();
}
function spawn(game, key, x, y) { const m = makeMonster(game.rng, key, x, y); m.flags.sleeping = false; m.hp = m.maxhp; game.board.addActor(m); return m; }

test('近接：弱い魔物を倒すと、撃破数と経験が増える', () => {
  const g = new Game(101); arena(g);
  const rat = spawn(g, 'rat', g.player.x + 1, g.player.y);
  const kills0 = g.player.kills, xp0 = g.player.xp;
  for (let i = 0; i < 40 && rat.alive; i++) g.attack(g.player, rat);
  assert.ok(!rat.alive, '鼠を倒せなかった');
  assert.equal(g.player.kills, kills0 + 1);
  assert.ok(g.player.xp > xp0, '経験が増えていない');
});

test('回復の薬：HP が戻る', () => {
  const g = new Game(202); arena(g);
  g.player.hp = 5;
  const pot = makeItem(g.rng, 'p_heal'); pot.count = 1; addToInv(g.player, pot);
  A.drink(g, pot);
  assert.ok(g.player.hp > 5, '回復していない');
});

test('鑑定の巻物：読むとその種が知れる', () => {
  const g = new Game(303); arena(g);
  // 鑑定対象の薬（未鑑定）と、鑑定の巻物
  const unknown = makeItem(g.rng, 'p_strength'); addToInv(g.player, unknown);
  const scroll = makeItem(g.rng, 's_identify'); scroll.count = 1; addToInv(g.player, scroll);
  assert.ok(!g.ids.isKnown('potion', 'p_strength'));
  A.read(g, scroll, unknown);
  assert.ok(g.ids.isKnown('potion', 'p_strength') || g.ids.isKnown('scroll', 's_identify'));
});

test('杖：直線上の魔物に魔力が当たる', () => {
  const g = new Game(404); arena(g);
  const orc = spawn(g, 'orc', g.player.x + 3, g.player.y);
  const hp0 = orc.hp;
  const wand = makeItem(g.rng, 'w_magic', { charges: 5 }); addToInv(g.player, wand);
  A.zap(g, wand, 1, 0);
  assert.ok(!orc.alive || orc.hp < hp0, '杖が当たっていない');
  assert.ok(wand.charges === 4, '残量が減っていない');
});

test('装備：武器を持つと、その傷さいころになる', () => {
  const g = new Game(505); arena(g);
  const sword = makeItem(g.rng, 'longsword', { enchant: 1 });
  addToInv(g.player, sword); equipItem(g.player, sword);
  const wd = weaponDamage(g.player);
  assert.equal(wd.damage, '1d8');
  assert.equal(wd.enchant, 1);
});

test('状態異常：毒は毎ターン削る', () => {
  const g = new Game(606); arena(g);
  g.player.hp = 20;
  applyStatus(g.player, 'poison', 3, 2);
  tickStatuses(g, g.player);
  assert.ok(g.player.hp <= 18, '毒で減っていない');
});

test('持ち物：重なる薬は一つにまとまる', () => {
  const g = new Game(707); arena(g);
  g.player.inv = [];
  addToInv(g.player, makeItem(g.rng, 'p_heal', { count: 1 }));
  addToInv(g.player, makeItem(g.rng, 'p_heal', { count: 2 }));
  const heals = g.player.inv.filter(i => i.def === 'p_heal');
  assert.equal(heals.length, 1);
  assert.equal(heals[0].count, 3);
});

test('呪われた装備は外せない（解呪するまで）', () => {
  const g = new Game(808); arena(g);
  const ring = makeItem(g.rng, 'r_strength', { enchant: -1 });   // 負＝呪い
  addToInv(g.player, ring); equipItem(g.player, ring);
  assert.ok(ring.cursed);
  const slot = Object.keys(g.player.equip).find(s => g.player.equip[s] === ring);
  const r = A.takeOff(g, slot);
  assert.equal(r, false, '呪い装備が外せてしまった');
});
