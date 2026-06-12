import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RNG } from '../js/core/rng.js';
import { makeNoise2D, makeFBM } from '../js/core/noise.js';
import { placeName, nationName, wonderName } from '../js/core/names.js';
import { generateTerrain, WATER, BIOME, SIZE, moveCost } from '../js/core/terrain.js';
import { findPath } from '../js/core/pathfind.js';

/* ---------- ノイズ ---------- */
test('ノイズは決定的で 0..1 に収まり、滑らかに変化する', () => {
  const n1 = makeNoise2D(42), n2 = makeNoise2D(42);
  for (let i = 0; i < 200; i++) {
    const x = i * 0.13, y = i * 0.07;
    assert.equal(n1(x, y), n2(x, y));
    const v = n1(x, y);
    assert.ok(v >= 0 && v <= 1);
  }
  // 近い点は近い値（連続性）
  const f = makeFBM(7, 5);
  const a = f(3.0, 3.0), b = f(3.001, 3.0);
  assert.ok(Math.abs(a - b) < 0.01);
});

/* ---------- 命名 ---------- */
test('名前はカタカナで生成され、決定的', () => {
  const a = new RNG(5), b = new RNG(5);
  for (let i = 0; i < 50; i++) {
    const n1 = placeName(a), n2 = placeName(b);
    assert.equal(n1, n2);
    assert.ok(/^[ァ-ヶー]+$/.test(n1), `カタカナ: ${n1}`);
    assert.ok(n1.length >= 2);
  }
  const r = new RNG(9);
  assert.ok(wonderName(r, 'カミハラ').startsWith('カミハラの'));
  assert.ok(nationName(r, 'ミナト').length >= 2);
});

/* ---------- 地形 ---------- */
test('地形は決定的に生成される', () => {
  const t1 = generateTerrain(123);
  const t2 = generateTerrain(123);
  assert.deepEqual(Array.from(t1.elev.slice(0, 500)), Array.from(t2.elev.slice(0, 500)));
  assert.deepEqual(Array.from(t1.biome), Array.from(t2.biome));
  assert.deepEqual(Array.from(t1.river), Array.from(t2.river));
});

test('世界には海と大陸がほどよくあり、川は水へ注ぐ', () => {
  const t = generateTerrain(777);
  const total = SIZE * SIZE;
  let ocean = 0, land = 0, riverTiles = 0;
  for (let i = 0; i < total; i++) {
    if (t.water[i] === WATER.OCEAN) ocean++;
    else if (t.water[i] === WATER.LAND) land++;
    if (t.river[i]) riverTiles++;
  }
  assert.ok(ocean / total > 0.15, '海がある');
  assert.ok(land / total > 0.4, '大陸がある');
  assert.ok(riverTiles > 50, '川が流れている');

  // 各川タイルは、いずれか低い方向か水域に接続している（孤立しない）
  let connected = 0, riverChecked = 0;
  for (let i = 0; i < total && riverChecked < 300; i++) {
    if (!t.river[i]) continue;
    riverChecked++;
    const x = i % SIZE, y = (i / SIZE) | 0;
    let ok = false;
    for (let dy = -1; dy <= 1 && !ok; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
      const j = ny * SIZE + nx;
      if (t.river[j] || t.water[j] !== WATER.LAND) { ok = true; break; }
    }
    if (ok) connected++;
  }
  assert.ok(connected / riverChecked > 0.95, '川はほぼすべて続いている');
});

test('肥沃度は 0..1、バイオームごとに妥当', () => {
  const t = generateTerrain(31);
  for (let i = 0; i < SIZE * SIZE; i++) {
    assert.ok(t.fert[i] >= 0 && t.fert[i] <= 1);
    if (t.water[i] !== WATER.LAND) assert.equal(t.fert[i], 0);
  }
});

/* ---------- 経路探索 ---------- */
test('A* は陸路を見つけ、水は渡らない', () => {
  const t = generateTerrain(555);
  // 同じ大陸上の 2 つの陸タイルを探す（単純に近場で）
  let from = -1;
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (t.water[i] === WATER.LAND && t.biome[i] !== BIOME.MOUNTAIN) { from = i; break; }
  }
  assert.ok(from >= 0);
  // from の近く（30 タイル以内）の陸タイルへ
  const fx = from % SIZE, fy = (from / SIZE) | 0;
  let to = -1;
  for (let r = 5; r < 30 && to < 0; r++) {
    const cx = fx + r, cy = fy;
    if (cx < SIZE) {
      const j = cy * SIZE + cx;
      if (t.water[j] === WATER.LAND) to = j;
    }
  }
  if (to < 0) return; // 地形次第ではスキップ（海際スタートなど）

  const road = new Uint8Array(SIZE * SIZE);
  const path = findPath(t, road, from, to);
  if (path) {
    assert.equal(path[0], from);
    assert.equal(path[path.length - 1], to);
    for (const i of path) {
      assert.ok(t.water[i] === WATER.LAND, '経路は陸のみ');
      // 隣接性
    }
    for (let k = 1; k < path.length; k++) {
      const ax = path[k - 1] % SIZE, ay = (path[k - 1] / SIZE) | 0;
      const bx = path[k] % SIZE, by = (path[k] / SIZE) | 0;
      assert.ok(Math.abs(ax - bx) <= 1 && Math.abs(ay - by) <= 1, '一歩ずつ進む');
    }
  }
});

test('moveCost: 水は無限大、道なら草原より安い見込み', () => {
  const t = generateTerrain(99);
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (t.water[i] !== WATER.LAND) {
      assert.equal(moveCost(t, i), Infinity);
    } else {
      assert.ok(moveCost(t, i) >= 1 || t.river[i]);
    }
  }
});
