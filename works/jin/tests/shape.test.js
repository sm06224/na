import test from 'node:test';
import assert from 'node:assert/strict';
import { patternTiles, areaTargets } from '../js/core/combat.js';
import { RNG } from '../js/core/rng.js';
import { Board } from '../js/core/board.js';
import { createUnit } from '../js/core/unit.js';
import '../js/core/items_area.js';

test('範囲の形：円・十字・輪・角・斜め', () => {
  const has = (tiles, x, y) => tiles.some(t => t.x === x && t.y === y);
  const cross = patternTiles(0, 0, 'cross', 2);
  assert.ok(has(cross, 0, 2) && has(cross, 2, 0) && !has(cross, 1, 1), '十字は縦横のみ');
  const ring = patternTiles(0, 0, 'ring', 2);
  assert.ok(ring.every(t => Math.abs(t.x) + Math.abs(t.y) === 2), '輪は距離ちょうど2');
  const square = patternTiles(0, 0, 'square', 1);
  assert.equal(square.length, 9, '角（チェビシェフ1）は3×3');
  const x = patternTiles(0, 0, 'x', 2);
  assert.ok(has(x, 1, 1) && has(x, 2, 2) && !has(x, 1, 0), '斜めのみ');
  const disk = patternTiles(0, 0, 'disk', 1);
  assert.equal(disk.length, 5, '円（マンハッタン1）は5マス');
});

test('十字砲火：縦横に並ぶ敵だけを巻き込む', () => {
  const b = new Board(12, 5);
  const r = new RNG(3);
  const caster = createUnit({ classId: 'sage', level: 16, items: ['crossfire'], side: 'player' }, r.derive('c'));
  caster.statsBase.mag = 22;
  b.add(caster, 0, 2);
  const onAxis = createUnit({ classId: 'soldier', level: 6, items: ['iron_lance'], side: 'enemy' }, r.derive('a'));
  const offAxis = createUnit({ classId: 'soldier', level: 6, items: ['iron_lance'], side: 'enemy' }, r.derive('o'));
  b.add(onAxis, 6, 1);            // 中心(6,2)の真上 → 十字に入る
  b.add(offAxis, 7, 1);           // 斜め → 入らない
  b.rebuildIndex();
  const hit = areaTargets(caster, { x: 6, y: 2 }, b);
  const ids = hit.map(u => u.uid);
  assert.ok(ids.includes(onAxis.uid), '軸上は巻き込む');
  assert.ok(!ids.includes(offAxis.uid), '斜めは巻き込まない');
});
