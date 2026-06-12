import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RNG } from '../js/rng.js';
import { SpatialHash } from '../js/spatialhash.js';
import { wrapDelta, wrapPos, torusDist2 } from '../js/util.js';
import { BRAIN, GENE_RANGES, randomGenome, mutate, geneticDistance } from '../js/genome.js';
import { Brain } from '../js/brain.js';

/* ---------- 乱数：同じ種は同じ宇宙を生む ---------- */
test('RNG は決定的で、種が違えば列も違う', () => {
  const a = new RNG(42), b = new RNG(42), c = new RNG(43);
  const seqA = Array.from({ length: 50 }, () => a.next());
  const seqB = Array.from({ length: 50 }, () => b.next());
  const seqC = Array.from({ length: 50 }, () => c.next());
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
  for (const v of seqA) assert.ok(v >= 0 && v < 1);
});

test('RNG.gauss は有限で偏らない', () => {
  const r = new RNG(7);
  let sum = 0;
  for (let i = 0; i < 5000; i++) {
    const v = r.gauss();
    assert.ok(Number.isFinite(v));
    sum += v;
  }
  assert.ok(Math.abs(sum / 5000) < 0.1, '平均が 0 に近い');
});

/* ---------- トーラス幾何 ---------- */
test('wrapDelta は世界の継ぎ目をまたいで最短を返す', () => {
  assert.equal(wrapDelta(10, 3990, 4000), -20);
  assert.equal(wrapDelta(3990, 10, 4000), 20);
  assert.equal(wrapDelta(100, 200, 4000), 100);
});

test('wrapPos は常に [0, size) に収める', () => {
  assert.equal(wrapPos(-5, 100), 95);
  assert.equal(wrapPos(105, 100), 5);
  assert.equal(wrapPos(0, 100), 0);
});

/* ---------- 空間ハッシュ ---------- */
test('SpatialHash は半径内の点を漏らさない（継ぎ目越しも）', () => {
  const h = new SpatialHash(4000, 100);
  const pts = [
    { x: 50, y: 50 },     // 中心近く
    { x: 3995, y: 50 },   // 継ぎ目の向こう（x で近い）
    { x: 50, y: 3990 },   // 継ぎ目の向こう（y で近い）
    { x: 2000, y: 2000 }, // 遠い
  ];
  for (const p of pts) h.insert(p);
  const out = [];
  h.query(10, 10, 120, out);
  const found = out.filter(p => torusDist2(10, 10, p.x, p.y, 4000) < 120 * 120);
  assert.equal(found.length, 3, '近い 3 点が見つかる');
  assert.ok(!found.includes(pts[3]));
});

/* ---------- 遺伝子 ---------- */
test('randomGenome は定義域に収まり、脳の重み数が正しい', () => {
  const r = new RNG(1);
  for (let i = 0; i < 20; i++) {
    const g = randomGenome(r);
    for (const [k, [lo, hi]] of Object.entries(GENE_RANGES)) {
      assert.ok(g[k] >= lo && g[k] <= hi, `${k} が定義域内`);
    }
    assert.equal(g.weights.length, BRAIN.WEIGHTS);
  }
});

test('mutate しても定義域から出ない（千回の写し間違い）', () => {
  const r = new RNG(2);
  let g = randomGenome(r);
  for (let i = 0; i < 1000; i++) {
    g = mutate(g, r);
    for (const [k, [lo, hi]] of Object.entries(GENE_RANGES)) {
      assert.ok(g[k] >= lo - 1e-9 && g[k] <= hi + 1e-9, `${k} (${g[k]}) が定義域内`);
    }
    assert.ok(g.weights.every(Number.isFinite));
  }
});

test('geneticDistance: 自分との距離は 0、変異を重ねるほど遠ざかる', () => {
  const r = new RNG(3);
  const a = randomGenome(r);
  assert.equal(geneticDistance(a, a), 0);
  let g = a, after1 = null;
  for (let i = 0; i < 200; i++) {
    g = mutate(g, r);
    if (i === 0) after1 = geneticDistance(a, g);
  }
  const after200 = geneticDistance(a, g);
  assert.ok(after200 > after1, '200 世代後のほうが 1 世代後より遠い');
});

/* ---------- 脳 ---------- */
test('Brain.forward の出力は [-1,1] で有限、活性が記録される', () => {
  const r = new RNG(4);
  const g = randomGenome(r);
  const b = new Brain(g.weights);
  const inputs = Array.from({ length: BRAIN.INPUTS }, () => r.float(-1, 1));
  const out = b.forward(inputs);
  assert.equal(out.length, BRAIN.OUTPUTS);
  for (const v of out) {
    assert.ok(Number.isFinite(v) && v >= -1 && v <= 1);
  }
  assert.deepEqual(b.lastIn, inputs);
  assert.ok(b.lastHidden.some(v => v !== 0));
});
