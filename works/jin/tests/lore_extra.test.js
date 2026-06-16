import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';                 // 全クラス（拡張含む）を登録
import { classDef } from '../js/core/classes.js';
import { BESTIARY, WORLD, WEAPON_NOTES, bestiaryOf } from '../js/core/lore.js';
import { EXTRA_BESTIARY, EXTRA_WORLD, EXTRA_WEAPON_NOTES } from '../js/core/lore_extra.js';
import { WTYPE } from '../js/core/items.js';

test('増補図鑑：16・世界史12・得物ノート5', () => {
  assert.equal(EXTRA_BESTIARY.length, 16);
  assert.equal(EXTRA_WORLD.length, 12);
  assert.equal(Object.keys(EXTRA_WEAPON_NOTES).length, 5);
});

test('増補図鑑：すべての classId が実在する職', () => {
  for (const e of EXTRA_BESTIARY) {
    assert.ok(classDef(e.classId), `職 ${e.classId}`);
    assert.ok(e.name && e.blurb && e.tactics, `${e.name} に名・来歴・心得`);
    assert.ok(!/[\n\r]/.test(e.blurb + e.tactics), '文字列に生改行がない');
  }
});

test('増補世界史：題と本文がそろい、既存と重複しない', () => {
  const seen = new Set();
  for (const w of EXTRA_WORLD) {
    assert.ok(w.title && w.text);
    assert.ok(!seen.has(w.title), `重複しない題 ${w.title}`);
    seen.add(w.title);
  }
  assert.ok(!seen.has('王国アルゲン'), '既存の題と被らない');
});

test('増補は本編の図鑑・世界史に合流している', () => {
  for (const e of EXTRA_BESTIARY) assert.ok(BESTIARY.includes(e), `${e.name} が図鑑に`);
  for (const w of EXTRA_WORLD) assert.ok(WORLD.includes(w), `${w.title} が世界史に`);
});

test('増補の得物ノートは文字列がそろっている（蔵には収める）', () => {
  for (const [k, v] of Object.entries(EXTRA_WEAPON_NOTES)) {
    assert.ok(typeof v === 'string' && v.length > 0, `ノート ${k}`);
  }
  assert.ok(WTYPE.fist && WTYPE.dagger, '拳・短剣は本物の wtype');
});

test('bestiaryOf は既存職の最初の一葉を返す（増補で壊れない）', () => {
  const s = bestiaryOf('soldier');
  assert.ok(s && s.classId === 'soldier');
  assert.equal(s.name, '兵士', '既存の先頭エントリが保たれる');
});
