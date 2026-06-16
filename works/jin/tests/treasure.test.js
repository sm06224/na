import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { ITEMS } from '../js/core/items.js';
import { RNG } from '../js/core/rng.js';
import { createUnit } from '../js/core/unit.js';
import { Board } from '../js/core/board.js';
import { Game } from '../js/core/game.js';
import {
  placeTreasures, treasureAt, canOpenChest, openChest, visitVillage,
  keyIndex, treasureCountFor,
} from '../js/core/treasure.js';

function plainBoard(w = 10, h = 8) {
  const b = new Board(w, h);
  b.terrain.forEach((x, y) => b.setTerrain(x, y, 'plain'));
  return b;
}

test('宝：配置も中身も種から決定的', () => {
  const make = () => { const b = plainBoard(); placeTreasures(b, 4242, { chests: 3, villages: 2, chapterIndex: 5 }); return b.objects; };
  const a = make(), b = make();
  assert.equal(a.length, 5);
  assert.deepEqual(
    a.map(o => [o.type, o.x, o.y, o.locked, JSON.stringify(o.loot || o.gift)]),
    b.map(o => [o.type, o.x, o.y, o.locked, JSON.stringify(o.loot || o.gift)]),
  );
});

test('宝：中身は実在する物か正の金', () => {
  const b = plainBoard(12, 10);
  placeTreasures(b, 7, { chests: 4, villages: 3, chapterIndex: 10 });
  for (const o of b.objects) {
    const reward = o.loot || o.gift;
    if (reward.item) assert.ok(ITEMS[reward.item], `物 ${reward.item}`);
    else assert.ok(reward.gold > 0, '金は正');
  }
});

test('宝：箱と村は別マスに、通れぬマスを避けて置かれる', () => {
  const b = plainBoard(8, 8);
  b.setTerrain(0, 0, 'wall'); b.setTerrain(1, 0, 'throne');
  placeTreasures(b, 99, { chests: 3, villages: 3 });
  const seen = new Set();
  for (const o of b.objects) {
    const k = o.x + ',' + o.y;
    assert.ok(!seen.has(k), '重ならない'); seen.add(k);
    assert.ok(!(o.x === 0 && o.y === 0), '壁を避ける');
    assert.ok(!(o.x === 1 && o.y === 0), '玉座を避ける');
  }
});

test('宝：施錠なしは誰でも開く／施錠は鍵か盗賊が要る', () => {
  const knight = createUnit({ classId: 'knight', level: 5, items: ['iron_lance'], side: 'player' }, new RNG(1));
  const thief = createUnit({ classId: 'thief', level: 5, items: ['iron_sword'], side: 'player' }, new RNG(2));
  const open = { type: 'chest', locked: false, loot: { gold: 100 }, done: false };
  const locked = { type: 'chest', locked: true, loot: { gold: 100 }, done: false };
  assert.equal(canOpenChest(knight, open), true);
  assert.equal(canOpenChest(knight, locked), false, '鍵も技もなければ施錠は開かぬ');
  assert.equal(canOpenChest(thief, locked), true, '盗賊は開錠できる');
});

test('宝：鍵を持てば施錠も開き、鍵を消費する', () => {
  const u = createUnit({ classId: 'knight', level: 5, items: ['iron_lance', 'chest_key'], side: 'player' }, new RNG(3));
  const locked = { type: 'chest', locked: true, loot: { item: 'silver_sword' }, done: false };
  assert.equal(canOpenChest(u, locked), true);
  const before = keyIndex(u);
  assert.ok(before >= 0);
  const { loot, usedKey } = openChest(locked, u);
  assert.equal(loot.item, 'silver_sword');
  assert.equal(usedKey, 'chest_key');
  assert.equal(keyIndex(u), -1, '鍵は使われた');
  assert.equal(locked.done, true);
});

test('宝：盗賊は鍵を消費せず開ける', () => {
  const thief = createUnit({ classId: 'thief', level: 5, items: ['iron_sword', 'chest_key'], side: 'player' }, new RNG(4));
  const locked = { type: 'chest', locked: true, loot: { gold: 500 }, done: false };
  const { usedKey } = openChest(locked, thief);
  assert.equal(usedKey, null, '技で開けたので鍵は減らない');
  assert.equal(keyIndex(thief), 1, '鍵はそのまま（索引1に残る）');
});

test('宝：開けた箱・訪れた村は二度は反応しない', () => {
  const b = plainBoard();
  placeTreasures(b, 11, { chests: 1, villages: 1 });
  const chest = b.objects.find(o => o.type === 'chest');
  const vil = b.objects.find(o => o.type === 'village');
  assert.ok(treasureAt(b, chest.x, chest.y));
  visitVillage(vil); openChest(chest, createUnit({ classId: 'thief', level: 3, side: 'player' }, new RNG(5)));
  assert.equal(treasureAt(b, chest.x, chest.y), null, '済んだ箱は消える');
  assert.equal(treasureAt(b, vil.x, vil.y), null, '済んだ村は消える');
});

test('宝：実キャンペーンの章に宝箱と村が宿り、開ければ実利になる', () => {
  const g = new Game(20260615);
  const { battle } = g.startChapter(0);
  const objs = battle.board.objects;
  assert.ok(objs && objs.length >= 2, '章に宝箱・村がある');
  assert.ok(objs.some(o => o.type === 'chest') && objs.some(o => o.type === 'village'), '両方ある');
  // 鍵を持った者で全部開け、金は所持へ・品は荷駄へ（takeTreasure と同じ手順）
  const carrier = createUnit({ classId: 'thief', level: 8, side: 'player' }, new RNG(1));
  const gold0 = g.gold, conv0 = g.convoy.length;
  let gained = 0, items = 0;
  for (const o of objs.slice()) {
    const res = o.type === 'chest' ? openChest(o, carrier) : visitVillage(o);
    const reward = res.loot || res.gift;
    if (reward.gold) { g.gold += reward.gold; gained += reward.gold; }
    else { g.convoy.push(reward.item); items++; }
  }
  assert.equal(g.gold, gold0 + gained);
  assert.equal(g.convoy.length, conv0 + items);
  assert.ok(battle.board.objects.every(o => o.done), '全て手つかずでなくなる');
});

test('宝：章ごとの数は妥当', () => {
  for (let ch = 0; ch < 16; ch++) {
    const { chests, villages } = treasureCountFor(ch);
    assert.ok(chests >= 1 && chests <= 3);
    assert.ok(villages >= 1 && villages <= 2);
  }
});
