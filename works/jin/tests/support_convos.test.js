import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORTS } from '../js/core/script.js';
import { EXTRA_SUPPORTS } from '../js/core/script2.js';
import { EXTRA_SUPPORTS2 } from '../js/core/script3.js';

const PARTY = new Set(['リン', 'ガレス', 'セラ', 'ロウェン', 'ミラ', 'カイ', 'フィオ', 'ドラン', 'オレン', 'リーザ', 'グンナル', 'ノエル']);
const norm = p => [p.a, p.b].sort().join('|');

test('支援会話増補：12 組、欄がそろう', () => {
  assert.equal(EXTRA_SUPPORTS2.length, 12);
  for (const s of EXTRA_SUPPORTS2) {
    assert.ok(s.a && s.b && Array.isArray(s.lines) && s.lines.length >= 4, `${s.a}＆${s.b} に十分な台詞`);
    for (const l of s.lines) {
      assert.ok(l.who === s.a || l.who === s.b, `話者は当事者のどちらか（${s.a}＆${s.b}）`);
      assert.ok(l.line && !/[\n\r]/.test(l.line), '台詞に生改行がない');
    }
  }
});

test('支援会話増補：当事者は実在の仲間', () => {
  for (const s of EXTRA_SUPPORTS2) {
    assert.ok(PARTY.has(s.a), `${s.a} は仲間`);
    assert.ok(PARTY.has(s.b), `${s.b} は仲間`);
  }
});

test('支援会話増補：既存の組と重複しない', () => {
  const existing = new Set([...SUPPORTS, ...EXTRA_SUPPORTS].map(norm));
  const seen = new Set();
  for (const s of EXTRA_SUPPORTS2) {
    const k = norm(s);
    assert.ok(!existing.has(k), `既存と被らない（${s.a}＆${s.b}）`);
    assert.ok(!seen.has(k), `増補内でも被らない（${s.a}＆${s.b}）`);
    seen.add(k);
  }
});

test('支援会話：総数が 12 ぶん増えている', () => {
  const all = [...SUPPORTS, ...EXTRA_SUPPORTS, ...EXTRA_SUPPORTS2];
  assert.equal(all.length, SUPPORTS.length + EXTRA_SUPPORTS.length + 12);
  // 増補の 12 組は、それぞれ互いに重複しない（増分のユニーク性）
  const newKeys = new Set(EXTRA_SUPPORTS2.map(norm));
  assert.equal(newKeys.size, 12, '増補の組はすべてユニーク');
});
