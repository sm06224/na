import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RNG } from '../js/core/rng.js';
import {
  note, noteDeg, noteDur, noteToKana, melodyToKana, noteFreq,
  makeStyle, coinMelody, varyMelody, melodyDistance, memorability,
  DEGREES, DURS, MIN_LEN, MAX_LEN,
} from '../js/core/scale.js';
import { Repertoire, mutualResonance, _resetSongId } from '../js/core/repertoire.js';
import { OCCASION_IDS } from '../js/core/occasions.js';

/* ----- 音階 ----- */

test('音符の符号化と復号', () => {
  for (let d = 0; d < DEGREES; d++) {
    for (let i = 0; i < DURS.length; i++) {
      const n = note(d, i);
      assert.equal(noteDeg(n), d);
      assert.equal(noteDur(n), DURS[i]);
    }
  }
});

test('カナ写し：低オクターブはひらがな、高オクターブはカタカナ、長さは「ー」', () => {
  assert.equal(noteToKana(note(0, 0)), 'ど');
  assert.equal(noteToKana(note(5, 0)), 'ド');
  assert.equal(noteToKana(note(9, 2)), 'ラーー');
  assert.equal(melodyToKana([note(4, 0), note(5, 1), note(3, 0)]), 'らドーそ');
});

test('周波数：オクターブ上は 2 倍、五音音階は協和する', () => {
  assert.ok(Math.abs(noteFreq(note(5, 0)) - noteFreq(note(0, 0)) * 2) < 0.01);
  assert.ok(noteFreq(note(0, 0)) > 200 && noteFreq(note(9, 0)) < 1200);
});

test('新しい歌：音域内の 4〜7 音、同じ乱数からは同じ節', () => {
  const mk = () => {
    const rng = new RNG(42);
    return coinMelody(makeStyle(rng), rng);
  };
  const a = mk(), b = mk();
  assert.deepEqual(a, b, '決定的');
  assert.ok(a.length >= 4 && a.length <= 7);
  for (const n of a) assert.ok(noteDeg(n) >= 0 && noteDeg(n) < DEGREES);
});

test('変奏：節は揺れても、歌である範囲（長さ・音域）を出ない', () => {
  const rng = new RNG(7);
  let m = coinMelody(makeStyle(rng), rng);
  for (let i = 0; i < 400; i++) {
    m = varyMelody(m, rng, 1.4);
    assert.ok(m.length >= Math.min(MIN_LEN, m.length) && m.length <= MAX_LEN, `長さ ${m.length}`);
    for (const n of m) assert.ok(noteDeg(n) >= 0 && noteDeg(n) < DEGREES);
  }
});

test('旋律の距離：同一は 0、対称、1 音違いは 1', () => {
  const a = [note(0, 0), note(1, 0), note(2, 0)];
  const b = a.slice(); b[1] = note(3, 0);
  assert.equal(melodyDistance(a, a), 0);
  assert.equal(melodyDistance(a, b), 1);
  assert.equal(melodyDistance(a, b), melodyDistance(b, a));
});

test('覚えやすさ：繰り返しのある節は、跳ね回る節より胸に残る', () => {
  // ドレドレドレドレ — フックそのもの
  const hook = [note(5, 0), note(6, 0), note(5, 0), note(6, 0), note(5, 0), note(6, 0), note(5, 0), note(6, 0)];
  // 跳躍だらけで繰り返しのない 8 音
  const zigzag = [note(0, 0), note(9, 1), note(2, 2), note(7, 0), note(1, 1), note(8, 2), note(3, 0), note(6, 1)];
  assert.ok(memorability(hook) > memorability(zigzag) + 0.3,
    `hook=${memorability(hook).toFixed(2)} zigzag=${memorability(zigzag).toFixed(2)}`);
  for (const m of [hook, zigzag]) {
    const v = memorability(m);
    assert.ok(v >= 0 && v <= 1);
  }
});

/* ----- 持ち歌 ----- */

const mel = (...degs) => degs.map(d => note(d, 0));

test('蔵：歌を入れ、同じ節は重複しない', () => {
  _resetSongId(1);
  const rep = new Repertoire();
  const s = rep.coin('lull', mel(0, 1, 2), 1);
  assert.ok(s);
  assert.equal(rep.coin('lull', mel(0, 1, 2), 2), null, '同じ節は入らない');
  assert.equal(rep.size(), 1);
});

