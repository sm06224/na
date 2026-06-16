import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { classDef } from '../js/core/classes.js';
import { BESTIARY, WORLD } from '../js/core/lore.js';
import { SUPPORTS } from '../js/core/script.js';
import { EXTRA_SUPPORTS } from '../js/core/script2.js';
import { EXTRA_SUPPORTS2 } from '../js/core/script3.js';
import { EXTRA_SUPPORTS8 } from '../js/core/script9.js';
import { EXTRA_BESTIARY8, EXTRA_WORLD8 } from '../js/core/lore_extra8.js';

const CAST = new Set(['リン', 'ガレス', 'セラ', 'ロウェン', 'ミラ', 'カイ', 'フィオ', 'ドラン', 'オレン', 'リーザ', 'グンナル', 'ノエル', 'セレネ', 'ガイル', 'ミーア']);

test('支援会話の追補・其の九：10組が本編へ合流、当事者は実在の仲間', () => {
  assert.equal(EXTRA_SUPPORTS8.length, 10);
  for (const s of EXTRA_SUPPORTS8) {
    assert.ok(SUPPORTS.includes(s), `${s.a}＆${s.b} が合流`);
    assert.ok(CAST.has(s.a) && CAST.has(s.b) && s.a !== s.b);
    assert.ok(s.lines.length >= 5 && s.lines.length <= 8);
    for (const l of s.lines) assert.ok((l.who === s.a || l.who === s.b) && l.line && !/[\n\r]/.test(l.line));
  }
});

test('支援会話：15名すべての組み合わせ（105通り）が出揃った', () => {
  const norm = p => [p.a, p.b].sort().join('|');
  const all = [...SUPPORTS, ...EXTRA_SUPPORTS, ...EXTRA_SUPPORTS2];
  const names = [...CAST];
  const have = new Set(all.filter(p => CAST.has(p.a) && CAST.has(p.b)).map(norm));
  let missing = 0;
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    if (!have.has([names[i], names[j]].sort().join('|'))) missing++;
  }
  assert.equal(missing, 0, `未綴の組が無い（残${missing}）`);
});

test('図鑑の追補・其の八：魔物20・世界史16が本編へ合流、実在職', () => {
  assert.equal(EXTRA_BESTIARY8.length, 20);
  assert.equal(EXTRA_WORLD8.length, 16);
  for (const e of EXTRA_BESTIARY8) assert.ok(classDef(e.classId) && e.name && e.blurb && e.tactics && BESTIARY.includes(e), `${e.name}`);
  for (const w of EXTRA_WORLD8) assert.ok(WORLD.includes(w) && w.title && w.text, `${w.title}`);
});

test('語りの総数がさらに増えた（支援100以上・魔物誌190以上）', () => {
  assert.ok(SUPPORTS.length >= 100, `支援が豊富（${SUPPORTS.length}）`);
  assert.ok(BESTIARY.length >= 190, `魔物誌が豊富（${BESTIARY.length}）`);
});
