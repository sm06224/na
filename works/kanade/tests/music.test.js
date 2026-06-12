import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SCALES, scaleById, SPAN, freqOf, degreeFromY, panFromX, hueOf, EchoLoop,
} from '../js/core/music.js';

/* ----- 音階 ----- */

test('音階台帳：すべて五音、半音位置はオクターブ内で昇順', () => {
  for (const s of SCALES) {
    assert.equal(s.intervals.length, 5, `${s.id} は五音`);
    for (let i = 0; i < 5; i++) {
      assert.ok(s.intervals[i] >= 0 && s.intervals[i] < 12);
      if (i) assert.ok(s.intervals[i] > s.intervals[i - 1], `${s.id} 昇順`);
    }
    assert.ok(s.label && s.gloss);
  }
  assert.equal(scaleById.yoi.intervals[0], 0, '主音から始まる');
});

test('五音音階に半音のぶつかりがない（協和の保証）', () => {
  // 隣り合う音の間隔が 1 半音だと、同時に鳴ったとき濁る
  for (const s of SCALES) {
    const iv = [...s.intervals, s.intervals[0] + 12];
    for (let i = 1; i < iv.length; i++) {
      assert.ok(iv[i] - iv[i - 1] >= 2, `${s.id} の ${i} 番目の間隔`);
    }
  }
});

test('周波数：5 段上はちょうど 1 オクターブ（2 倍）', () => {
  for (const s of SCALES) {
    for (let d = 0; d + 5 < SPAN; d++) {
      const ratio = freqOf(s, d + 5) / freqOf(s, d);
      assert.ok(Math.abs(ratio - 2) < 1e-9, `${s.id} d=${d}`);
    }
  }
});

test('周波数は人の耳に心地よい帯域に収まる', () => {
  for (const s of SCALES) {
    assert.ok(freqOf(s, 0) >= 100, '低すぎない');
    assert.ok(freqOf(s, SPAN - 1) <= 2200, '高すぎない');
  }
});

/* ----- 画面 → 音 ----- */

test('縦位置：上端が最高段、下端が最低段、外れ値は丸める', () => {
  assert.equal(degreeFromY(0), SPAN - 1);
  assert.equal(degreeFromY(1), 0);
  assert.equal(degreeFromY(-5), SPAN - 1);
  assert.equal(degreeFromY(99), 0);
  // 単調：下がるほど段も下がる
  let prev = Infinity;
  for (let y = 0; y <= 1.001; y += 0.05) {
    const d = degreeFromY(y);
    assert.ok(d <= prev);
    prev = d;
  }
});

test('定位：中央 0、左右対称、振り切らない', () => {
  assert.equal(panFromX(0.5), 0);
  assert.equal(panFromX(0), -panFromX(1));
  assert.ok(Math.abs(panFromX(0)) <= 0.8 + 1e-9);
});

test('色：低音から高音へ、音階ごとの帯の中を滲む', () => {
  for (const s of SCALES) {
    assert.equal(hueOf(s, 0), s.hueA);
    assert.equal(hueOf(s, SPAN - 1), s.hueB);
  }
});

/* ----- こだま ----- */

test('こだま：ひと巡りして、減って還ってくる', () => {
  const loop = new EchoLoop(8, 0.5, 0.1);
  loop.add({ x: 0.5, y: 0.5, degree: 7 }, 100);
  assert.deepEqual(loop.poll(104), [], 'まだ還らない');
  const back = loop.poll(108.1);
  assert.equal(back.length, 1);
  assert.equal(back[0].degree, 7);
  assert.ok(Math.abs(back[0].gain - 0.5) < 1e-9);
  assert.equal(back[0].gen, 1);
});

test('こだま：巡るたびに薄れ、floor を割ると忘れられる', () => {
  const loop = new EchoLoop(8, 0.5, 0.2);
  loop.add({ x: 0, y: 0, degree: 0 }, 0);
  assert.equal(loop.poll(8.1).length, 1);    // 0.5
  assert.equal(loop.poll(16.1).length, 1);   // 0.25
  assert.equal(loop.poll(24.1).length, 0);   // 0.125 < floor → 消える
  assert.equal(loop.size(), 0);
});

test('こだま：取りこぼしても重複再生しない', () => {
  const loop = new EchoLoop(8, 0.9, 0.1);
  loop.add({ x: 0, y: 0, degree: 3 }, 0);
  // 長く放置してから 2 回続けて poll しても、出てくるのは 1 巡分ずつ
  const a = loop.poll(8.5);
  const b = loop.poll(8.6);
  assert.equal(a.length, 1);
  assert.equal(b.length, 0);
});

test('こだま：切っていれば何も覚えない・何も還さない', () => {
  const loop = new EchoLoop(8, 0.5, 0.1);
  loop.enabled = false;
  loop.add({ x: 0, y: 0, degree: 1 }, 0);
  assert.equal(loop.size(), 0);
  assert.deepEqual(loop.poll(100), []);
});

test('こだま：覚えすぎたら古いものから忘れる（暴走しない）', () => {
  const loop = new EchoLoop(8, 0.5, 0.1);
  for (let i = 0; i < 1000; i++) loop.add({ x: 0, y: 0, degree: i % 15 }, i * 0.01);
  assert.ok(loop.size() <= 400);
});
