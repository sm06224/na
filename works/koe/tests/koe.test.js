import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VOWELS, VOWEL_IDS, scaleVowel, resonance, harmonicAmp, sing, choir, phrase,
  SCALE, degreeHz, midiToHz, voiceName, hashSeed, mulberry32,
} from '../js/core/koe.js';

const sr = 16000;   // テストは軽い標本化率で速く

test('母音：語彙は あいうえお、フォルマントは昇順で正', () => {
  assert.deepEqual(VOWEL_IDS, ['a', 'i', 'u', 'e', 'o']);
  for (const id of VOWEL_IDS) {
    const v = VOWELS[id];
    assert.equal(v.f.length, 3);
    assert.ok(v.f[0] > 0 && v.f[0] < v.f[1] && v.f[1] < v.f[2], `${id}: F1<F2<F3`);
    assert.ok(v.g[0] >= v.g[1], 'F1 がいちばん強い');
  }
});

test('共鳴：フォルマントは「山」——F1・F2 で、その谷間より大きい', () => {
  for (const id of VOWEL_IDS) {
    const v = VOWELS[id];
    const valley = (v.f[0] + v.f[1]) / 2;     // F1 と F2 のあいだ＝谷
    assert.ok(resonance(v.f[0], v) > resonance(valley, v), `${id}: F1 が谷より大きいはず`);
    assert.ok(resonance(v.f[1], v) > resonance(valley, v), `${id}: F2 が谷より大きいはず`);
  }
});

test('声道の伸縮：k 倍でフォルマントも k 倍（声色が変わる）', () => {
  const v = scaleVowel(VOWELS.a, 1.2);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(v.f[i] - VOWELS.a.f[i] * 1.2) < 1e-9);
});

test('歌声：正しい長さ・有限・無クリップ・エネルギーあり・決定的', () => {
  const w = sing({ f0: 200, vowel: 'a', seconds: 0.5, sampleRate: sr, vibrato: 0, seed: 'x' });
  assert.equal(w.length, Math.floor(sr * 0.5));
  let peak = 0, sum = 0;
  for (const v of w) { assert.ok(Number.isFinite(v)); if (Math.abs(v) > peak) peak = Math.abs(v); sum += v * v; }
  assert.ok(peak <= 1.0000001 && peak > 0.5, `正規化 (${peak})`);
  assert.ok(Math.sqrt(sum / w.length) > 0.02, '声に響きがない');
  const w2 = sing({ f0: 200, vowel: 'a', seconds: 0.5, sampleRate: sr, vibrato: 0, seed: 'x' });
  assert.deepEqual(Array.from(w), Array.from(w2), '決定的でない');
});

test('歌声：基音の周期で繰り返す（ちゃんと「その高さ」で鳴っている）', () => {
  const f0 = 200;
  const w = sing({ f0, vowel: 'a', seconds: 0.5, sampleRate: sr, vibrato: 0, breath: 0, seed: 'p' });
  const lag = Math.round(sr / f0);            // 1 周期ぶんのずらし
  // 中央部分で自己相関：1周期ずらしても、よく重なる＝周期的
  const a0 = (sr * 0.2) | 0, a1 = (sr * 0.4) | 0;
  let num = 0, d1 = 0, d2 = 0;
  for (let i = a0; i < a1; i++) { num += w[i] * w[i + lag]; d1 += w[i] * w[i]; d2 += w[i + lag] * w[i + lag]; }
  const corr = num / Math.sqrt(d1 * d2);
  assert.ok(corr > 0.7, `基音周期での自己相関が低い (${corr.toFixed(2)})`);
});

test('母音は聞き分けられる：あ と い は別の波形・別のスペクトル重み', () => {
  const a = sing({ f0: 200, vowel: 'a', seconds: 0.3, sampleRate: sr, vibrato: 0, seed: 's' });
  const i = sing({ f0: 200, vowel: 'i', seconds: 0.3, sampleRate: sr, vibrato: 0, seed: 's' });
  assert.notDeepEqual(Array.from(a), Array.from(i));
  // い は F2 が高い：2300Hz 付近の倍音が、あ より強く立つ
  const nA = Math.round(2300 / 200), w = 200;
  assert.ok(harmonicAmp(nA, 200, VOWELS.i) > harmonicAmp(nA, 200, VOWELS.a), 'い の F2 帯が あ より強いはず');
});

test('音階：五音で、重ねても濁らない（合唱の約束）', () => {
  const classes = new Set(SCALE.map(s => ((s % 12) + 12) % 12));
  for (let d = 0; d < 15; d++) {
    const hz = degreeHz(57, d);
    const semi = Math.round(12 * Math.log2(hz / midiToHz(57)));
    assert.ok(classes.has(((semi % 12) + 12) % 12), `degree ${d} が五音の外`);
  }
});

test('合唱：決定的、歌い手は複数、音程のずれは控えめ', () => {
  const c1 = choir('uta'), c2 = choir('uta');
  assert.deepEqual(c1, c2);
  assert.ok(c1.singers.length >= 3 && c1.singers.length <= 5);
  for (const s of c1.singers) assert.ok(Math.abs(s.detune) <= 8 && s.tract > 0.8);
  assert.notEqual(choir('uta').name, choir('umi').name);
});

test('歌：決定的、五音の音度と既知の母音、拍はおよそ 4×小節', () => {
  const p1 = phrase('song', 4), p2 = phrase('song', 4);
  assert.deepEqual(p1, p2);
  let beats = 0;
  for (const n of p1) {
    assert.ok(n.degree >= 0 && n.degree <= 9);
    assert.ok(VOWEL_IDS.includes(n.vowel));
    assert.ok(n.dur > 0);
    beats += n.dur;
  }
  assert.ok(Math.abs(beats - 16) < 1e-6, `4小節＝16拍のはず (${beats})`);
});

test('名前：決定的で種で変わる', () => {
  assert.equal(voiceName('a'), voiceName('a'));
  assert.notEqual(voiceName('a'), voiceName('b'));
});
