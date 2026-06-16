import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { classDef } from '../js/core/classes.js';
import { BESTIARY, WORLD } from '../js/core/lore.js';
import { SUPPORTS } from '../js/core/script.js';
import { EXTRA_SUPPORTS6 } from '../js/core/script7.js';
import { EXTRA_BESTIARY6, EXTRA_WORLD6 } from '../js/core/lore_extra6.js';

const CAST = new Set(['リン', 'ガレス', 'セラ', 'ロウェン', 'ミラ', 'カイ', 'フィオ', 'ドラン', 'オレン', 'リーザ', 'グンナル', 'ノエル', 'セレネ', 'ガイル', 'ミーア']);

test('支援会話の追補・其の七：12組が本編へ合流、当事者は実在の仲間', () => {
  assert.equal(EXTRA_SUPPORTS6.length, 12);
  for (const s of EXTRA_SUPPORTS6) {
    assert.ok(SUPPORTS.includes(s), `${s.a}＆${s.b} が合流`);
    assert.ok(CAST.has(s.a) && CAST.has(s.b) && s.a !== s.b, `${s.a}・${s.b} は別々の仲間`);
    assert.ok(s.lines.length >= 5 && s.lines.length <= 8, `会話の長さ`);
    for (const l of s.lines) assert.ok((l.who === s.a || l.who === s.b) && l.line && !/[\n\r]/.test(l.line));
  }
});

test('支援会話の追補・其の七：12組は互いに重複しない', () => {
  const norm = p => [p.a, p.b].sort().join('|');
  const seen = new Set();
  for (const s of EXTRA_SUPPORTS6) {
    const k = norm(s);
    assert.ok(!seen.has(k), `増補内で重複なし ${k}`); seen.add(k);
  }
  assert.equal(seen.size, 12);
});

test('図鑑の追補・其の六：魔物20・世界史16が本編へ合流、実在職', () => {
  assert.equal(EXTRA_BESTIARY6.length, 20);
  assert.equal(EXTRA_WORLD6.length, 16);
  for (const e of EXTRA_BESTIARY6) {
    assert.ok(classDef(e.classId), `職 ${e.classId}`);
    assert.ok(e.name && e.blurb && e.tactics && BESTIARY.includes(e), `${e.name} が図鑑に`);
  }
  for (const w of EXTRA_WORLD6) assert.ok(WORLD.includes(w) && w.title && w.text, `${w.title} が世界史に`);
});

test('語りの総数がさらに増えた（支援76以上・魔物誌150以上）', () => {
  assert.ok(SUPPORTS.length >= 76, `支援が豊富（${SUPPORTS.length}）`);
  assert.ok(BESTIARY.length >= 150, `魔物誌が豊富（${BESTIARY.length}）`);
});
