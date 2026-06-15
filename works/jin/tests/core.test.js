import test from 'node:test';
import assert from 'node:assert/strict';

import { RNG } from '../js/core/rng.js';
import { Grid, manhattan, tilesInRange, line } from '../js/core/grid.js';
import { reachable, findPath } from '../js/core/pathfind.js';
import { Board } from '../js/core/board.js';
import { createUnit, effectiveStats, equippedWeapon, isAlive, gainExp, promote } from '../js/core/unit.js';
import { forecast, resolveCombat } from '../js/core/combat.js';
import { triangle } from '../js/core/items.js';
import { CLASS_LIST, classDef } from '../js/core/classes.js';
import { ITEM_LIST, item } from '../js/core/items.js';
import { generateMap } from '../js/core/mapgen.js';
import { Game, CHAPTERS } from '../js/core/game.js';
import { Battle } from '../js/core/battle.js';

/* ---------- RNG ---------- */
test('RNG: 決定的・派生も決定的', () => {
  const a = new RNG(12345), b = new RNG(12345);
  const seqA = Array.from({ length: 20 }, () => a.int(1000));
  const seqB = Array.from({ length: 20 }, () => b.int(1000));
  assert.deepEqual(seqA, seqB);
  assert.equal(new RNG(7).derive('x').seed, new RNG(7).derive('x').seed);
  assert.notEqual(new RNG(7).derive('x').seed, new RNG(7).derive('y').seed);
});

/* ---------- グリッド・経路 ---------- */
test('射程の輪：min..max の正しいマス数', () => {
  const t = tilesInRange(5, 5, 2, 2);          // ちょうど距離2の輪 = 8マス
  assert.equal(t.length, 8);
  for (const p of t) assert.equal(manhattan({ x: 5, y: 5 }, p), 2);
});
test('A*：最短路は連続して隣り合い、始点と終点を結ぶ', () => {
  const g = new Grid(10, 10, 'plain');
  const path = findPath(g, { x: 0, y: 0 }, { x: 9, y: 5 }, {});
  assert.ok(path);
  assert.deepEqual(path[0], { x: 0, y: 0 });
  assert.deepEqual(path[path.length - 1], { x: 9, y: 5 });
  for (let i = 1; i < path.length; i++) assert.equal(manhattan(path[i - 1], path[i]), 1);
});
test('到達可能：移動力ぶんだけ、コストが収まる', () => {
  const g = new Grid(12, 12, 'plain');
  const { dist } = reachable(g, { x: 6, y: 6 }, 4, {});
  for (const [, c] of dist) assert.ok(c <= 4);
  assert.ok(dist.size > 1);
});
test('壁は通れない：findPath は迂回する', () => {
  const g = new Grid(7, 7, 'plain');
  const cost = (x, y) => (x === 3 && y !== 0 ? Infinity : 1);   // 縦の壁、上に隙間
  const path = findPath(g, { x: 0, y: 3 }, { x: 6, y: 3 }, { costAt: cost });
  assert.ok(path);
  assert.ok(path.some(p => p.y === 0), '隙間（上端）を通って迂回する');
});

/* ---------- 内容（DB）の健全性 ---------- */
test('全クラスの成長率・素質が妥当', () => {
  for (const c of CLASS_LIST) {
    assert.ok(c.bases && c.growths, `${c.id} に bases/growths`);
    assert.ok(c.mov >= 3 && c.mov <= 10, `${c.id} の移動力`);
    for (const k in c.growths) assert.ok(c.growths[k] >= 0 && c.growths[k] <= 100, `${c.id}.${k} 成長率`);
    if (c.promotesTo) for (const p of c.promotesTo) assert.ok(classDef(p), `${c.id} の転職先 ${p} が存在`);
  }
});
test('全武器の射程・参照が妥当', () => {
  for (const it of ITEM_LIST) {
    if (it.kind !== 'weapon') continue;
    assert.ok(it.min >= 1 && it.max >= it.min, `${it.id} の射程`);
    assert.ok(it.price > 0, `${it.id} の価値`);
  }
});
test('三すくみ：剣>斧>槍>剣 と、その逆', () => {
  assert.deepEqual(triangle('sword', 'axe'), { atk: 1, hit: 15 });
  assert.deepEqual(triangle('axe', 'sword'), { atk: -1, hit: -15 });
  assert.deepEqual(triangle('sword', 'sword'), { atk: 0, hit: 0 });
  assert.deepEqual(triangle('anima', 'light'), { atk: 1, hit: 15 });
});

/* ---------- ユニット・成長・転職 ---------- */
test('ユニット生成：決定的、装備、レベルで育つ', () => {
  const r = new RNG(99);
  const a = createUnit({ id: 'u', name: 'A', classId: 'mercenary', level: 10, items: ['iron_sword'] }, r.derive('a'));
  const b = createUnit({ id: 'u', name: 'A', classId: 'mercenary', level: 10, items: ['iron_sword'] }, new RNG(99).derive('a'));
  assert.deepEqual(a.statsBase, b.statsBase);
  assert.equal(equippedWeapon(a).id, 'iron_sword');
  assert.ok(a.maxHp >= classDef('mercenary').bases.hp);
});
test('経験と転職：レベルが上がり、上級職で能力が伸びる', () => {
  const r = new RNG(5);
  const u = createUnit({ id: 'h', classId: 'mercenary', level: 10, items: ['iron_sword'] }, r);
  const before = { ...u.statsBase };
  gainExp(u, 100, r);
  assert.ok(u.level >= 10);
  const lv = u.level;
  // 上級転職
  const ok = promote(u, 'hero');
  assert.ok(ok);
  assert.equal(u.classId, 'hero');
  assert.equal(u.level, 1);
  assert.ok(u.statsBase.hp >= before.hp);
});

