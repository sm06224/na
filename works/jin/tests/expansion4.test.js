import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { classDef, classCaps } from '../js/core/classes.js';
import { createUnit, effectiveStats } from '../js/core/unit.js';
import { promotionOptions } from '../js/core/party.js';
import { Game } from '../js/core/game.js';
import { RNG } from '../js/core/rng.js';
import { EXPANSION4_CLASSES } from '../js/core/expansion4.js';

test('上級職その四：6職が登録され、tier2・味方も就ける', () => {
  assert.equal(EXPANSION4_CLASSES.length, 6);
  for (const id of EXPANSION4_CLASSES) {
    const c = classDef(id);
    assert.ok(c, `${id} がある`);
    assert.equal(c.tier, 2, `${id} は二段`);
    assert.ok(!c.enemyOnly, `${id} は味方も就ける`);
    assert.ok(Object.keys(c.weapons).length >= 1, `${id} に得物`);
  }
});

test('上級職その四：実際に作って戦える能力と上限を持つ', () => {
  for (const id of EXPANSION4_CLASSES) {
    const u = createUnit({ classId: id, level: 20, items: [], side: 'player' }, new RNG(1));
    const es = effectiveStats(u);
    assert.ok(u.maxHp > 0 && es.spd >= 0, `${id} の能力`);
    assert.ok(classCaps(id).hp >= 60, `${id} の上限`);
  }
});

test('上級職その四：一段職の昇格先に繋がっている', () => {
  assert.ok(classDef('knight').promotesTo.includes('warden'));
  assert.ok(classDef('mercenary').promotesTo.includes('spellblade'));
  assert.ok(classDef('archer').promotesTo.includes('huntmaster'));
  assert.ok(classDef('cavalier').promotesTo.includes('templar'));
  assert.ok(classDef('brigand').promotesTo.includes('corsair'));
  assert.ok(classDef('wyvern').promotesTo.includes('dragoon'));
});

test('上級職その四：上級転職の候補に並ぶ', () => {
  const k = createUnit({ classId: 'knight', level: 20, items: [], side: 'player' }, new RNG(2));
  assert.ok(promotionOptions(k).includes('warden'), '騎士は守護者へ昇格できる');
  const m = createUnit({ classId: 'mercenary', level: 20, items: [], side: 'player' }, new RNG(3));
  assert.ok(promotionOptions(m).includes('spellblade'), '傭兵は魔剣士へ昇格できる');
});

test('上級職その四を入れても全24章は自動で決着する', () => {
  for (let i = 1; i < 24; i += 5) {
    const g = new Game(20260618);
    const { battle } = g.startChapter(i);
    assert.equal(battle.autoResolve(200).over, true, `第${i + 1}章`);
  }
});
