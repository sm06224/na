import test from 'node:test';
import assert from 'node:assert/strict';
import { noteToMidi, midiToFreq, noteToFreq, tokenInfo, parseTrack, validateSong, stepSeconds } from '../js/core/notation.js';

test('音名→MIDI→周波数：基準が合う', () => {
  assert.equal(noteToMidi('c4'), 60);
  assert.equal(noteToMidi('a4'), 69);
  assert.ok(Math.abs(midiToFreq(69) - 440) < 1e-9);
  assert.ok(Math.abs(noteToFreq('c4') - 261.6256) < 0.01);
  assert.equal(noteToMidi('c#4'), 61);
  assert.equal(noteToMidi('db4'), 61);     // 異名同音
  assert.equal(noteToMidi('zz'), null);
});

test('字句の判定：音符・休符・打・不正', () => {
  assert.equal(tokenInfo('e5').type, 'note');
  assert.equal(tokenInfo('r').type, 'rest');
  assert.equal(tokenInfo('x').type, 'drum');
  assert.equal(tokenInfo('h').drum, 'hat');
  assert.equal(tokenInfo('q9').type, 'invalid');
});

test('トラック解析：時刻と長さ、休符で進み、タイで伸びる', () => {
  const { events, length } = parseTrack('c4 e4:2 r:2 g4');
  assert.equal(events.length, 3);                 // 休符は時間だけ
  assert.deepEqual(events.map(e => e.t), [0, 4, 8]);   // 既定4 + 2 + 休符2
  assert.equal(events[1].dur, 2);
  assert.equal(length, 12);
  // タイ：直前を伸ばす
  const tied = parseTrack('c4 _:4');
  assert.equal(tied.events.length, 1);
  assert.equal(tied.events[0].dur, 8);
});

test('移調：transpose ぶん半音ずれる', () => {
  const a = parseTrack('c4', 0).events[0].midi;
  const b = parseTrack('c4', 12).events[0].midi;
  assert.equal(b - a, 12);
});

test('打のトラック：種類が取れる', () => {
  const { events } = parseTrack('x h o h');
  assert.deepEqual(events.map(e => e.drum), ['kick', 'hat', 'snare', 'hat']);
});

test('曲の検証：正しい曲は誤りなし、不正字句は捕える', () => {
  const good = { name: 'a', bpm: 120, tracks: [{ inst: 'square', vol: 0.3, data: 'c4 e4 g4 r' }] };
  assert.deepEqual(validateSong(good), []);
  const bad = { name: '', bpm: 0, tracks: [{ inst: '', vol: 1, data: 'c4 zz9 q' }] };
  const errs = validateSong(bad);
  assert.ok(errs.length >= 3);
  assert.ok(errs.some(e => e.includes('不明な字句')));
});

test('テンポ：十六分音符の秒は bpm に反比例', () => {
  assert.ok(Math.abs(stepSeconds(120) - 0.125) < 1e-9);   // 120bpm の16分 = 0.125s
  assert.ok(stepSeconds(60) > stepSeconds(240));
});
