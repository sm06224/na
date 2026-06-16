import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { classDef } from '../js/core/classes.js';
import { BESTIARY, WORLD } from '../js/core/lore.js';
import { SUPPORTS } from '../js/core/script.js';
import { EXTRA_SUPPORTS5 } from '../js/core/script6.js';
import { EXTRA_BESTIARY4, EXTRA_WORLD4 } from '../js/core/lore_extra4.js';

const CAST = new Set(['リン', 'ガレス', 'セラ', 'ロウェン', 'ミラ', 'カイ', 'フィオ', 'ドラン', 'オレン', 'リーザ', 'グンナル', 'ノエル', 'セレネ', 'ガイル', 'ミーア']);

test('支援会話の追補・其の六：14組が本編へ合流、当事者は実在の仲間', () => {
  assert.equal(EXTRA_SUPPORTS5.length, 14);
  const seen = new Set();
  for (const s of EXTRA_SUPPORTS5) {
    assert.ok(SUPPORTS.includes(s), `${s.a}＆${s.b} が合流`);
    assert.ok(CAST.has(s.a) && CAST.has(s.b) && s.a !== s.b, `${s.a}・${s.b} は別々の仲間`);
    const key = [s.a, s.b].sort().join('|');
    assert.ok(!seen.has(key), `重複なし ${key}`); seen.add(key);
    assert.ok(s.lines.length >= 5 && s.lines.length <= 8, `会話の長さ ${key}`);
    for (const l of s.lines) assert.ok((l.who === s.a || l.who === s.b) && l.line && !/[\n\r]/.test(l.line));
  }
});

test('図鑑の追補・其の四：魔物20・世界史16が本編へ合流、実在職', () => {
  assert.equal(EXTRA_BESTIARY4.length, 20);
  assert.equal(EXTRA_WORLD4.length, 16);
  for (const e of EXTRA_BESTIARY4) {
    assert.ok(classDef(e.classId), `職 ${e.classId}`);
    assert.ok(e.name && e.blurb && e.tactics, `${e.name} の記述`);
    assert.ok(BESTIARY.includes(e), `${e.name} が図鑑に`);
  }
  for (const w of EXTRA_WORLD4) assert.ok(WORLD.includes(w) && w.title && w.text, `${w.title} が世界史に`);
});

test('語りの総数がさらに増えた（支援60以上・魔物誌110以上）', () => {
  assert.ok(SUPPORTS.length >= 60, `支援が豊富（${SUPPORTS.length}）`);
  assert.ok(BESTIARY.length >= 110, `魔物誌が豊富（${BESTIARY.length}）`);
});
