import test from 'node:test';
import assert from 'node:assert/strict';
import { Grid, key } from '../js/core/grid.js';
import { reachable, findPath } from '../js/core/pathfind.js';
import { RNG } from '../js/core/rng.js';
import { Board } from '../js/core/board.js';
import { createUnit } from '../js/core/unit.js';
import { Game, CHAPTERS } from '../js/core/game.js';

test('ZOC：敵の隣に踏み込むと足が止まる（その先へは進めない）', () => {
  const g = new Grid(8, 1, 'plain');
  // 敵が x=4 にいる想定 → ZOC は x=3 と x=5
  const zoc = (x) => x === 3 || x === 5;
  const { dist } = reachable(g, { x: 0, y: 0 }, 9, { zoc: (x) => zoc(x) });
  assert.ok(dist.has(key(3, 0)), 'ZOC マスには入れる');
  assert.ok(!dist.has(key(4, 0)), 'ZOC マスの先へは進めない');
  assert.ok(!dist.has(key(6, 0)), '向こう側へは回り込めない（一本道）');
});

test('ZOC：経路もすり抜けられない', () => {
  const g = new Grid(8, 1, 'plain');
  const path = findPath(g, { x: 0, y: 0 }, { x: 7, y: 0 }, { zoc: (x) => x === 3 });
  assert.equal(path, null, '一本道で ZOC があれば通れない');
});

test('盤上の ZOC：敵に隣接するマスが支配される', () => {
  const b = new Board(6, 3);
  const r = new RNG(3);
  const me = createUnit({ classId: 'mercenary', level: 5, items: ['iron_sword'], side: 'player' }, r.derive('a'));
  const foe = createUnit({ classId: 'soldier', level: 5, items: ['iron_lance'], side: 'enemy' }, r.derive('b'));
  b.add(me, 0, 1); b.add(foe, 3, 1); b.rebuildIndex();
  assert.ok(b.zocFor(me, 2, 1), '敵の隣は支配下');
  assert.ok(b.zocFor(me, 3, 0), '敵の上下も支配下');
  assert.ok(!b.zocFor(me, 1, 1), '離れた所は自由');
});

test('ZOC があっても全章は決着する', () => {
  for (let i = 0; i < CHAPTERS.length; i++) {
    const g = new Game(6000 + i);
    assert.ok(g.startChapter(i).battle.autoResolve(90).over, `第${i + 1}章`);
  }
});
