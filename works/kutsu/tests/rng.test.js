import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG, hashSeed } from '../js/core/rng.js';

test('決定性：同じ種からは同じ列', () => {
  const a = new RNG(12345), b = new RNG(12345);
  for (let i = 0; i < 1000; i++) assert.equal(a.next(), b.next());
});

test('種がちがえば列もちがう', () => {
  const a = new RNG(1), b = new RNG(2);
  let same = 0;
  for (let i = 0; i < 100; i++) if (a.next() === b.next()) same++;
  assert.ok(same < 5);
});

test('save / restore で続きが一致', () => {
  const r = new RNG(99);
  for (let i = 0; i < 50; i++) r.next();
  const snap = r.save();
  const seq = [];
  for (let i = 0; i < 20; i++) seq.push(r.next());
  r.restore(snap);
  for (let i = 0; i < 20; i++) assert.equal(r.next(), seq[i]);
});

test('int / range は範囲内', () => {
  const r = new RNG(7);
  for (let i = 0; i < 2000; i++) {
    const n = r.int(6); assert.ok(n >= 0 && n < 6);
    const m = r.range(3, 9); assert.ok(m >= 3 && m <= 9);
  }
});

test('dice：2d6 は 2〜12、平均は 7 あたり', () => {
  const r = new RNG(42);
  let sum = 0, lo = 99, hi = -1;
  for (let i = 0; i < 5000; i++) { const v = r.dice('2d6'); sum += v; lo = Math.min(lo, v); hi = Math.max(hi, v); }
  assert.ok(lo >= 2 && hi <= 12);
  const avg = sum / 5000;
  assert.ok(avg > 6.5 && avg < 7.5, `平均 ${avg}`);
});

test('dice：修正つき・定数', () => {
  const r = new RNG(3);
  assert.equal(r.dice(5), 5);
  for (let i = 0; i < 100; i++) { const v = r.dice('1d4+2'); assert.ok(v >= 3 && v <= 6); }
});

test('weighted：重い項目ほどよく出る', () => {
  const r = new RNG(8);
  const items = [{ k: 'a', weight: 1 }, { k: 'b', weight: 9 }];
  let b = 0;
  for (let i = 0; i < 4000; i++) if (r.weighted(items).k === 'b') b++;
  assert.ok(b > 3400 && b < 3800, `b=${b}`);
});

test('weightedKey：表から引く', () => {
  const r = new RNG(11);
  const counts = { x: 0, y: 0 };
  for (let i = 0; i < 3000; i++) counts[r.weightedKey({ x: 1, y: 3 })]++;
  assert.ok(counts.y > counts.x);
});

test('shuffle は要素を保つ', () => {
  const r = new RNG(5);
  const arr = [1, 2, 3, 4, 5, 6, 7, 8];
  const copy = r.shuffle(arr.slice());
  assert.deepEqual(copy.slice().sort((a, b) => a - b), arr);
});

test('hashSeed は決定的', () => {
  assert.equal(hashSeed('窟'), hashSeed('窟'));
  assert.notEqual(hashSeed('a'), hashSeed('b'));
});

test('fork は独立した流れ', () => {
  const r = new RNG(123);
  const f1 = r.fork(1), f2 = r.fork(2);
  let same = 0;
  for (let i = 0; i < 100; i++) if (f1.next() === f2.next()) same++;
  assert.ok(same < 5);
});
