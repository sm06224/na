import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { classDef, classCaps } from '../js/core/classes.js';
import { createUnit, effectiveStats } from '../js/core/unit.js';
import { promotionOptions } from '../js/core/party.js';
import { Game } from '../js/core/game.js';
import { RNG } from '../js/core/rng.js';
import { EXPANSION5_CLASSES } from '../js/core/expansion5.js';

test('上級職その五：6職が登録され、tier2・味方も就ける', () => {
  assert.equal(EXPANSION5_CLASSES.length, 6);
  for (const id of EXPANSION5_CLASSES) {
    const c = classDef(id);
    assert.ok(c && c.tier === 2 && !c.enemyOnly && Object.keys(c.weapons).length >= 1, `${id}`);
  }
});

test('上級職その五：実際に作って戦える能力と上限を持つ', () => {
  for (const id of EXPANSION5_CLASSES) {
    const u = createUnit({ classId: id, level: 20, items: [], side: 'player' }, new RNG(1));
    const es = effectiveStats(u);
    assert.ok(u.maxHp > 0 && es.spd >= 0 && classCaps(id).hp >= 60, `${id}`);
  }
});

test('上級職その五：一段職の昇格先に繋がっている', () => {
  assert.ok(classDef('mercenary').promotesTo.includes('vanguard'));
  assert.ok(classDef('cleric').promotesTo.includes('warpriest'));
  assert.ok(classDef('thief').promotesTo.includes('shadowdancer'));
  assert.ok(classDef('mage').promotesTo.includes('stormcaller'));
  assert.ok(classDef('brigand').promotesTo.includes('beastrider'));
  assert.ok(classDef('cavalier').promotesTo.includes('runeknight'));
});

test('上級職その五：上級転職の候補に並ぶ', () => {
  const m = createUnit({ classId: 'mage', level: 20, items: [], side: 'player' }, new RNG(2));
  assert.ok(promotionOptions(m).includes('stormcaller'), '魔道士は嵐術師へ昇格できる');
});

test('上級職その五を入れても全24章は自動で決着する', () => {
  for (let i = 2; i < 24; i += 5) {
    const g = new Game(20260619);
    const { battle } = g.startChapter(i);
    assert.equal(battle.autoResolve(200).over, true, `第${i + 1}章`);
  }
});
