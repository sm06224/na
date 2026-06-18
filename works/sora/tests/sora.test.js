import test from 'node:test';
import assert from 'node:assert/strict';
import { hashSeed, mulberry32 } from '../js/core/rng.js';
import {
  rotate, project, makeStars, wrapZ, plasma, tunnel, sphere, STAR_NEAR, STAR_FAR,
} from '../js/core/space.js';
import { SCENES, TOTAL, FADE, sceneAt, intensityAt } from '../js/core/director.js';
import {
  BPM, STEP, STEPS_PER_BAR, midiToHz, stepAt, notesAtStep, leadIsPentatonic, stepsInWindow,
} from '../js/core/music.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

/* ---------------- 乱数 ---------------- */
test('乱数：決定的、0..1、種で変わる', () => {
  const a = mulberry32(hashSeed('x')), b = mulberry32(hashSeed('x'));
  for (let i = 0; i < 100; i++) { const v = a(); assert.ok(v >= 0 && v < 1); assert.equal(v, b()); }
  assert.notEqual(hashSeed('x'), hashSeed('y'));
});

/* ---------------- 宇宙の数学 ---------------- */
test('回転：長さを保つ（剛体）', () => {
  for (const [x, y, z] of [[1, 2, 3], [-4, 0.5, 2], [0, 0, 5]]) {
    const [a, b, c] = rotate(x, y, z, 0.6, -1.2, 2.1);
    assert.ok(near(Math.hypot(a, b, c), Math.hypot(x, y, z), 1e-9));
  }
});

test('投影：前方は有限の画面座標、背後は null、近いほど大きい', () => {
  assert.equal(project(1, 1, -3), null, '背後は描かない');
  assert.equal(project(0, 0, 0), null, '面上も描かない');
  const far = project(10, 0, 200), nearp = project(10, 0, 50);
  assert.ok(far && nearp);
  assert.ok(Number.isFinite(far.x) && Number.isFinite(far.y));
  assert.ok(nearp.scale > far.scale, '近い星ほど大きい');
});

test('星空：決定的に撒かれ、巻き戻しは near..far に収まる', () => {
  const s1 = makeStars(200, 'demo'), s2 = makeStars(200, 'demo');
  assert.deepEqual(s1, s2);
  for (const z of [-5, 0.2, STAR_NEAR - 1, STAR_FAR + 50, 12345.6]) {
    const w = wrapZ(z);
    assert.ok(w >= STAR_NEAR && w < STAR_FAR, `巻き戻しが範囲外 ${w}`);
  }
});

test('プラズマ：いつでも 0..1 に収まる', () => {
  for (let i = 0; i < 500; i++) {
    const x = (i % 20) - 10, y = ((i * 7) % 30) - 15, t = i * 0.13;
    const v = plasma(x, y, t);
    assert.ok(v >= 0 && v <= 1, `プラズマが範囲外 ${v}`);
  }
});

test('トンネル：中心の陰は 0、外ほど明るく 1 まで、巻きは -1..1', () => {
  const c = tunnel(0.0001, 0.0001, 0.3);
  assert.ok(c.shade >= 0 && c.shade <= 1);
  const e = tunnel(2, 0, 0.3);
  assert.ok(e.shade === 1, '縁は最大の明るさ');
  for (const [nx, ny] of [[1, 0], [-1, 1], [0.3, -0.7]]) {
    const r = tunnel(nx, ny, 0.5);
    assert.ok(r.u >= -1 && r.u <= 1, '巻きは -1..1');
  }
});

test('球：点は単位球面の上（半径 1）', () => {
  const pts = sphere(300);
  assert.equal(pts.length, 300);
  for (const [x, y, z] of pts) assert.ok(near(Math.hypot(x, y, z), 1, 1e-6), '単位球から外れた');
});

/* ---------------- 演出表 ---------------- */
test('演出：全時間を隙間なく覆い、場面は妥当・ループする', () => {
  assert.ok(TOTAL > 0);
  assert.equal(TOTAL, SCENES.reduce((a, s) => a + s.dur, 0));
  for (let t = 0; t < TOTAL; t += 0.37) {
    const s = sceneAt(t);
    assert.ok(s.i >= 0 && s.i < SCENES.length);
    assert.ok(s.local >= 0 && s.local <= s.dur + 1e-9);
    assert.ok(s.u >= 0 && s.u <= 1 + 1e-9);
  }
  // ループ：t と t+TOTAL は同じ場面
  assert.equal(sceneAt(5).id, sceneAt(5 + TOTAL).id);
  // 溶暗は変わり目の近くだけ
  const mid = sceneAt(SCENES[0].dur / 2);
  assert.equal(mid.blend, null, '場面の真ん中で溶暗は起きない');
  const edge = sceneAt(SCENES[0].dur - FADE / 2);
  assert.ok(edge.blend && edge.blend.k > 0 && edge.blend.k <= 1, '変わり目で溶暗する');
});

test('盛り上がり：0..1 に収まる', () => {
  for (let t = 0; t < TOTAL; t += 0.5) {
    const v = intensityAt(t);
    assert.ok(v >= 0 && v <= 1, `盛り上がりが範囲外 ${v}`);
  }
});

/* ---------------- 音楽 ---------------- */
test('音楽：刻みの長さは BPM どおり', () => {
  assert.ok(near(STEP, 60 / BPM / 4));
  assert.equal(stepAt(STEP * 5 + 0.001), 5);
});

test('音楽：トラックの音は正の周波数、決定的、1小節で繰り返す', () => {
  for (let s = 0; s < 64; s++) {
    const n = notesAtStep(s);
    for (const f of [n.bass, n.lead]) if (f != null) assert.ok(Number.isFinite(f) && f > 0);
    if (n.pad) for (const f of n.pad) assert.ok(f > 0);
  }
  // 打楽器は 1 小節周期
  for (let s = 0; s < STEPS_PER_BAR; s++) {
    assert.equal(notesAtStep(s).kick, notesAtStep(s + STEPS_PER_BAR).kick);
    assert.equal(notesAtStep(s).hat, notesAtStep(s + STEPS_PER_BAR).hat);
  }
  // 決定的
  assert.deepEqual(notesAtStep(13), notesAtStep(13));
});

test('音楽：リードは五音音階から外れない（濁らない）', () => {
  for (let s = 0; s < 256; s++) assert.ok(leadIsPentatonic(s), `刻み ${s} で五音から外れた`);
});

test('音楽：時間窓の刻みは窓の中・昇順', () => {
  const w = stepsInWindow(1.0, 1.5);
  for (let i = 0; i < w.length; i++) {
    assert.ok(w[i].at >= 1.0 && w[i].at < 1.5);
    if (i > 0) assert.ok(w[i].step === w[i - 1].step + 1, '刻みは連番');
  }
});
