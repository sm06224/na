import test from 'node:test';
import assert from 'node:assert/strict';
import { Rect, line, lineOfClear, clamp, chebyshev, manhattan, connectedRegions, dirName, DIR4, DIR8 } from '../js/core/util.js';

test('clamp / 距離', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(chebyshev(0, 0, 3, 1), 3);
  assert.equal(manhattan(0, 0, 3, 1), 4);
});

test('Rect：中心・包含・交差', () => {
  const r = new Rect(2, 2, 6, 4);
  assert.equal(r.cx, 5); assert.equal(r.cy, 4);
  assert.ok(r.contains(3, 3));
  assert.ok(!r.contains(8, 6));
  assert.ok(r.intersects(new Rect(7, 2, 3, 3), 0));
  assert.ok(!r.intersects(new Rect(20, 20, 2, 2), 0));
});

test('Rect.each：内側だけ巡れる', () => {
  const r = new Rect(0, 0, 4, 4);
  let all = 0, inner = 0;
  r.each(() => all++);
  r.each(() => inner++, true);
  assert.equal(all, 16);
  assert.equal(inner, 4);   // (4-2)x(4-2)
});

test('line：始点と終点を含み、連続している', () => {
  const pts = line(0, 0, 4, 2);
  assert.deepEqual(pts[0], { x: 0, y: 0 });
  assert.deepEqual(pts[pts.length - 1], { x: 4, y: 2 });
  for (let i = 1; i < pts.length; i++) {
    assert.ok(chebyshev(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) === 1);
  }
});

test('lineOfClear：壁があると通らない', () => {
  const passable = (x, y) => !(x === 2 && y === 1);
  assert.ok(lineOfClear(0, 0, 4, 0, () => true));
  assert.ok(!lineOfClear(0, 0, 4, 2, passable));
});

test('connectedRegions：島の数を数える', () => {
  // 2 つの離れた床
  const open = new Set(['1,1', '1,2', '5,5', '5,6']);
  const passable = (x, y) => open.has(`${x},${y}`);
  const regions = connectedRegions(8, 8, passable, false);
  assert.equal(regions.length, 2);
});

test('dirName / 方向ベクトル', () => {
  assert.equal(dirName(1, 0), '東');
  assert.equal(dirName(0, -1), '北');
  assert.equal(DIR4.length, 4);
  assert.equal(DIR8.length, 8);
});
