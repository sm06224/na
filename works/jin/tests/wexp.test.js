import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../js/core/rng.js';
import { createUnit, canUse, unitRank, gainWexp, promote } from '../js/core/unit.js';
import { item, rankValue } from '../js/core/items.js';
import { Game } from '../js/core/game.js';

test('熟練度：生成時に扱える型へ段が付き、持ち物は必ず使える', () => {
  const r = new RNG(5);
  const u = createUnit({ classId: 'mercenary', level: 3, items: ['iron_sword'], side: 'player' }, r);
  assert.ok(u.wexp && typeof u.wexp.sword === 'number', '剣の熟練度を持つ');
  assert.ok(canUse(u, item('iron_sword')), '持ち物は使える');
  assert.ok(unitRank(u, 'sword') >= 0);
});

test('熟練度：使うほど段が上がる（クラス上限まで）', () => {
  const r = new RNG(9);
  const u = createUnit({ classId: 'mercenary', level: 1, items: ['iron_sword'], side: 'player' }, r);
  u.wexp.sword = 0;                         // E から
  assert.ok(!canUse(u, item('silver_sword')), '最初は銀の剣は使えない');
  let ups = 0;
  for (let i = 0; i < 200; i++) { if (gainWexp(u, 'sword', 2)) ups++; }
  // 勇者/剣聖の前（傭兵）の上限は剣C。Cまで上がって頭打ち
  assert.equal(unitRank(u, 'sword'), rankValue('C'), '傭兵の上限C で頭打ち');
  assert.ok(ups >= 1, '段位が上がった');
});

test('熟練度：扱えない型は上がらない', () => {
  const r = new RNG(3);
  const u = createUnit({ classId: 'mercenary', level: 5, items: ['iron_sword'], side: 'player' }, r);
  assert.equal(gainWexp(u, 'axe', 50), null, '傭兵は斧を覚えない');
  assert.ok(!canUse(u, item('iron_axe')));
});

test('転職：上限が上がり、銀の得物まで届く', () => {
  const r = new RNG(11);
  const u = createUnit({ classId: 'mercenary', level: 12, items: ['iron_sword'], side: 'player' }, r);
  u.wexp.sword = 999;                       // 傭兵では C 止まり
  assert.equal(unitRank(u, 'sword'), rankValue('C'));
  promote(u, 'swordmaster');                // 剣聖は剣S
  assert.equal(unitRank(u, 'sword'), rankValue('S'), '転職で段位が解ける');
  assert.ok(canUse(u, item('silver_sword')));
});

test('ボスの高位武器：生成時から使える（底上げ）', () => {
  const r = new RNG(7);
  const boss = createUnit({ classId: 'hero', level: 18, items: ['silver_sword'], side: 'enemy', boss: true }, r);
  assert.ok(canUse(boss, item('silver_sword')), '銀の剣を構えられる');
});

test('保存：熟練度も復元される', async () => {
  const { encodeSave, decodeSave } = await import('../js/core/save.js');
  const g = new Game(20260615);
  g.party[5].wexp = g.party[5].wexp || {}; g.party[5].wexp.sword = 123;
  const g2 = decodeSave(encodeSave(g));
  assert.equal(g2.party[5].wexp.sword, 123);
});
