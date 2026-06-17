import test from 'node:test';
import assert from 'node:assert/strict';
import { classDef } from '../js/core/classes.js';
import { GAIDEN, gaidenById, makeGaiden } from '../js/core/gaiden.js';
import { EXTRA_GAIDEN7 } from '../js/core/gaiden_extra7.js';
import { SONGS } from '../js/core/songs.js';
import { EXTRA_SONGS5 } from '../js/core/songs5.js';
import { parseTrack } from '../js/core/notation.js';

const BIOMES = new Set(['green', 'desert', 'snow', 'ruins', 'volcano']);
const SIZES = new Set(['small', 'medium', 'large']);
const OBJS = new Set(['rout', 'defeat_boss', 'seize']);

test('外伝・其の八：8つの新シナリオが本編の外伝群へ合流し決着する', () => {
  assert.equal(EXTRA_GAIDEN7.length, 8);
  const ids = new Set();
  for (const s of EXTRA_GAIDEN7) {
    assert.ok(GAIDEN.includes(s) && gaidenById(s.id) === s, `${s.id} が合流`);
    assert.ok(!ids.has(s.id), `id 一意 ${s.id}`); ids.add(s.id);
    assert.ok(BIOMES.has(s.biome) && SIZES.has(s.size) && OBJS.has(s.objective), `${s.id} の地形等`);
    assert.ok(classDef(s.boss.classId) && s.boss.level > s.level && s.title && s.intro && s.outro, `${s.id} の物語`);
  }
  assert.ok(GAIDEN.length >= 61, `外伝が61以上（${GAIDEN.length}）`);
  const by = o => EXTRA_GAIDEN7.filter(s => s.objective === o).length;
  assert.ok(by('defeat_boss') >= 3 && by('seize') >= 2 && by('rout') >= 1);
  assert.ok(EXTRA_GAIDEN7.filter(s => s.monster).length >= 2);
});

test('外伝・其の八：新シナリオも布陣でき必ず決着する', () => {
  for (const s of EXTRA_GAIDEN7) {
    const { battle, board, squad } = makeGaiden(s, 20260621);
    assert.ok(squad.length >= 5 && board.unitsOf('player').some(u => u.isLord), `${s.id} の手勢`);
    assert.equal(battle.autoResolve(180).over, true, `${s.title} が決着`);
  }
});

test('別なる将・野の戦いの曲が SONGS に登録され、拍に揃う', () => {
  for (const key of ['boss2', 'boss3', 'battle_wild']) {
    assert.ok(EXTRA_SONGS5[key] && SONGS[key] === EXTRA_SONGS5[key], `${key} が合流`);
    const s = SONGS[key];
    assert.ok(s.name && s.bpm > 0 && s.loopSteps === 128 && s.tracks.length >= 3);
    for (const t of s.tracks) {
      assert.ok(['square', 'square2', 'triangle', 'bass', 'drum'].includes(t.inst), `${key} の音源`);
      assert.equal(parseTrack(t.data).length, 128, `${key} の ${t.inst} が拍に揃う`);
    }
  }
});
