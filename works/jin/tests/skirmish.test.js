import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';                 // 全得物・全職を登録簿へ
import { ITEMS } from '../js/core/items.js';
import { classDef } from '../js/core/classes.js';
import { makeSkirmish, makeSkirmishSquad, SKIRMISH_BIOMES, SKIRMISH_SIZES } from '../js/core/skirmish.js';

test('演習：手勢の職と得物がすべて実在する', () => {
  const squad = makeSkirmishSquad(20260615, 8);
  assert.ok(squad.length >= 5);
  for (const u of squad) {
    assert.ok(classDef(u.classId), `職 ${u.classId}`);
    for (const it of u.items) assert.ok(ITEMS[it.id], `得物 ${it.id}`);
    assert.equal(u.side, 'player');
    assert.equal(u.level, 8);
  }
});

test('演習：地勢・広さを選んで戦場が布ける', () => {
  for (const biome of SKIRMISH_BIOMES) {
    for (const size of Object.keys(SKIRMISH_SIZES)) {
      const { board, squad, battle } = makeSkirmish(7, { biome, size, level: 6 });
      assert.equal(board.biome, biome);
      assert.ok(board.unitsOf('player').length === squad.length);
      assert.ok(board.unitsOf('enemy').length >= 1, '敵がいる');
      assert.ok(board.weather, '空模様が宿る');
      assert.equal(battle.objective.type, 'rout');
    }
  }
});

test('演習：必ず決着する（無限ループしない）', () => {
  for (const size of Object.keys(SKIRMISH_SIZES)) {
    const { battle } = makeSkirmish(123, { size, level: 10 });
    const res = battle.autoResolve(120);
    assert.equal(res.over, true, `${size} が決着`);
  }
});

test('演習：イニシアチブでも決着する', () => {
  const { battle } = makeSkirmish(456, { size: 'small', level: 9, initiative: true });
  const res = battle.autoResolveInitiative(200);
  assert.equal(res.over, true);
});

test('演習：同じ種・設定なら同じ戦場（決定的）', () => {
  const build = () => makeSkirmish(999, { biome: 'snow', size: 'medium', level: 8 });
  const a = build(), b = build();
  const terr = bd => { let s = ''; bd.terrain.forEach((x, y, v) => s += v[0]); return s; };
  assert.equal(terr(a.board), terr(b.board), '地形が一致');
  const foes = bd => bd.unitsOf('enemy').map(u => `${u.classId}@${u.pos.x},${u.pos.y}`).join('|');
  assert.equal(foes(a.board), foes(b.board), '敵配置が一致');
});

test('演習：難度を上げると敵が強くなる', () => {
  const easy = makeSkirmish(5, { biome: 'green', size: 'medium', level: 8, difficulty: 0 });
  const hard = makeSkirmish(5, { biome: 'green', size: 'medium', level: 8, difficulty: 6 });
  const avg = bd => { const e = bd.unitsOf('enemy'); return e.reduce((s, u) => s + u.level, 0) / e.length; };
  assert.ok(avg(hard.board) > avg(easy.board), '難度で敵レベルが上がる');
});
