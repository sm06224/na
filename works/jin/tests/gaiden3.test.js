import test from 'node:test';
import assert from 'node:assert/strict';
import { classDef } from '../js/core/classes.js';
import { GAIDEN, gaidenById, makeGaiden } from '../js/core/gaiden.js';
import { EXTRA_GAIDEN2 } from '../js/core/gaiden_extra2.js';

const BIOMES = new Set(['green', 'desert', 'snow', 'ruins', 'volcano']);
const SIZES = new Set(['small', 'medium', 'large']);
const OBJS = new Set(['rout', 'defeat_boss', 'seize']);

test('外伝・其の三：8つの新シナリオが本編の外伝群へ合流', () => {
  assert.equal(EXTRA_GAIDEN2.length, 8);
  const ids = new Set();
  for (const s of EXTRA_GAIDEN2) {
    assert.ok(GAIDEN.includes(s), `${s.id} が合流`);
    assert.ok(gaidenById(s.id) === s, `${s.id} を引ける`);
    assert.ok(!ids.has(s.id), `id 一意 ${s.id}`); ids.add(s.id);
  }
  assert.ok(GAIDEN.length >= 21, `外伝が21以上（${GAIDEN.length}）`);
});

test('外伝・其の三：題・物語・実在のボス職と妥当な目標を持つ', () => {
  for (const s of EXTRA_GAIDEN2) {
    assert.ok(s.title && s.intro && s.outro, `${s.id} に題と物語`);
    assert.ok(!/[\n\r]/.test(s.intro) && !/[\n\r]/.test(s.outro), `${s.id} は一行`);
    assert.ok(BIOMES.has(s.biome) && SIZES.has(s.size) && OBJS.has(s.objective), `${s.id} の地形・広さ・目標`);
    assert.ok(classDef(s.boss.classId), `${s.id} のボス職`);
    assert.ok(s.boss.level > s.level, `${s.id} のボスは格上`);
  }
});

test('外伝・其の三：目標の配分が整い、魔物戦もある', () => {
  const by = o => EXTRA_GAIDEN2.filter(s => s.objective === o).length;
  assert.ok(by('defeat_boss') >= 3 && by('seize') >= 2 && by('rout') >= 1);
  assert.ok(EXTRA_GAIDEN2.filter(s => s.monster).length >= 2, '魔物戦が複数');
});

test('外伝・其の三：新シナリオも布陣でき必ず決着する', () => {
  for (const s of EXTRA_GAIDEN2) {
    const { battle, board, squad } = makeGaiden(s, 20260617);
    assert.ok(squad.length >= 5 && board.unitsOf('player').some(u => u.isLord), `${s.id} の手勢`);
    assert.equal(battle.autoResolve(180).over, true, `${s.title} が決着`);
  }
});
