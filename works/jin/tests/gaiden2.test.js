import test from 'node:test';
import assert from 'node:assert/strict';
import { classDef } from '../js/core/classes.js';
import { GAIDEN, gaidenById, makeGaiden } from '../js/core/gaiden.js';
import { EXTRA_GAIDEN } from '../js/core/gaiden_extra.js';
import { SONGS } from '../js/core/songs.js';
import { EXTRA_SONGS3 } from '../js/core/songs3.js';
import { parseTrack } from '../js/core/notation.js';

const BIOMES = new Set(['green', 'desert', 'snow', 'ruins', 'volcano']);
const SIZES = new Set(['small', 'medium', 'large']);
const OBJS = new Set(['rout', 'defeat_boss', 'seize']);

test('外伝・続：8つの新シナリオが本編の外伝群へ合流', () => {
  assert.equal(EXTRA_GAIDEN.length, 8);
  for (const s of EXTRA_GAIDEN) {
    assert.ok(GAIDEN.includes(s), `${s.id} が合流`);
    assert.ok(gaidenById(s.id) === s, `${s.id} を引ける`);
  }
  // 元の5つ＋追加8つ
  assert.ok(GAIDEN.length >= 13);
});

test('外伝・続：題・物語・実在のボス職と妥当な目標を持つ', () => {
  for (const s of EXTRA_GAIDEN) {
    assert.ok(s.title && s.intro && s.outro, `${s.id} に題と物語`);
    assert.ok(!/[\n\r]/.test(s.intro) && !/[\n\r]/.test(s.outro), `${s.id} は一行`);
    assert.ok(BIOMES.has(s.biome), `${s.id} の地形`);
    assert.ok(SIZES.has(s.size), `${s.id} の広さ`);
    assert.ok(OBJS.has(s.objective), `${s.id} の目標`);
    assert.ok(classDef(s.boss.classId), `${s.id} のボス職`);
    assert.ok(s.boss.level > s.level, `${s.id} のボスは格上`);
  }
});

test('外伝・続：目標の配分が物語として整っている', () => {
  const by = o => EXTRA_GAIDEN.filter(s => s.objective === o).length;
  assert.ok(by('defeat_boss') >= 3);
  assert.ok(by('seize') >= 2);
  assert.ok(by('rout') >= 1);
  assert.ok(EXTRA_GAIDEN.filter(s => s.monster).length >= 2, '魔物戦が複数');
});

test('外伝・続：新シナリオも布陣でき必ず決着する', () => {
  for (const s of EXTRA_GAIDEN) {
    const { battle, board, squad } = makeGaiden(s, 20260616);
    assert.ok(squad.length >= 5 && board.unitsOf('player').some(u => u.isLord), `${s.id} の手勢`);
    assert.equal(battle.autoResolve(180).over, true, `${s.title} が決着`);
  }
});

test('拠点・闘技場の曲が SONGS に登録されている', () => {
  for (const key of ['camp', 'arena']) {
    assert.ok(EXTRA_SONGS3[key], `${key} がある`);
    assert.ok(SONGS[key] === EXTRA_SONGS3[key], `${key} が合流`);
    const s = SONGS[key];
    assert.ok(s.name && s.bpm > 0 && s.loopSteps > 0 && Array.isArray(s.tracks) && s.tracks.length >= 3);
    for (const t of s.tracks) {
      assert.ok(['square', 'square2', 'triangle', 'bass', 'drum'].includes(t.inst), `${key} の音源`);
      assert.equal(parseTrack(t.data).length, s.loopSteps, `${key} の ${t.inst} が拍に揃う`);
    }
  }
});
