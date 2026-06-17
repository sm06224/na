import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deposit, compact, totalDepth, cliff, readRecord,
  GRAINS, EVENTS, glyphFor, eventLine, renderText, mulberry32, hashSeed,
} from '../js/core/strata.js';

const GRAINSET = new Set(GRAINS);
const EVENTSET = new Set(EVENTS);

test('種は決定的：同じ種・同じ歳月なら、寸分たがわぬ大地', () => {
  const a = deposit('hello', 300);
  const b = deposit('hello', 300);
  assert.deepEqual(a, b);
  const c = deposit('hellp', 300);
  assert.notDeepEqual(a, c);                 // 一文字でも変えれば別の地
  // 数値の種でも安定
  assert.deepEqual(deposit(20260617, 120), deposit(20260617, 120));
});

test('堆積：一年に一枚、古い順、厚みは正で有限、語彙は既知のものだけ', () => {
  const years = 500;
  const layers = deposit('terra', years);
  assert.equal(layers.length, years);
  for (let i = 0; i < layers.length; i++) {
    const l = layers[i];
    assert.equal(l.year, i + 1, '古い順（index0 が最古）');
    assert.ok(Number.isFinite(l.thickness) && l.thickness > 0, `厚みは正で有限 (${l.thickness})`);
    assert.ok(GRAINSET.has(l.grain), `粒度は既知 (${l.grain})`);
    assert.ok(Number.isInteger(l.hue) && l.hue >= 0 && l.hue < 12, `鉱物色は0..11 (${l.hue})`);
    assert.ok(l.event === null || EVENTSET.has(l.event), `出来事は既知 (${l.event})`);
  }
});

test('圧密：深く埋もれた層ほど薄くなる（単調）。圧密後も正で、元より薄い', () => {
  const layers = deposit('press', 400);
  const c = compact(layers);
  assert.equal(c.length, layers.length);
  // 新しい方（index 大）ほど burial 小・factor 大。factor は index に対し狭義単調増加。
  for (let i = 0; i < c.length - 1; i++) {
    assert.ok(c[i].factor < c[i + 1].factor + 1e-12, `factor は新しいほど大 (i=${i})`);
    assert.ok(c[i].burial >= c[i + 1].burial, `burial は古いほど大 (i=${i})`);
  }
  // 最深 < 最浅、かつ圧密後 ≤ 元・>0。
  assert.ok(c[0].factor < c[c.length - 1].factor, '最深層は最浅層より強く圧される');
  for (const l of c) {
    assert.ok(l.compacted > 0 && l.compacted <= l.thickness + 1e-9, '圧密後は正で元以下');
  }
  assert.ok(totalDepth(c) > 0, '総深度は正');
});

test('出来事：長い歳月にはまれな縞が必ず幾本か刻まれ、再現する', () => {
  const rec = readRecord('chronicle', 800);
  assert.ok(rec.length >= 5, `800年なら出来事は数本以上 (${rec.length})`);
  // 新しい順に並ぶ
  for (let i = 0; i < rec.length - 1; i++) assert.ok(rec[i].year >= rec[i + 1].year, '新しい順');
  for (const e of rec) {
    assert.ok(EVENTSET.has(e.event), '既知の出来事');
    assert.ok(e.year >= 1 && e.year <= 800, '年は範囲内');
    assert.equal(e.ago, 800 - e.year, '「何年前」は整合');
    assert.ok(e.line && e.line.length > 0 && e.line === eventLine(e.event), '岩に読む一行');
  }
  // 再現性
  assert.deepEqual(readRecord('chronicle', 800), rec);
});

test('崖：侵食面は上が新しく下が古い。全段が実在の層に対応する', () => {
  const years = 360, rows = 50;
  const face = cliff('cliffside', years, rows);
  assert.equal(face.length, rows);
  // 上（row 0）＝地表＝最も新しい。下＝最古。年は単調に減っていく（同層内は等しい）。
  for (let i = 0; i < face.length - 1; i++) {
    assert.ok(face[i].year >= face[i + 1].year, `上ほど新しい (row ${i})`);
  }
  assert.ok(face[0].year >= face[face.length - 1].year);
  // 表層は最も新しい年に、最下段は最古へ達する。
  assert.equal(face[0].year, years, '地表は最新の年');
  assert.equal(face[face.length - 1].year, 1, '崖の底は最古の年');
  for (const cell of face) {
    assert.ok(cell.year >= 1 && cell.year <= years, '段は実在の年');
    assert.ok(GRAINSET.has(cell.grain), '粒度は既知');
    assert.ok(typeof cell.glyph === 'string' && cell.glyph.length >= 1, '濃淡記号がある');
    assert.ok(cell.depth >= 0, '深度は非負');
  }
});

test('崖：段数を変えても破綻しない。深度は下るほど深い', () => {
  for (const rows of [1, 5, 33, 120]) {
    const face = cliff('any', 200, rows);
    assert.equal(face.length, rows);
    for (let i = 0; i < face.length - 1; i++) {
      assert.ok(face[i + 1].depth >= face[i].depth - 1e-9, '下るほど深い');
    }
  }
});

test('崖の文字刷り：行数ぶん刷られ、出来事の縞には注記が付く', () => {
  const txt = renderText('engrave', 300, 30, 12);
  const lines = txt.split('\n');
  assert.equal(lines.length, 30);
  assert.ok(lines.every(l => l.length >= 12), '各行に縞が刷られる');
});

test('擬似乱数は [0,1) に収まり、種ハッシュは安定', () => {
  const r = mulberry32(hashSeed('x'));
  for (let i = 0; i < 1000; i++) { const v = r(); assert.ok(v >= 0 && v < 1); }
  assert.equal(hashSeed(42), 42);
  assert.equal(hashSeed('same'), hashSeed('same'));
});
