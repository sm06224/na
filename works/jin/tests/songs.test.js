import test from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, song } from '../js/core/songs.js';
import { validateSong, parseTrack } from '../js/core/notation.js';

const REQUIRED = ['title', 'prologue', 'battle_green', 'battle_desert', 'battle_snow',
  'battle_ruins', 'battle_volcano', 'boss', 'victory', 'defeat', 'ending'];

test('必要な曲がすべてそろっている', () => {
  for (const id of REQUIRED) assert.ok(SONGS[id], `${id} がある`);
  assert.equal(song('nope'), null);
});

test('全曲：字句が正しく、テンポと複数トラックを持つ', () => {
  for (const id of Object.keys(SONGS)) {
    const s = SONGS[id];
    assert.deepEqual(validateSong(s), [], `${id} に誤った字句なし`);
    assert.ok(s.bpm >= 40 && s.bpm <= 300, `${id} のテンポ`);
    assert.ok(s.tracks.length >= 2, `${id} は重ねた声部を持つ`);
    assert.ok(s.loopSteps > 0, `${id} のループ長`);
  }
});

test('全トラック：ループ長を超えない（きれいに巡る）', () => {
  for (const id of Object.keys(SONGS)) {
    const s = SONGS[id];
    for (const tr of s.tracks) {
      const { length } = parseTrack(tr.data, tr.transpose || 0);
      assert.ok(length <= s.loopSteps, `${id} のトラックがループ長に収まる（${length}/${s.loopSteps}）`);
      assert.ok((tr.vol ?? 0.3) <= 1 && (tr.vol ?? 0.3) > 0, `${id} の音量`);
    }
  }
});

test('音域：リードは高すぎず、ベースは低い（耳にやさしい範囲）', () => {
  for (const id of Object.keys(SONGS)) {
    for (const tr of SONGS[id].tracks) {
      const { events } = parseTrack(tr.data, tr.transpose || 0);
      for (const e of events) if (e.type === 'note') {
        assert.ok(e.midi >= 24 && e.midi <= 100, `${id}/${tr.inst} の音が常識的な範囲`);
      }
    }
  }
});
