import test from 'node:test';
import assert from 'node:assert/strict';
import { WEATHER, weatherOf, weatherForChapter, weatherHitMod, weatherMightMod } from '../js/core/weather.js';
import { ITEMS } from '../js/core/items.js';
import '../js/core/items_extra.js';
import { Game } from '../js/core/game.js';
import { RNG } from '../js/core/rng.js';
import { createUnit } from '../js/core/unit.js';
import { strikeInfo } from '../js/core/combat.js';
import { Board } from '../js/core/board.js';

test('天候：表に矛盾がない（晴れは無補正）', () => {
  assert.equal(WEATHER.clear.hit, 0);
  assert.equal(WEATHER.clear.ranged, 0);
  for (const w of Object.values(WEATHER)) {
    assert.ok(typeof w.name === 'string' && w.name.length > 0);
    assert.ok(typeof w.line === 'string' && w.line.length > 0);
    assert.ok(/^#[0-9a-f]{6}$/i.test(w.sky), `sky色: ${w.id}`);
  }
});

test('天候：種と章から決定的に決まる', () => {
  for (const biome of ['green', 'desert', 'snow', 'volcano', 'ruins']) {
    for (let ch = 0; ch < 16; ch++) {
      const a = weatherForChapter(20260615, ch, biome);
      const b = weatherForChapter(20260615, ch, biome);
      assert.equal(a.id, b.id, `${biome}章${ch}`);
      assert.ok(WEATHER[a.id], '実在する天候');
    }
  }
});

test('天候：種が違えば空も移ろう', () => {
  const ids = new Set();
  for (let s = 0; s < 40; s++) ids.add(weatherForChapter(1000 + s, 0, 'green').id);
  assert.ok(ids.size >= 2, '種ごとに空が変わりうる');
});

test('天候：地勢ごとに出る空が偏る（雪嶺は吹雪が出る／砂漠は砂嵐）', () => {
  const snow = new Set(), desert = new Set();
  for (let s = 0; s < 60; s++) { snow.add(weatherForChapter(s, 0, 'snow').id); desert.add(weatherForChapter(s, 0, 'desert').id); }
  assert.ok(snow.has('snow'), '雪嶺で吹雪');
  assert.ok(desert.has('sandstorm'), '砂漠で砂嵐');
  assert.ok(!desert.has('snow'), '砂漠に吹雪は無い');
});

test('天候：弓は雨でいっそう当たらず、晴れでは元どおり', () => {
  const bow = ITEMS.iron_bow || { wtype: 'bow', max: 2, mt: 6, hit: 85 };
  const rainPenalty = weatherHitMod(WEATHER.rain, bow);
  const clearPenalty = weatherHitMod(WEATHER.clear, bow);
  assert.ok(rainPenalty < clearPenalty, '雨の弓は当たりにくい');
  assert.equal(clearPenalty, 0, '晴れは無補正');
});

test('天候：近接剣は射程の補正を受けない', () => {
  const sword = ITEMS.iron_sword;
  // 嵐の一般命中補正だけは効くが、射程ぶんは効かない
  assert.equal(weatherHitMod(WEATHER.storm, sword), WEATHER.storm.hit);
});

test('天候：陽炎は理（火）の威力を増し、雨は削ぐ', () => {
  const fire = Object.values(ITEMS).find(i => i.wtype === 'anima');
  assert.ok(fire, '理の得物がある');
  assert.ok(weatherMightMod(WEATHER.haze, fire) > 0, '陽炎で増す');
  assert.ok(weatherMightMod(WEATHER.rain, fire) < 0, '雨で削がれる');
  assert.equal(weatherMightMod(WEATHER.rain, ITEMS.iron_sword), 0, '物理は影響なし');
});

test('天候：盤の board.weather が strikeInfo の命中に効く', () => {
  const r = new RNG(5);
  const a = createUnit({ classId: 'archer', level: 8, items: ['iron_bow'], side: 'player' }, r.derive('a'));
  const d = createUnit({ classId: 'soldier', level: 8, items: ['iron_lance'], side: 'enemy' }, r.derive('d'));
  const board = new Board(8, 8);
  board.add(a, 1, 1); board.add(d, 3, 1); board.rebuildIndex();
  board.weather = WEATHER.clear;
  const clearHit = strikeInfo(a, d, board).hit;
  board.weather = WEATHER.storm;
  const stormHit = strikeInfo(a, d, board).hit;
  assert.ok(stormHit < clearHit, '嵐では弓の命中が落ちる');
});

test('天候：実キャンペーンの章に空が宿る', () => {
  const g = new Game(20260615);
  const { battle } = g.startChapter(0);
  assert.ok(battle.board.weather && WEATHER[battle.board.weather.id], '盤に天候がある');
});
