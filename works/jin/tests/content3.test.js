import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { classDef } from '../js/core/classes.js';
import { BESTIARY, WORLD } from '../js/core/lore.js';
import { SUPPORTS } from '../js/core/script.js';
import { EXTRA_SUPPORTS4 } from '../js/core/script5.js';
import { EXTRA_BESTIARY3, EXTRA_WORLD3 } from '../js/core/lore_extra3.js';

const CAST = new Set(['リン', 'ガレス', 'セラ', 'ロウェン', 'ミラ', 'カイ', 'フィオ', 'ドラン', 'オレン', 'リーザ', 'グンナル', 'ノエル', 'セレネ', 'ガイル', 'ミーア']);

test('支援会話の追補：14組が本編へ合流、当事者は実在の仲間', () => {
  assert.equal(EXTRA_SUPPORTS4.length, 14);
  for (const s of EXTRA_SUPPORTS4) {
    assert.ok(SUPPORTS.includes(s), `${s.a}＆${s.b} が合流`);
    assert.ok(CAST.has(s.a) && CAST.has(s.b), `${s.a}・${s.b} は仲間`);
    assert.ok(s.lines.length >= 5);
    for (const l of s.lines) assert.ok((l.who === s.a || l.who === s.b) && l.line && !/[\n\r]/.test(l.line));
  }
});

test('図鑑の追補：魔物20・世界史16が本編へ合流、実在職', () => {
  assert.equal(EXTRA_BESTIARY3.length, 20);
  assert.equal(EXTRA_WORLD3.length, 16);
  for (const e of EXTRA_BESTIARY3) {
    assert.ok(classDef(e.classId), `職 ${e.classId}`);
    assert.ok(BESTIARY.includes(e), `${e.name} が図鑑に`);
  }
  for (const w of EXTRA_WORLD3) assert.ok(WORLD.includes(w) && w.title && w.text, `${w.title} が世界史に`);
});

test('支援会話の総数が十分に増えた（50以上）', () => {
  assert.ok(SUPPORTS.length >= 50, `支援が豊富（${SUPPORTS.length}）`);
});
