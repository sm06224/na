import test from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, song } from '../js/core/songs.js';
import { validateSong, parseTrack } from '../js/core/notation.js';
import { EXTRA_SONGS } from '../js/core/songs2.js';
import { SUPPORTS } from '../js/core/script.js';
import { EXTRA_SUPPORTS3 } from '../js/core/script4.js';

test('第三幕BGM：天の戦・最終戦が SONGS に合流し、字句も妥当', () => {
  for (const id of ['battle_sky', 'finalboss']) {
    assert.ok(SONGS[id] && song(id), `${id} がある`);
    assert.deepEqual(validateSong(SONGS[id]), [], `${id} の字句`);
    assert.ok(SONGS[id].tracks.length >= 3, `${id} は重ねた声部`);
    for (const tr of SONGS[id].tracks) {
      const { length } = parseTrack(tr.data);
      assert.ok(length <= SONGS[id].loopSteps, `${id} のトラックがループに収まる`);
    }
  }
  assert.equal(EXTRA_SONGS.battle_sky.bpm >= 40, true);
});

test('第三幕の支援会話：16組が本編 SUPPORTS に合流', () => {
  assert.equal(EXTRA_SUPPORTS3.length, 16);
  for (const s of EXTRA_SUPPORTS3) {
    assert.ok(s.a && s.b && s.lines.length >= 5, `${s.a}＆${s.b}`);
    assert.ok(SUPPORTS.includes(s), `${s.a}＆${s.b} が合流`);
    for (const l of s.lines) assert.ok((l.who === s.a || l.who === s.b) && l.line && !/[\n\r]/.test(l.line));
  }
});

test('第三幕の支援会話：新たな仲間（セレネ・ガイル・ミーア）が多く登場', () => {
  const newc = new Set(['セレネ', 'ガイル', 'ミーア']);
  const n = EXTRA_SUPPORTS3.filter(s => newc.has(s.a) || newc.has(s.b)).length;
  assert.ok(n >= 9, `新仲間の会話が十分にある（${n}）`);
});