test('蔵には限りがある：13 番目の歌は、いちばん弱い歌を押し出す', () => {
  _resetSongId(1);
  const rep = new Repertoire();
  for (let i = 0; i < 12; i++) {
    // 長さの違う節は必ず別の歌（3〜14 音）
    const s = rep.coin('lull', mel(...Array.from({ length: 3 + i }, (_, k) => (i + k) % 10)), 1);
    rep.reinforce(s, 0.1 * i, 1);
  }
  assert.equal(rep.entries('lull').length, 12);
  rep.coin('lull', mel(9, 0, 9), 2);
  assert.equal(rep.entries('lull').length, 12, '溢れない');
});

test('愛され度：歌えば強まり、歌われねば薄れて忘れられる', () => {
  _resetSongId(1);
  const rep = new Repertoire();
  const s = rep.coin('work', mel(0, 1, 2, 1, 0), 1);
  rep.reinforce(s, 2, 1);
  const before = s.strength;
  rep.decay(0.05, 2);
  assert.ok(s.strength < before, '減衰する');
  for (let y = 0; y < 400; y++) rep.decay(0.05, y);
  assert.equal(rep.size(), 0, 'やがて忘れられる');
});

test('覚えやすい歌は、同じ歳月でも忘れられにくい', () => {
  _resetSongId(1);
  const rep = new Repertoire();
  // 繰り返しの強い節と、繰り返しのない節を同じ強さで入れる
  const catchy = rep.coin('feast', [note(5, 0), note(6, 0), note(5, 0), note(6, 0), note(5, 0), note(6, 0)], 1);
  const plain = rep.coin('feast', [note(0, 2), note(7, 1), note(2, 0), note(9, 2), note(4, 1), note(6, 0)], 1);
  rep.reinforce(catchy, 2, 1); rep.reinforce(plain, 2, 1);
  catchy.strength = plain.strength = 3;
  for (let y = 0; y < 60; y++) rep.decay(0.03, y);
  assert.ok(catchy.strength > plain.strength,
    `catchy=${catchy.strength.toFixed(2)} plain=${plain.strength.toFixed(2)}`);
});

test('最愛の歌が選ばれやすく、しかし新しい歌にも出番がある', () => {
  _resetSongId(1);
  const rng = new RNG(5);
  const rep = new Repertoire();
  const a = rep.coin('road', mel(0, 1, 0, 1), 1);
  const b = rep.coin('road', mel(5, 7, 9, 2), 1);
  rep.reinforce(a, 5, 1);
  let na = 0, nb = 0;
  for (let i = 0; i < 600; i++) {
    const c = rep.choose('road', rng);
    if (c === a) na++; else if (c === b) nb++;
  }
  assert.ok(na > nb * 3, `強い歌が優先 (${na} vs ${nb})`);
  assert.ok(nb > 0, '弱い歌にも出番');
});

test('淘汰：圧倒的な歌は、よく似た弱い歌を吸収する', () => {
  _resetSongId(1);
  const rep = new Repertoire();
  const dom = rep.coin('dirge', mel(0, 1, 2, 3), 1);
  const sim = rep.coin('dirge', mel(0, 1, 2, 4), 1);   // 1 音違い
  rep.reinforce(dom, 7, 1);
  sim.strength = 0.5;
  rep.prune();
  assert.equal(rep.entries('dirge').length, 1);
});

test('複製した蔵は独立に育つ（方言の出発点）', () => {
  _resetSongId(1);
  const rep = new Repertoire();
  rep.coin('saga', mel(2, 3, 4), 1);
  const copy = rep.clone();
  copy.coin('saga', mel(7, 8, 9), 2);
  assert.equal(rep.entries('saga').length, 1);
  assert.equal(copy.entries('saga').length, 2);
});

test('響き合い：同じ蔵どうしは 1、別の節ばかりなら低い', () => {
  _resetSongId(1);
  const a = new Repertoire(), b = new Repertoire();
  for (const oid of OCCASION_IDS) {
    a.coin(oid, mel(0, 1, 2, 3), 1);
    b.coin(oid, mel(0, 1, 2, 3), 1);
  }
  assert.ok(mutualResonance(a, a.clone()) > 0.999);
  assert.ok(mutualResonance(a, b) > 0.999);
  const c = new Repertoire();
  for (const oid of OCCASION_IDS) c.coin(oid, mel(9, 8, 7, 6), 1);
  assert.ok(mutualResonance(a, c) < 0.2);
});
