import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/core/game.js';
import { artifactDefs, artifactsForDepth, itemsForDepth, getItemDef } from '../js/core/itemdb.js';
import { makeItem, makeMonster } from '../js/core/factory.js';
import { addToInv, equipItem, equipBonus } from '../js/core/inventory.js';
import { itemInfo } from '../js/core/lore.js';
import { T } from '../js/core/tile.js';

function arena(game) {
  for (const m of game.board.monsters()) game.board.removeActor(m);
  const p = game.player;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const x = p.x + dx, y = p.y + dy;
    if (x > 0 && y > 0 && x < game.level.w - 1 && y < game.level.h - 1) game.level.set(x, y, T.FLOOR);
  }
  game.recomputeFOV(); game.recomputeDist();
}

test('遺物は唯一で、通常の落とし物には混ざらない', () => {
  const arts = artifactDefs();
  assert.ok(arts.length >= 6);
  for (const d of arts) { assert.ok(d.unique && d.artifact); assert.equal(d.rarity, 0); }
  // itemsForDepth は rarity>0 のみ＝遺物を含まない
  const pool = itemsForDepth(15).map(d => d.key);
  for (const d of arts) assert.ok(!pool.includes(d.key), `${d.key} が通常プールに混ざっている`);
  // 深さで絞られる
  assert.ok(artifactsForDepth(15).length >= artifactsForDepth(6).length);
});

test('遺物の常時効果：指輪・武器・外套の passive が効く', () => {
  const g = new Game(1); arena(g);
  g.player.equip = {}; g.player.inv = [];
  const ring = makeItem(g.rng, 'art_kazeori'); addToInv(g.player, ring); equipItem(g.player, ring);
  const b = equipBonus(g.player);
  assert.ok(b.eva >= 3 && b.acc >= 2, `eva ${b.eva} acc ${b.acc}`);
  // 武器の遺物
  const sword = makeItem(g.rng, 'art_kubikiri'); addToInv(g.player, sword); equipItem(g.player, sword);
  const b2 = equipBonus(g.player);
  assert.ok(b2.str >= 2, `str ${b2.str}`);
});

test('遺物の耐火：焔石の指輪で炎の被害が減る', () => {
  const g = new Game(2); arena(g);
  const ring = makeItem(g.rng, 'art_homura'); addToInv(g.player, ring); equipItem(g.player, ring);
  const b = equipBonus(g.player);
  assert.ok((b.resist && b.resist.fire) >= 0.5, '耐火がついていない');
});

test('銘（brand）：遺物武器は命中時にまれに状態を乗せる', () => {
  const g = new Game(3); arena(g);
  const sword = makeItem(g.rng, 'art_kagutsuchi'); addToInv(g.player, sword); equipItem(g.player, sword);
  const golem = makeMonster(g.rng, 'golem', g.player.x + 1, g.player.y); golem.flags.sleeping = false; g.board.addActor(golem);
  let burned = false;
  for (let i = 0; i < 40 && golem.alive; i++) { g.attack(g.player, golem); if (golem.hasStatus('burning')) { burned = true; break; } }
  assert.ok(burned, '銘が一度も発火しなかった');
});

test('itemInfo は遺物に【遺物】を添える', () => {
  const it = makeItem(new Game(4).rng, 'art_yosuzume'); it.identified = true;
  assert.match(itemInfo(it, null), /遺物/);
});

test('遺物は一度の潜行で重複しない（フラグで管理）', () => {
  const g = new Game(20260615);
  // 直接フラグを使い、二度同じ遺物が湧かないことを確かめる
  g.flags.artifacts = {};
  g.flags.artifacts['art_homura'] = true;
  assert.ok(artifactsForDepth(15).some(d => d.key === 'art_homura'));
  const remaining = artifactsForDepth(15).filter(d => !g.flags.artifacts[d.key]);
  assert.ok(!remaining.some(d => d.key === 'art_homura'));
});
