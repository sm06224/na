import test from 'node:test';
import assert from 'node:assert/strict';
import { classDef } from '../js/core/classes.js';
import { item } from '../js/core/items.js';
import { floorSpec, floorTitle, makeTowerFloor } from '../js/core/tower.js';

test('塔：層仕様は登るほど格が上がり、五層ごとに塔守が立つ', () => {
  let prevLevel = 0;
  for (let f = 1; f <= 30; f++) {
    const s = floorSpec(f);
    assert.equal(s.floor, f);
    assert.ok(s.level >= prevLevel, `${f}層は格が下がらない`);
    prevLevel = s.level;
    assert.ok(['small', 'medium', 'large'].includes(s.size));
    assert.ok(['green', 'ruins', 'snow', 'desert', 'volcano'].includes(s.biome));
    if (f % 5 === 0) {
      assert.equal(s.isBoss, true, `${f}層は塔守の層`);
      assert.ok(s.boss && classDef(s.boss.classId), `${f}層の塔守の職`);
      assert.ok(s.boss.level >= s.level, '塔守は格上');
      for (const it of (s.boss.items || [])) assert.ok(item(it), `塔守の得物 ${it} は実在`);
    } else {
      assert.equal(s.isBoss, false);
    }
  }
});

test('塔：格・広さに上限があり、暴走しない', () => {
  const top = floorSpec(200);
  assert.ok(top.level <= 60, '格は60止まり');
  assert.equal(top.size, 'large');
});

test('塔：称は層と塔守の有無を表す', () => {
  assert.match(floorTitle(3), /試練の塔 3層/);
  assert.match(floorTitle(5), /塔守/);
});

test('塔：一層を布くと主従の手勢と敵が揃う', () => {
  const { battle, board, squad, spec } = makeTowerFloor(20260616, 1);
  assert.ok(squad.length >= 5);
  assert.equal(board.unitsOf('player').length, squad.length);
  assert.ok(board.unitsOf('player').some(u => u.isLord), '主君がいる');
  assert.ok(board.unitsOf('enemy').length >= 2, '敵がいる');
  assert.ok(battle.objective.type === 'rout', '一層は掃討');
});

test('塔：塔守の層は撃破が目標で、ボスが盤上にいる', () => {
  const { battle, board } = makeTowerFloor(7, 5);
  assert.equal(battle.objective.type, 'defeat_boss');
  assert.ok(board.units.some(u => u.uid === battle.objective.uid && u.boss), '塔守が目標');
});

test('塔：同じ種・同じ層なら同じ戦場（決定的）', () => {
  const terr = bd => { let s = ''; bd.terrain.forEach((x, y, v) => s += v[0]); return s; };
  const a = makeTowerFloor(42, 3), b = makeTowerFloor(42, 3);
  assert.equal(terr(a.board), terr(b.board));
  const foes = bd => bd.unitsOf('enemy').map(u => `${u.classId}@${u.pos.x},${u.pos.y}`).join('|');
  assert.equal(foes(a.board), foes(b.board));
});

test('塔：各層が必ず決着する（フェイズ制・行動順とも）', () => {
  for (const f of [1, 2, 3, 5, 8, 10, 12, 15, 20]) {
    const a = makeTowerFloor(20260616, f);
    assert.equal(a.battle.autoResolve(240).over, true, `${f}層が決着`);
    const b = makeTowerFloor(777, f, { initiative: true });
    assert.equal(b.battle.autoResolveInitiative(420).over, true, `${f}層（行動順）が決着`);
  }
});
