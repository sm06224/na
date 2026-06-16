import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { classDef } from '../js/core/classes.js';
import { GAIDEN, gaidenById, makeGaiden } from '../js/core/gaiden.js';

test('外伝：シナリオは題・物語・実在のボス職を持つ', () => {
  assert.ok(GAIDEN.length >= 4);
  const ids = new Set();
  for (const s of GAIDEN) {
    assert.ok(s.title && s.intro && s.outro, `${s.id} に題と物語`);
    assert.ok(classDef(s.boss.classId), `ボス職 ${s.boss.classId}`);
    assert.ok(['rout', 'defeat_boss', 'seize'].includes(s.objective));
    assert.ok(!ids.has(s.id), 'id は一意'); ids.add(s.id);
  }
});

test('外伝：gaidenById で引ける', () => {
  assert.equal(gaidenById('icecave').title, '外伝・氷窟の魔');
  assert.equal(gaidenById('nope'), null);
});

test('外伝：布陣すると主従の手勢と敵・ボスが揃う', () => {
  const { battle, board, squad } = makeGaiden(GAIDEN[1], 20260615);
  assert.ok(squad.length >= 5);
  assert.ok(board.unitsOf('player').length === squad.length);
  assert.ok(board.unitsOf('enemy').length >= 2, '敵がいる');
  assert.ok(board.unitsOf('player').some(u => u.isLord), '主君がいる');
  assert.ok(board.weather, '空模様が宿る');
});

test('外伝：同じ種・シナリオなら同じ戦場（決定的）', () => {
  const terr = bd => { let s = ''; bd.terrain.forEach((x, y, v) => s += v[0]); return s; };
  const a = makeGaiden(GAIDEN[0], 42), b = makeGaiden(GAIDEN[0], 42);
  assert.equal(terr(a.board), terr(b.board));
  const foes = bd => bd.unitsOf('enemy').map(u => `${u.classId}@${u.pos.x},${u.pos.y}`).join('|');
  assert.equal(foes(a.board), foes(b.board));
});

test('外伝：撃破目標ならボスの uid が目標になる', () => {
  const dboss = GAIDEN.find(s => s.objective === 'defeat_boss');
  const { battle, board } = makeGaiden(dboss, 7);
  assert.equal(battle.objective.type, 'defeat_boss');
  assert.ok(board.units.some(u => u.uid === battle.objective.uid && u.boss), 'ボスが目標');
});

test('外伝：全シナリオが必ず決着する（フェイズ制）', () => {
  for (const s of GAIDEN) {
    const { battle } = makeGaiden(s, 20260615);
    const res = battle.autoResolve(160);
    assert.equal(res.over, true, `${s.title} が決着`);
  }
});

test('外伝：全シナリオが必ず決着する（行動順）', () => {
  for (const s of GAIDEN) {
    const { battle } = makeGaiden(s, 999, { initiative: true });
    const res = battle.autoResolveInitiative(320);
    assert.equal(res.over, true, `${s.title}（行動順）が決着`);
  }
});
