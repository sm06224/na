import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { classDef, classCaps } from '../js/core/classes.js';
import { createUnit, effectiveStats } from '../js/core/unit.js';
import { jobChoices, promotionOptions, canReclass, RECLASS_COST } from '../js/core/party.js';
import { Game } from '../js/core/game.js';
import { RNG } from '../js/core/rng.js';

const NEW = ['starknight', 'skyranger', 'starmage', 'towerguard', 'moonshadow', 'priestess'];

test('上級職：6職が登録され、tier2・味方も就ける', () => {
  for (const id of NEW) {
    const c = classDef(id);
    assert.ok(c, `${id} がある`);
    assert.equal(c.tier, 2, `${id} は二段`);
    assert.ok(!c.enemyOnly, `${id} は味方も就ける`);
    assert.ok(Object.keys(c.weapons).length >= 1, `${id} に得物`);
  }
});

test('上級職：実際に作って戦える能力を持つ', () => {
  for (const id of NEW) {
    const u = createUnit({ classId: id, level: 20, items: [], side: 'player' }, new RNG(1));
    const es = effectiveStats(u);
    assert.ok(u.maxHp > 0 && es.spd >= 0, `${id} の能力`);
    const caps = classCaps(id);
    assert.ok(caps.hp >= 60, `${id} の上限`);
  }
});

test('上級職：一段職の昇格先に繋がっている', () => {
  assert.ok(classDef('cavalier').promotesTo.includes('starknight'));
  assert.ok(classDef('archer').promotesTo.includes('skyranger'));
  assert.ok(classDef('mage').promotesTo.includes('starmage'));
  assert.ok(classDef('knight').promotesTo.includes('towerguard'));
  assert.ok(classDef('thief').promotesTo.includes('moonshadow'));
  assert.ok(classDef('cleric').promotesTo.includes('priestess'));
});

test('上級職：上級転職の候補に並ぶ（一段職を育てて昇格）', () => {
  const cav = createUnit({ classId: 'cavalier', level: 20, items: [], side: 'player' }, new RNG(2));
  assert.ok(promotionOptions(cav).includes('starknight'), '騎兵は星騎士へ昇格できる');
  const arc = createUnit({ classId: 'archer', level: 20, items: [], side: 'player' }, new RNG(3));
  assert.ok(promotionOptions(arc).includes('skyranger'), '射手は天弓士へ昇格できる');
});

test('上級職を入れても全24章は自動で決着する', () => {
  for (let i = 0; i < 24; i += 3) {
    const g = new Game(20260615);
    const { battle } = g.startChapter(i);
    assert.equal(battle.autoResolve(200).over, true, `第${i + 1}章`);
  }
});
