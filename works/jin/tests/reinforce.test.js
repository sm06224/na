import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { classDef } from '../js/core/classes.js';
import { ITEMS } from '../js/core/items.js';
import { Game, CHAPTERS } from '../js/core/game.js';
import { reinforcementSpecs, edgeSpawnTiles } from '../js/core/reinforce.js';
import { Board } from '../js/core/board.js';

test('増援：序盤（1〜2章）には来ない', () => {
  for (let i = 0; i < 2; i++) assert.equal(reinforcementSpecs(20260615, i, CHAPTERS[i]).length, 0);
});

test('増援：中盤以降は波があり、実在の職・得物・正のターン', () => {
  let any = false;
  for (let i = 2; i < CHAPTERS.length; i++) {
    const waves = reinforcementSpecs(20260615, i, CHAPTERS[i]);
    for (const w of waves) {
      any = true;
      assert.ok(w.turn >= 2, '到来は序盤の後');
      for (const sp of w.specs) {
        assert.ok(classDef(sp.classId), `職 ${sp.classId}`);
        for (const it of sp.items) assert.ok(ITEMS[it], `得物 ${it}`);
      }
    }
  }
  assert.ok(any, 'どこかの章には増援がある');
});

test('増援：種と章から決定的', () => {
  const a = reinforcementSpecs(7, 9, CHAPTERS[9]);
  const b = reinforcementSpecs(7, 9, CHAPTERS[9]);
  assert.deepEqual(a, b);
});

test('増援：縁の空きマスだけを返す', () => {
  const b = new Board(6, 5);
  b.terrain.forEach((x, y) => b.setTerrain(x, y, 'plain'));
  b.setTerrain(5, 2, 'wall');           // 右縁に壁
  const tiles = edgeSpawnTiles(b);
  assert.ok(tiles.length > 0);
  assert.ok(!tiles.some(t => t.x === 5 && t.y === 2), '壁は除く');
  for (const t of tiles) assert.ok(t.x === b.w - 1 || t.y === 0, '右列か上行');
});

test('増援：実章で手番が進むと新手が盤に増える', () => {
  // 増援のある章を探す
  let idx = -1;
  for (let i = 2; i < CHAPTERS.length; i++) if (reinforcementSpecs(20260615, i, CHAPTERS[i]).length) { idx = i; break; }
  assert.ok(idx >= 0);
  const g = new Game(20260615);
  const { battle } = g.startChapter(idx);
  const e0 = battle.board.unitsOf('enemy').length;
  // 到来ターンまで進める
  const maxTurn = Math.max(...battle.reinforce.map(w => w.turn));
  battle.turn = maxTurn;
  battle.spawnReinforcements();
  assert.ok(battle.board.unitsOf('enemy').length > e0, '敵が増えた');
  // 二度目は増えない（波は使い切り）
  const e1 = battle.board.unitsOf('enemy').length;
  battle.spawnReinforcements();
  assert.equal(battle.board.unitsOf('enemy').length, e1, '波は一度きり');
});

test('増援込みでも全16章は必ず決着する（無限ループ防止）', () => {
  for (let i = 0; i < CHAPTERS.length; i++) {
    const g = new Game(20260615);
    const { battle } = g.startChapter(i);
    const res = battle.autoResolve(120);
    assert.equal(res.over, true, `第${i + 1}章が決着`);
  }
});

test('増援込みでもイニシアチブで全章決着する', () => {
  for (let i = 2; i < CHAPTERS.length; i += 4) {
    const g = new Game(777, { initiative: true });
    const { battle } = g.startChapter(i);
    const res = battle.autoResolveInitiative(260);
    assert.equal(res.over, true, `第${i + 1}章（行動順）が決着`);
  }
});
