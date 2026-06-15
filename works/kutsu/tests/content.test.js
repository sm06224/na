import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../js/core/rng.js';
import { allMonsters, monstersForDepth, getMonster } from '../js/core/monsterdb.js';
import { allItemDefs, itemsForDepth, itemKeysByCategory } from '../js/core/itemdb.js';
import { APPEARANCE } from '../js/core/itemdb.js';
import { hasEffect } from '../js/core/effects.js';
import { makeMonster, makeItem } from '../js/core/factory.js';
import { Game } from '../js/core/game.js';

test('魔物の定義はどれも整っている', () => {
  for (const m of allMonsters()) {
    assert.ok(m.name && m.glyph, `${m.key} に名か字がない`);
    assert.ok(m.hp > 0, `${m.key} の hp`);
    assert.ok(Array.isArray(m.depth) && m.depth.length === 2 && m.depth[0] <= m.depth[1], `${m.key} の深さ帯`);
    assert.ok(typeof m.ai === 'string', `${m.key} の ai`);
    assert.ok(m.damage, `${m.key} の damage`);
  }
});

test('どの深さ（1〜15）にも棲む魔物がいる', () => {
  for (let d = 1; d <= 15; d++) assert.ok(monstersForDepth(d).length >= 1, `深さ ${d} に魔物がいない`);
});

test('すべての魔物を鋳造できる', () => {
  const rng = new RNG(1);
  for (const m of allMonsters()) {
    const a = makeMonster(rng, m.key, 1, 1);
    assert.ok(a && a.hp > 0 && a.name === m.name);
  }
});

test('品物の定義はどれも整い、効果は存在する', () => {
  for (const d of allItemDefs()) {
    assert.ok(d.name && d.glyph && d.category, `${d.key} の基本情報`);
    if (['potion', 'scroll', 'wand'].includes(d.category)) {
      assert.ok(hasEffect(d.effect), `${d.key} の効果 ${d.effect} が無い`);
    }
    if (d.category === 'wand') assert.ok(Array.isArray(d.charges), `${d.key} の充填`);
  }
});

test('未鑑定の見た目は、品数ぶん足りている', () => {
  for (const cat of Object.keys(APPEARANCE)) {
    const n = itemKeysByCategory(cat).length;
    assert.ok(APPEARANCE[cat].length >= n, `${cat} の見た目が ${n} に足りない（${APPEARANCE[cat].length}）`);
  }
});

test('すべての品物を鋳造できる', () => {
  const rng = new RNG(2);
  for (const d of allItemDefs()) {
    const it = makeItem(rng, d.key, { depth: 5 });
    assert.ok(it && it.def === d.key);
  }
});

test('深さ 1 でも落とし物の候補がある', () => {
  assert.ok(itemsForDepth(1).length >= 3);
});

test('鑑定の見た目は潜行ごとに（種で）入れ替わる', () => {
  const a = new Game(111).ids.appearanceOf('potion', 'p_heal');
  const b = new Game(222).ids.appearanceOf('potion', 'p_heal');
  // 必ずしも違うとは限らないが、種を変えれば多くは入れ替わる
  let diff = 0;
  for (const k of itemKeysByCategory('potion')) if (new Game(111).ids.appearanceOf('potion', k) !== new Game(222).ids.appearanceOf('potion', k)) diff++;
  assert.ok(diff > 0, '見た目が一切入れ替わっていない');
});
