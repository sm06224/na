import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { RNG } from '../js/core/rng.js';
import { createUnit } from '../js/core/unit.js';
import { Board } from '../js/core/board.js';
import { strikeInfo } from '../js/core/combat.js';
import { item as itemDef } from '../js/core/items.js';
import { Game } from '../js/core/game.js';
import { encodeSave, decodeSave } from '../js/core/save.js';
import {
  MAX_FORGE, forgeBonus, forgeCost, weaponStack, forgeLevelOf,
  isForgeable, canForge, applyForge,
} from '../js/core/forge.js';

test('鍛冶：段ごとに威力・命中・会心が増す', () => {
  assert.deepEqual(forgeBonus(0), { mt: 0, hit: 0, crit: 0 });
  assert.deepEqual(forgeBonus(3), { mt: 3, hit: 9, crit: 3 });
  assert.deepEqual(forgeBonus(99), forgeBonus(MAX_FORGE), '上限で頭打ち');
});

test('鍛冶：段が上がるほど費用が増す', () => {
  assert.ok(forgeCost(0) < forgeCost(1) && forgeCost(1) < forgeCost(4));
});

test('鍛冶：杖や道具は鍛えられない', () => {
  assert.equal(isForgeable(itemDef('iron_sword')), true);
  assert.equal(isForgeable(itemDef('heal')), false);
  assert.equal(isForgeable(itemDef('vulnerary')), false);
});

test('鍛冶：金と上限の範囲でだけ鍛えられる', () => {
  const g = { gold: 600 };
  const stack = { id: 'iron_sword', uses: null, forge: 0 };
  assert.equal(canForge(g, stack, itemDef('iron_sword')), true);
  g.gold = 100;
  assert.equal(canForge(g, stack, itemDef('iron_sword')), false, '金が足りねば不可');
  g.gold = 99999; stack.forge = MAX_FORGE;
  assert.equal(canForge(g, stack, itemDef('iron_sword')), false, '上限なら不可');
});

test('鍛冶：鍛えると段が上がり、金が減る', () => {
  const g = { gold: 1000 };
  const stack = { id: 'steel_sword', uses: null, forge: 0 };
  const r = applyForge(g, stack);
  assert.equal(r.level, 1);
  assert.equal(g.gold, 1000 - forgeCost(0));
  assert.equal(stack.forge, 1);
});

test('鍛冶：鍛えた得物は実際に威力と命中が増す', () => {
  const r = new RNG(7);
  const a = createUnit({ classId: 'mercenary', level: 10, items: ['steel_sword'], side: 'player' }, r.derive('a'));
  const foe = createUnit({ classId: 'soldier', level: 10, items: ['iron_lance'], side: 'enemy' }, r.derive('e'));
  const b = new Board(4, 1); b.add(a, 1, 0); b.add(foe, 2, 0); b.rebuildIndex();
  const before = strikeInfo(a, foe, b);
  weaponStack(a).forge = 3;                  // 三段に鍛える
  const after = strikeInfo(a, foe, b);
  assert.equal(after.dmg - before.dmg, 3, '威力＋3');
  assert.equal(after.hit - before.hit, 9, '命中＋9');
  assert.equal(after.crit - before.crit, 3, '会心＋3');
});

test('鍛冶：強化は符号（セーブ）に綴じられ、読み戻せる', () => {
  const g = new Game(777);
  const u = g.party.find(p => weaponStack(p));
  weaponStack(u).forge = 2;
  const g2 = decodeSave(encodeSave(g));
  const u2 = g2.party.find(p => p.name === u.name);
  assert.equal(forgeLevelOf(weaponStack(u2)), 2, '段が残る');
});

test('鍛冶：強化なしの得物は素のまま（既存の挙動は不変）', () => {
  const r = new RNG(9);
  const a = createUnit({ classId: 'fighter', level: 6, items: ['iron_axe'], side: 'player' }, r.derive('a'));
  const foe = createUnit({ classId: 'soldier', level: 6, items: ['iron_lance'], side: 'enemy' }, r.derive('e'));
  const b = new Board(4, 1); b.add(a, 1, 0); b.add(foe, 2, 0); b.rebuildIndex();
  const info = strikeInfo(a, foe, b);
  weaponStack(a).forge = 0;
  assert.deepEqual(strikeInfo(a, foe, b), info, '段0なら変化なし');
});
