/* ============================================================
   儚 のヘッドレス検証 — 絵は見えなくても、物理は確かめられる。
   色は等色関数で正しく出るか。薄膜は厚み0で黒くなるか（黒い膜）。
   厚みが増すと色は次数を巡るか。膜は上から薄り、黒い膜を育てるか。
   美しさを物理に保証させる。ここはその保証書。
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spectrumToXYZ, xyzToLinearSRGB } from '../js/core/spectrum.js';
import { reflectance, colorOfThickness, buildScale, sample } from '../js/core/film.js';
import { makeFilm, thickness, meanThickness, topBottom, blackFraction } from '../js/core/flow.js';
import { renderRGBA, vitality } from '../js/core/render.js';

const argmax = (a) => a.indexOf(Math.max(a[0], a[1], a[2]));

test('色：完全な白（R=1）は、D65 の白＝sRGB の (1,1,1) になる', () => {
  const [r, g, b] = xyzToLinearSRGB(...spectrumToXYZ(() => 1));
  for (const c of [r, g, b]) assert.ok(Math.abs(c - 1) < 0.02, `白がずれた: ${c}`);
});

test('色：単色の光は、正しい原色になる（460→青・530→緑・620→赤）', () => {
  const g = (l, c) => { const z = (l - c) / 12; return Math.exp(-z * z); };
  const mono = (c) => xyzToLinearSRGB(...spectrumToXYZ((l) => g(l, c)));
  assert.equal(argmax(mono(460)), 2);   // 青が最大
  assert.equal(argmax(mono(530)), 1);   // 緑が最大
  assert.equal(argmax(mono(620)), 0);   // 赤が最大
});

test('薄膜：反射率は 0..1 に収まり、厚み0は真っ黒（破れる直前の黒い膜）', () => {
  for (const d of [0, 50, 137, 300, 800]) for (const l of [420, 550, 680]) {
    const R = reflectance(d, 1, l);
    assert.ok(R >= 0 && R <= 1, `R が範囲外: ${R}`);
  }
  // 自由なシャボン膜（空気/水/空気）：d→0 で表裏の反射が打ち消し、R≈0。
  assert.ok(reflectance(0, 1, 550) < 1e-6, '黒い膜になっていない');
});

test('薄膜：λ/4 の厚みで強めあい、λ/2 で弱めあう（干渉の心臓部）', () => {
  const l = 550, n = 1.335;
  const peak = reflectance(l / (4 * n), 1, l);   // ~103nm：強めあい（π ずれゆえ）
  const null_ = reflectance(l / (2 * n), 1, l);  // ~206nm：弱めあい
  assert.ok(peak > 0.04, `強めあいが弱い: ${peak}`);
  assert.ok(null_ < 0.01, `弱めあいきれていない: ${null_}`);
  assert.ok(peak > null_ * 10, '強めあいと弱めあいの差が乏しい');
});

test('色階：厚み0は黒、増すほど色は次数を巡る（黒→金→紅紫→青→緑…）', () => {
  const c0 = colorOfThickness(0);
  assert.ok(Math.max(c0[0], c0[1], c0[2]) < 0.05, '厚み0が黒くない');
  // 紅紫（マゼンタ：赤と青が立ち、緑が引く）が必ず現れる。
  let magenta = false;
  const doms = new Set();
  for (let d = 80; d <= 600; d += 10) {
    const c = colorOfThickness(d);
    if (c[0] > 0.3 && c[2] > 0.3 && c[1] < 0.7 * Math.min(c[0], c[2])) magenta = true;
    if (Math.max(c[0], c[1], c[2]) > 0.15) doms.add(argmax([c[0], c[1], c[2]]));
  }
  assert.ok(magenta, '紅紫が現れない');
  assert.ok(doms.size >= 3, `色が次数を巡っていない（主色 ${doms.size} 種）`); // 赤・緑・青すべてが主役になる
});

test('色階：同じ条件なら、寸分たがわず同じ表（決定的）', () => {
  const a = buildScale(), b = buildScale();
  assert.equal(a.n, b.n);
  for (let i = 0; i < a.lin.length; i += 257) assert.equal(a.lin[i], b.lin[i]);
  // 表引きは厚みに対してなめらか（隣り合う厚みの色が近い）。
  const s = a, c1 = sample(s, 300), c2 = sample(s, 304);
  const gap = Math.abs(c1[0] - c2[0]) + Math.abs(c1[1] - c2[1]) + Math.abs(c1[2] - c2[2]);
  assert.ok(gap < 0.3, '色階が飛んでいる');
});

test('膜：同じ種からは同じ膜・同じうつろい（決定的）', () => {
  const a = makeFilm('夏', { base: 500 }), b = makeFilm('夏', { base: 500 });
  for (const [x, y, t] of [[0.2, 0.3, 0], [0.7, 0.8, 4.5], [0.5, 0.1, 9]]) {
    assert.equal(thickness(a, x, y, t), thickness(b, x, y, t));
  }
  assert.notEqual(thickness(makeFilm('夏'), 0.5, 0.5, 0), thickness(makeFilm('冬'), 0.5, 0.5, 0));
});

test('膜：水は切れ、上から薄り、黒い膜が育つ（消える支度）', () => {
  const f = makeFilm('test');
  // 水切れ：平均の厚みは時とともに必ず減る。
  assert.ok(meanThickness(f, 0) > meanThickness(f, 6), '水が切れていない（0→6s）');
  assert.ok(meanThickness(f, 6) > meanThickness(f, 12), '水が切れていない（6→12s）');
  // 上ほど薄い：多くの種で上半分が下半分より薄い。
  let topThin = 0;
  for (const s of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    const r = topBottom(makeFilm(s), 2);
    if (r.top < r.bottom) topThin++;
  }
  assert.ok(topThin >= 6, `上ほど薄い、が崩れている: ${topThin}/8`);
  // 黒い膜：時間とともに、厚み≈0 の割合が増える。
  assert.ok(blackFraction(f, 0) < 0.1 && blackFraction(f, 14) > 0.6, '黒い膜が育っていない');
  // 厚みは決して負にならず、有限。
  for (let i = 0; i < 200; i++) {
    const d = thickness(f, Math.random(), Math.random(), Math.random() * 16);
    assert.ok(d >= 0 && Number.isFinite(d), `厚みが異常: ${d}`);
  }
});

test('絵：バッファは正しい形・不透明、決定的で、彩り（彩度）が立つ', () => {
  const scale = buildScale(), f = makeFilm('umi'), W = 40, H = 30;
  const a = renderRGBA(f, scale, W, H, 1.5), b = renderRGBA(f, scale, W, H, 1.5);
  assert.equal(a.length, W * H * 4);
  for (let i = 3; i < a.length; i += 4) assert.equal(a[i], 255);     // すべて不透明
  for (let i = 0; i < a.length; i++) assert.equal(a[i], b[i]);        // 決定的
  // 本物の虹なら、どこかに濃い彩度が立つ。
  const v = vitality(f, scale, 1.5);
  assert.ok(v.maxChroma > 0.4, `彩度が乏しい（虹が立たない）: ${v.maxChroma}`);
});
