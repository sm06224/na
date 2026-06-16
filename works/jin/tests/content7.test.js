import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { classDef } from '../js/core/classes.js';
import { BESTIARY, WORLD } from '../js/core/lore.js';
import { SUPPORTS } from '../js/core/script.js';
import { EXTRA_SUPPORTS7 } from '../js/core/script8.js';
import { EXTRA_BESTIARY7, EXTRA_WORLD7 } from '../js/core/lore_extra7.js';

const CAST = new Set(['リン', 'ガレス', 'セラ', 'ロウェン', 'ミラ', 'カイ', 'フィオ', 'ドラン', 'オレン', 'リーザ', 'グンナル', 'ノエル', 'セレネ', 'ガイル', 'ミーア']);

test('支援会話の追補・其の八：12組が本編へ合流、当事者は実在の仲間', () => {
  assert.equal(EXTRA_SUPPORTS7.length, 12);
  const seen = new Set();
  for (const s of EXTRA_SUPPORTS7) {
    assert.ok(SUPPORTS.includes(s), `${s.a}＆${s.b} が合流`);
    assert.ok(CAST.has(s.a) && CAST.has(s.b) && s.a !== s.b);
    const k = [s.a, s.b].sort().join('|');
    assert.ok(!seen.has(k), `増補内で重複なし ${k}`); seen.add(k);
    assert.ok(s.lines.length >= 5 && s.lines.length <= 8);
    for (const l of s.lines) assert.ok((l.who === s.a || l.who === s.b) && l.line && !/[\n\r]/.test(l.line));
  }
});

test('図鑑の追補・其の七：魔物20・世界史16が本編へ合流、実在職', () => {
  assert.equal(EXTRA_BESTIARY7.length, 20);
  assert.equal(EXTRA_WORLD7.length, 16);
  for (const e of EXTRA_BESTIARY7) {
    assert.ok(classDef(e.classId) && e.name && e.blurb && e.tactics && BESTIARY.includes(e), `${e.name}`);
  }
  for (const w of EXTRA_WORLD7) assert.ok(WORLD.includes(w) && w.title && w.text, `${w.title}`);
});

test('語りの総数がさらに増えた（支援88以上・魔物誌170以上）', () => {
  assert.ok(SUPPORTS.length >= 88, `支援が豊富（${SUPPORTS.length}）`);
  assert.ok(BESTIARY.length >= 170, `魔物誌が豊富（${BESTIARY.length}）`);
});
