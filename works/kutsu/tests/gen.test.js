import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../js/core/rng.js';
import { Level } from '../js/core/level.js';
import { T, isStairs } from '../js/core/tile.js';
import { genRooms } from '../js/core/gen/rooms.js';
import { genCave } from '../js/core/gen/cave.js';
import { genBSP } from '../js/core/gen/bsp.js';
import { genMaze } from '../js/core/gen/maze.js';
import { buildLevel } from '../js/core/gen/build.js';
import { reachable } from '../js/core/pathfind.js';

const GENS = { rooms: genRooms, cave: genCave, bsp: genBSP, maze: genMaze };

for (const [name, gen] of Object.entries(GENS)) {
  test(`${name}：床ができ、縁は壁、ひとつながりにできる`, () => {
    const lv = new Level(60, 36, 3);
    gen(lv, new RNG(101), {});
    const floor = lv.findTiles((c, x, y) => lv.walkable(x, y));
    assert.ok(floor.length > 80, `${name} の床が少なすぎる: ${floor.length}`);
    lv.keepLargestRegion();
    assert.equal(lv.walkableRegions().length, 1, `${name} が連結していない`);
  });

  test(`${name}：同じ種からは同じ階`, () => {
    const a = new Level(60, 36, 3); gen(a, new RNG(7), {});
    const b = new Level(60, 36, 3); gen(b, new RNG(7), {});
    assert.deepEqual(Array.from(a.tiles), Array.from(b.tiles));
  });
}

test('buildLevel：階段があり、入口から下り階段へ歩いて行ける', () => {
  for (const depth of [1, 3, 6, 10]) {
    const lv = buildLevel(new RNG(depth * 13 + 1), depth);
    assert.ok(lv.stairsDown, `深さ ${depth} に下り階段がない`);
    assert.ok(lv.entrance, `深さ ${depth} に入口がない`);
    // 連結：入口から到達できる床に下り階段が含まれる
    const reach = reachable(lv, lv.entrance.x, lv.entrance.y, (x, y) => lv.walkable(x, y));
    const set = new Set(reach.map(p => `${p.x},${p.y}`));
    assert.ok(set.has(`${lv.stairsDown.x},${lv.stairsDown.y}`), `深さ ${depth}：階段へ行けない`);
  }
});

test('buildLevel：縁はすべて壁', () => {
  const lv = buildLevel(new RNG(555), 4);
  for (let x = 0; x < lv.w; x++) { assert.equal(lv.get(x, 0), T.WALL); assert.equal(lv.get(x, lv.h - 1), T.WALL); }
  for (let y = 0; y < lv.h; y++) { assert.equal(lv.get(0, y), T.WALL); assert.equal(lv.get(lv.w - 1, y), T.WALL); }
});

test('buildLevel：深さ 1 には上り階段がない、深さ 2 以降にはある', () => {
  const d1 = buildLevel(new RNG(1), 1, { theme: 'rooms' });
  assert.equal(d1.findTiles(c => c === T.STAIRS_UP).length, 0);
  const d3 = buildLevel(new RNG(1), 3, { theme: 'rooms' });
  assert.equal(d3.findTiles(c => c === T.STAIRS_UP).length, 1);
});

test('buildLevel：決定的（同じ種・同じ深さ）', () => {
  const a = buildLevel(new RNG(2024), 5);
  const b = buildLevel(new RNG(2024), 5);
  assert.deepEqual(Array.from(a.tiles), Array.from(b.tiles));
  assert.deepEqual(a.stairsDown, b.stairsDown);
});

test('serialize / deserialize で同じ階', () => {
  const a = buildLevel(new RNG(321), 4);
  const b = Level.deserialize(a.serialize());
  assert.deepEqual(Array.from(a.tiles), Array.from(b.tiles));
  assert.deepEqual(a.stairsDown, b.stairsDown);
  assert.equal(a.theme, b.theme);
});
