import test from 'node:test';
import assert from 'node:assert/strict';
import { classDef } from '../js/core/classes.js';
import { GAIDEN, gaidenById, makeGaiden } from '../js/core/gaiden.js';
import { EXTRA_GAIDEN8 } from '../js/core/gaiden_extra8.js';

const BIOMES = new Set(['green', 'desert', 'snow', 'ruins', 'volcano']);
const SIZES = new Set(['small', 'medium', 'large']);
const OBJS = new Set(['rout', 'defeat_boss', 'seize']);

test('外伝・其の九：8つの新シナリオが本編の外伝群へ合流', () => {
  assert.equal(EXTRA_GAIDEN8.length, 8);
  const ids = new Set();
  for (const s of EXTRA_GAIDEN8) {
    assert.ok(GAIDEN.includes(s) && gaidenById(s.id) === s, `${s.id} が合流`);
    assert.ok(!ids.has(s.id), `id 一意 ${s.id}`); ids.add(s.id);
    assert.ok(BIOMES.has(s.biome) && SIZES.has(s.size) && OBJS.has(s.objective), `${s.id} の地形等`);
    assert.ok(classDef(s.boss.classId) && s.boss.level > s.level && s.title && s.intro && s.outro, `${s.id} の物語`);
  }
  assert.ok(GAIDEN.length >= 69, `外伝が69以上（${GAIDEN.length}）`);
  const by = o => EXTRA_GAIDEN8.filter(s => s.objective === o).length;
  assert.ok(by('defeat_boss') >= 3 && by('seize') >= 2 && by('rout') >= 1);
  assert.ok(EXTRA_GAIDEN8.filter(s => s.monster).length >= 2);
});

test('外伝・其の九：新シナリオも布陣でき必ず決着する', () => {
  for (const s of EXTRA_GAIDEN8) {
    const { battle, board, squad } = makeGaiden(s, 20260622);
    assert.ok(squad.length >= 5 && board.unitsOf('player').some(u => u.isLord), `${s.id} の手勢`);
    assert.equal(battle.autoResolve(180).over, true, `${s.title} が決着`);
  }
});
