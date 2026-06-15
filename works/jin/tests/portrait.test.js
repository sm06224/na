import test from 'node:test';
import assert from 'node:assert/strict';
import { faceFeatures } from '../js/ui/portrait.js';

test('顔：同じ名前からは同じ顔（決定的）', () => {
  const a = faceFeatures('リン'), b = faceFeatures('リン');
  assert.deepEqual(a, b);
});

test('顔：名前がちがえば、だいたいちがう顔', () => {
  const names = ['リン', 'ガレス', 'セラ', 'ロウェン', 'ミラ', 'カイ', 'フィオ', 'ドラン', 'オレン', 'ノエル'];
  const keys = names.map(n => JSON.stringify(faceFeatures(n)));
  assert.ok(new Set(keys).size >= names.length - 1, 'ほぼ全員ちがう顔立ち');
  for (const n of names) {
    const f = faceFeatures(n);
    assert.ok(f.skin && f.hair && f.eye, '色がそろう');
    assert.ok(f.hairStyle >= 0 && f.hairStyle <= 4, '髪型は0..4');
  }
});