/* ---------- 戦闘 ---------- */
function duel(seed, aSpec, bSpec) {
  const board = new Board(3, 1);
  const r = new RNG(seed);
  const a = createUnit({ ...aSpec, side: 'player' }, r.derive('a'));
  const b = createUnit({ ...bSpec, side: 'enemy' }, r.derive('b'));
  board.add(a, 0, 0); board.add(b, 1, 0);
  return { board, a, b, r };
}
test('予報：命中・会心は 0..100、ダメージは非負', () => {
  const { a, b, board } = duel(1, { classId: 'mercenary', level: 5, items: ['iron_sword'] }, { classId: 'knight', level: 5, items: ['iron_lance'] });
  const fc = forecast(a, b, board);
  assert.ok(fc.hit >= 0 && fc.hit <= 100);
  assert.ok(fc.crit >= 0 && fc.crit <= 100);
  assert.ok(fc.dmg >= 0);
  assert.ok(fc.counter, '隣接の槍なら反撃あり');
});
test('戦闘：決定的（同じ種・同じ盤面なら同じ結果）', () => {
  const d1 = duel(42, { classId: 'fighter', level: 6, items: ['steel_axe'] }, { classId: 'soldier', level: 5, items: ['iron_lance'] });
  const d2 = duel(42, { classId: 'fighter', level: 6, items: ['steel_axe'] }, { classId: 'soldier', level: 5, items: ['iron_lance'] });
  const r1 = resolveCombat(d1.a, d1.b, d1.board, new RNG(7));
  const r2 = resolveCombat(d2.a, d2.b, d2.board, new RNG(7));
  assert.equal(d1.b.hp, d2.b.hp);
  assert.deepEqual(r1.events.map(e => [e.type, e.dmg]), r2.events.map(e => [e.type, e.dmg]));
});
test('特効：弓は飛行に大ダメージ', () => {
  const { a, b, board } = duel(3, { classId: 'archer', level: 8, items: ['iron_bow'] }, { classId: 'pegasus', level: 6, items: ['iron_lance'] });
  // 弓は射程2。隣に置き直して射程内に（射手は2マス）
  board.moveUnit(a, 0, 0); board.moveUnit(b, 2, 0);
  const fcEff = forecast(a, b, board);
  const { a: a2, b: c2, board: bd2 } = duel(3, { classId: 'archer', level: 8, items: ['iron_bow'] }, { classId: 'mercenary', level: 6, items: ['iron_sword'] });
  bd2.moveUnit(a2, 0, 0); bd2.moveUnit(c2, 2, 0);
  const fcNorm = forecast(a2, c2, bd2);
  assert.ok(fcEff.eff, '飛行に特効が乗る');
  assert.ok(fcEff.dmg > fcNorm.dmg, '特効ダメージは通常より大きい');
});

/* ---------- 戦場生成 ---------- */
test('戦場生成：決定的、布陣・湧き・目標がそろう', () => {
  const g1 = generateMap(new RNG(2026), { w: 16, h: 12, biome: 'green', enemyCount: 6 });
  const g2 = generateMap(new RNG(2026), { w: 16, h: 12, biome: 'green', enemyCount: 6 });
  assert.deepEqual(g1.board.terrain.cells, g2.board.terrain.cells);
  assert.ok(g1.deploy.length >= 1, '布陣マスがある');
  assert.ok(g1.spawns.length >= 1, '敵の湧きがある');
  assert.ok(g1.objective && g1.objective.type, '目標がある');
});

/* ---------- キャンペーン統合 ---------- */
test('Game：種から軍と章ができ、戦える', () => {
  const g = new Game(20260615);
  assert.equal(g.party.length, 8);
  assert.ok(g.party[0].isLord);
  const { battle } = g.startChapter(0);
  assert.ok(battle instanceof Battle);
  assert.ok(battle.board.unitsOf('player').length >= 1);
  assert.ok(battle.board.unitsOf('enemy').length >= 1);
});
test('Game：同じ種からは、同じ第一章の盤面', () => {
  const a = new Game(777).startChapter(0).battle.board;
  const b = new Game(777).startChapter(0).battle.board;
  assert.deepEqual(a.terrain.cells, b.terrain.cells);
  assert.deepEqual(
    a.unitsOf('enemy').map(u => [u.classId, u.pos.x, u.pos.y, u.maxHp]),
    b.unitsOf('enemy').map(u => [u.classId, u.pos.x, u.pos.y, u.maxHp]),
  );
});
test('全章：自動decisionで戦って必ず決着する（無限ループしない）', () => {
  for (let i = 0; i < CHAPTERS.length; i++) {
    const g = new Game(1000 + i);
    const { battle } = g.startChapter(i);
    const res = battle.autoResolve(80);
    assert.ok(res.over, `第${i + 1}章が決着する`);
    assert.ok(['rout', 'seize', 'boss', 'escape', 'survive', 'lord', 'wipe', 'timeout'].includes(res.reason));
  }
});
test('自動進行は決定的（同じ種なら同じ勝敗・同じターン）', () => {
  const r1 = (() => { const g = new Game(55); const { battle } = g.startChapter(0); return battle.autoResolve(80); })();
  const r2 = (() => { const g = new Game(55); const { battle } = g.startChapter(0); return battle.autoResolve(80); })();
  assert.deepEqual(r1, r2);
});
