import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { classDef, classCaps } from '../js/core/classes.js';
import { createUnit, effectiveStats } from '../js/core/unit.js';
import { promotionOptions } from '../js/core/party.js';
import { Game } from '../js/core/game.js';
import { RNG } from '../js/core/rng.js';
import { EXPANSION3_CLASSES } from '../js/core/expansion3.js';
import { SONGS } from '../js/core/songs.js';
import { EXTRA_SONGS4 } from '../js/core/songs4.js';
import { parseTrack } from '../js/core/notation.js';

test('上級職その三：6職が登録され、tier2・味方も就ける', () => {
  assert.equal(EXPANSION3_CLASSES.length, 6);
  for (const id of EXPANSION3_CLASSES) {
    const c = classDef(id);
    assert.ok(c, `${id} がある`);
    assert.equal(c.tier, 2, `${id} は二段`);
    assert.ok(!c.enemyOnly, `${id} は味方も就ける`);
    assert.ok(Object.keys(c.weapons).length >= 1, `${id} に得物`);
  }
});

test('上級職その三：実際に作って戦える能力と上限を持つ', () => {
  for (const id of EXPANSION3_CLASSES) {
    const u = createUnit({ classId: id, level: 20, items: [], side: 'player' }, new RNG(1));
    const es = effectiveStats(u);
    assert.ok(u.maxHp > 0 && es.spd >= 0, `${id} の能力`);
    assert.ok(classCaps(id).hp >= 60, `${id} の上限`);
  }
});

test('上級職その三：一段職の昇格先に繋がっている', () => {
  assert.ok(classDef('fighter').promotesTo.includes('warlord'));
  assert.ok(classDef('brigand').promotesTo.includes('ravager'));
  assert.ok(classDef('shaman').promotesTo.includes('nightcaller'));
  assert.ok(classDef('monk').promotesTo.includes('lightsage'));
  assert.ok(classDef('wyvern').promotesTo.includes('skylord'));
  assert.ok(classDef('pegasus').promotesTo.includes('windrider'));
});

test('上級職その三：上級転職の候補に並ぶ', () => {
  const f = createUnit({ classId: 'fighter', level: 20, items: [], side: 'player' }, new RNG(2));
  assert.ok(promotionOptions(f).includes('warlord'), '戦士は大将へ昇格できる');
  const w = createUnit({ classId: 'wyvern', level: 20, items: [], side: 'player' }, new RNG(3));
  assert.ok(promotionOptions(w).includes('skylord'), '飛竜は飛将へ昇格できる');
});

test('上級職その三を入れても全24章は自動で決着する', () => {
  for (let i = 0; i < 24; i += 4) {
    const g = new Game(20260617);
    const { battle } = g.startChapter(i);
    assert.equal(battle.autoResolve(200).over, true, `第${i + 1}章`);
  }
});

test('凱歌・安らぎ・急襲の曲が SONGS に登録され、拍に揃う', () => {
  for (const key of ['fanfare', 'peace', 'ambush']) {
    assert.ok(EXTRA_SONGS4[key], `${key} がある`);
    assert.ok(SONGS[key] === EXTRA_SONGS4[key], `${key} が合流`);
    const s = SONGS[key];
    assert.ok(s.name && s.bpm > 0 && s.loopSteps > 0 && s.tracks.length >= 3);
    for (const t of s.tracks) {
      assert.ok(['square', 'square2', 'triangle', 'bass', 'drum'].includes(t.inst), `${key} の音源`);
      assert.equal(parseTrack(t.data).length, s.loopSteps, `${key} の ${t.inst} が拍に揃う`);
    }
  }
});
