import test from 'node:test';
import assert from 'node:assert/strict';
import { Level } from '../js/core/level.js';
import { T } from '../js/core/tile.js';
import { computeFOV, hasLine } from '../js/core/fov.js';
import { aStar, dijkstraMap, reachable, farthestCell } from '../js/core/pathfind.js';

/* 開けた部屋の盤を作る（縁は壁） */
function openRoom(w, h) {
  const lv = new Level(w, h, 1);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) lv.set(x, y, T.FLOOR);
  return lv;
}

test('FOV：原点は見え、半径内のみ、開けた部屋では四方が見える', () => {
  const lv = openRoom(21, 21);
  const vis = new Set();
  computeFOV(10, 10, 6, (x, y) => !lv.clearTile(x, y), (x, y, d) => vis.add(`${x},${y}`));
  assert.ok(vis.has('10,10'));
  assert.ok(vis.has('14,10'));    // 半径内
  assert.ok(!vis.has('10,18'));   // 半径 6 の外
});

test('FOV：壁の陰は見えない', () => {
  const lv = openRoom(21, 21);
  // 縦の壁を一本立てる
  for (let y = 1; y < 20; y++) lv.set(13, y, T.WALL);
  const vis = new Set();
  computeFOV(10, 10, 9, (x, y) => !lv.clearTile(x, y), (x, y) => vis.add(`${x},${y}`));
  assert.ok(vis.has('12,10'));    // 壁の手前は見える
  assert.ok(!vis.has('16,10'));   // 壁の向こうは陰
});

test('FOV：壁そのものは（面していれば）見える', () => {
  const lv = openRoom(15, 15);
  lv.set(10, 7, T.WALL);
  const vis = new Set();
  computeFOV(7, 7, 6, (x, y) => !lv.clearTile(x, y), (x, y) => vis.add(`${x},${y}`));
  assert.ok(vis.has('10,7'));
});

test('hasLine：遮りがなければ通る、あれば通らない', () => {
  const lv = openRoom(15, 15);
  assert.ok(hasLine(2, 2, 12, 2, (x, y) => !lv.clearTile(x, y)));
  lv.set(7, 2, T.WALL);
  assert.ok(!hasLine(2, 2, 12, 2, (x, y) => !lv.clearTile(x, y)));
});

test('A*：開けた部屋で道を見つけ、両端が一致', () => {
  const lv = openRoom(20, 12);
  const path = aStar(lv, 2, 2, 17, 9, (x, y) => lv.walkable(x, y));
  assert.ok(path);
  assert.deepEqual(path[0], { x: 2, y: 2 });
  assert.deepEqual(path[path.length - 1], { x: 17, y: 9 });
});

test('A*：囲まれた目標へは道がない', () => {
  const lv = openRoom(20, 12);
  // 目標 (10,6) を壁で囲う
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) lv.set(10 + dx, 6 + dy, T.WALL);
  const path = aStar(lv, 2, 2, 10, 6, (x, y) => lv.walkable(x, y));
  assert.equal(path, null);
});

test('A*：壁の角を斜めに抜けない', () => {
  const lv = openRoom(8, 8);
  // (3,3),(4,4) を床に、(4,3)(3,4) を壁にして角抜けを禁ずる経路を確認
  lv.set(4, 3, T.WALL); lv.set(3, 4, T.WALL);
  const path = aStar(lv, 3, 3, 4, 4, (x, y) => lv.walkable(x, y));
  // 角抜けできないので、遠回り（長さ > 2）になる
  assert.ok(path && path.length > 2);
});

test('dijkstraMap：目標で 0、遠いほど大きい', () => {
  const lv = openRoom(20, 12);
  const dm = dijkstraMap(lv, [{ x: 2, y: 2 }], (x, y) => lv.walkable(x, y));
  assert.equal(dm[2 * lv.w + 2], 0);
  assert.ok(dm[9 * lv.w + 17] > dm[3 * lv.w + 3]);
});

test('reachable / farthestCell', () => {
  const lv = openRoom(20, 12);
  const reach = reachable(lv, 2, 2, (x, y) => lv.walkable(x, y));
  assert.ok(reach.length === (20 - 2) * (12 - 2));   // 内側ぜんぶ
  const dm = dijkstraMap(lv, [{ x: 2, y: 2 }], (x, y) => lv.walkable(x, y));
  const far = farthestCell(dm, lv);
  assert.ok(far && (far.x === 18 || far.y === 10));   // 対角あたりが最遠
});
