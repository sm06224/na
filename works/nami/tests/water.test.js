import test from 'node:test';
import assert from 'node:assert/strict';
import { Water } from '../js/core/water.js';

test('はじめは凪いでいる — どこも揺れていない', () => {
  const w = new Water(40, 30);
  assert.equal(w.maxAmplitude(), 0);
  assert.equal(w.energy(), 0);
});

test('落とせば波が立ち、進めても有限のまま（NaN も発散もしない）', () => {
  const w = new Water(80, 60);
  w.drop(40, 30, 6, 1);
  assert.ok(w.maxAmplitude() > 0, '落とせば揺れる');
  for (let i = 0; i < 400; i++) w.step();
  for (const v of w.cur) assert.ok(Number.isFinite(v), '値はすべて有限');
  assert.ok(w.maxAmplitude() < 5, '反射壁でも波は発散しない');
});

test('中央に落とした波紋は、上下左右に対称にひろがる（正方格子）', () => {
  const N = 41;                       // 奇数 → ちょうど中央のセルがある
  const w = new Water(N, N);
  const c = (N - 1) / 2;
  w.drop(c, c, 5, 1);
  for (let i = 0; i < 60; i++) w.step();
  const at = (x, y) => w.cur[y * N + x];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = at(x, y);
      assert.ok(Math.abs(v - at(N - 1 - x, y)) < 1e-4, '左右対称');
      assert.ok(Math.abs(v - at(x, N - 1 - y)) < 1e-4, '上下対称');
      assert.ok(Math.abs(v - at(y, x)) < 1e-4, '対角（90°回転）対称');
    }
  }
});

test('やがて凪ぐ — 触れずに待てば、揺れは減衰して小さくなる', () => {
  const w = new Water(60, 60);
  w.drop(30, 30, 6, 1);
  for (let i = 0; i < 30; i++) w.step();
  const early = w.energy();
  for (let i = 0; i < 4000; i++) w.step();
  const late = w.energy();
  assert.ok(late < early * 0.05, `減衰して静まる（${early.toExponential(2)} → ${late.toExponential(2)}）`);
});

test('決定性：同じ落とし方をすれば、一さざ波もちがわない同じ水面', () => {
  const make = () => {
    const w = new Water(50, 40);
    w.drop(12, 10, 5, 1); w.drop(38, 28, 7, 0.6);
    for (let i = 0; i < 120; i++) w.step();
    return w;
  };
  const a = make(), b = make();
  assert.deepEqual(Array.from(a.cur), Array.from(b.cur));
});

test('重ね合わせ：二つの波紋は足し合わさる（線形性）', () => {
  const steps = 50;
  const only1 = new Water(60, 60); only1.drop(20, 30, 4, 1);
  const only2 = new Water(60, 60); only2.drop(40, 30, 4, 1);
  const both = new Water(60, 60); both.drop(20, 30, 4, 1); both.drop(40, 30, 4, 1);
  for (let i = 0; i < steps; i++) { only1.step(); only2.step(); both.step(); }
  let maxErr = 0;
  for (let i = 0; i < both.cur.length; i++) {
    maxErr = Math.max(maxErr, Math.abs(both.cur[i] - (only1.cur[i] + only2.cur[i])));
  }
  assert.ok(maxErr < 1e-4, `二つの和とほぼ一致（誤差 ${maxErr.toExponential(2)}）`);
});

test('傾き：平らな水面の傾きは 0、波があれば 0 でない所がある', () => {
  const w = new Water(40, 40);
  assert.deepEqual(w.slopeAt(20, 20), { dx: 0, dy: 0 });
  w.drop(20, 20, 5, 1); w.step();
  let any = false;
  for (let y = 1; y < 39 && !any; y++) for (let x = 1; x < 39; x++) {
    const s = w.slopeAt(x, y); if (s.dx !== 0 || s.dy !== 0) { any = true; break; }
  }
  assert.ok(any, '波があれば傾く所がある');
});

test('大波（長押し）でも壊れない — 大きく落としても発散せず、やがて凪ぐ', () => {
  const w = new Water(240, 150);
  w.drop(120, 75, 16, 2.5);                 // 長押しの大波（大きい振幅・広い半径）
  for (let i = 0; i < 900; i++) w.step();
  for (const v of w.cur) assert.ok(Number.isFinite(v), '大波でも値は有限');
  assert.ok(w.maxAmplitude() < 1, '大波でも反射壁で発散せず、減衰していく');
});

test('reset で凪に戻る', () => {
  const w = new Water(30, 30);
  w.drop(15, 15, 5, 1); for (let i = 0; i < 10; i++) w.step();
  assert.ok(w.maxAmplitude() > 0);
  w.reset();
  assert.equal(w.maxAmplitude(), 0);
  assert.equal(w.energy(), 0);
});
