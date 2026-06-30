/* ============================================================
   斑 のヘッドレス検証 — 絵は見えなくても、模様の物理は確かめられる。
   ラプラシアンは一様な地を滲ませても一様か（重みの総和は 0 か）。
   同じ種からは寸分たがわぬ同じ肌か。地は [0,1] に留まり破綻しないか。
   無地から、模様はほんとうに立つか（分散は育つか）。
   そして二つの数 (f,k) は、約束どおり斑・縞・迷路・孔を生むか。
   美しさを物理に保証させる。ここはその保証書。
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeField, advance, grow, step, laplacian, biomeOf, BIOMES, Du, Dv } from '../js/core/grayscott.js';
import { measure, classify, nameOf, identify } from '../js/core/classify.js';
import { makePalette, colorOf, renderRGBA } from '../js/core/render.js';

const variance = (arr) => {
  let s = 0, q = 0; for (const v of arr) { s += v; q += v * v; }
  const m = s / arr.length; return q / arr.length - m * m;
};
const hashField = (arr) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < arr.length; i++) { h ^= (arr[i] * 1e6) | 0; h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};

test('ラプラシアン：一様な地はいくら滲んでも一様（重みの総和は 0）', () => {
  const N = 16, a = new Float32Array(N * N).fill(0.37);
  for (const [x, y] of [[0, 0], [5, 8], [15, 15], [3, 0]])
    assert.ok(Math.abs(laplacian(a, N, x, y)) < 1e-6, `一様な地に滲みが出た @${x},${y}`);
});

test('ラプラシアン：ひと粒の山は、頂で負・周りで正、トーラス全体の総和は 0', () => {
  const N = 16, a = new Float32Array(N * N);
  a[5 * N + 5] = 1;                                   // (5,5) にひと粒だけ立てる
  assert.ok(laplacian(a, N, 5, 5) < 0, '頂が凹んでいない');
  assert.ok(laplacian(a, N, 6, 5) > 0, '隣が盛り上がっていない');
  let sum = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) sum += laplacian(a, N, x, y);
  assert.ok(Math.abs(sum) < 1e-6, `総和が 0 でない: ${sum}`); // 拡散は何も生まず何も消さない
});

test('拡散率：U は V より速く滲む（斑が立つための非対称）', () => {
  assert.ok(Du > Dv, 'Du > Dv でないと模様は立たない（チューリング不安定の要）');
});

test('決定的：同じ種・同じ刻みからは、寸分たがわぬ同じ肌', () => {
  const a = grow('madara-同じ種', 1500, { N: 48 });
  const b = grow('madara-同じ種', 1500, { N: 48 });
  assert.equal(hashField(a.V), hashField(b.V), 'V がずれた');
  assert.equal(hashField(a.U), hashField(b.U), 'U がずれた');
});

test('決定的：ちがう種からは、ちがう肌', () => {
  const a = grow('alpha', 1500, { N: 48 });
  const b = grow('omega', 1500, { N: 48 });
  assert.notEqual(hashField(a.V), hashField(b.V), '別の種なのに同じ肌になった');
});

test('安定：何刻み進めても、地は [0,1] に留まり、破綻（NaN）しない', () => {
  const F = grow('stability', 3000, { N: 48 });
  for (let i = 0; i < F.U.length; i++) {
    assert.ok(Number.isFinite(F.U[i]) && Number.isFinite(F.V[i]), `NaN/∞ が出た @${i}`);
    assert.ok(F.U[i] >= 0 && F.U[i] <= 1, `U が範囲外: ${F.U[i]}`);
    assert.ok(F.V[i] >= 0 && F.V[i] <= 1, `V が範囲外: ${F.V[i]}`);
  }
});

test('不動点：V の種火がなければ、無地（U=1, V=0）は無地のまま', () => {
  const F = makeField('flat', { N: 24 });
  F.U.fill(1); F.V.fill(0);                            // 完全な無地に均す（種火を消す）
  advance(F, 200);
  assert.ok(variance(F.V) < 1e-9, '無地から勝手に模様が湧いた');
  for (let i = 0; i < F.V.length; i++) assert.ok(F.V[i] < 1e-6 && Math.abs(F.U[i] - 1) < 1e-6);
});

test('創発：ひと粒の種火が、肌いちめんの模様に広がる', () => {
  const active = (V) => { let c = 0; for (const v of V) if (v > 0.1) c++; return c; };
  const F = makeField('emerge', { N: 64 }); F.f = 0.034; F.k = 0.059; // 迷路の土地
  const a0 = active(F.V), v0 = variance(F.V);
  advance(F, 4000);
  const a1 = active(F.V), v1 = variance(F.V);
  assert.ok(a1 > a0 * 3, `模様が広がっていない（活きた細胞 ${a0} → ${a1}）`); // 種火を遠く越えて
  assert.ok(a1 / (64 * 64) > 0.3, '肌の大半が無地のまま');
  assert.ok(v1 > v0, '起伏が育っていない');
});

// (f,k) は、約束どおりの肌を生むか。種をまたいで確かめる（位相空間の地図の要所）。
const REGIMES = [
  ['spots',   0.026, 0.0615],
  ['stripes', 0.039, 0.0620],
  ['maze',    0.034, 0.0590],
  ['holes',   0.050, 0.0600],
];
for (const [want, f, k] of REGIMES) {
  test(`位相空間：f=${f} k=${k} は「${want}」の肌を生む（種をまたいで）`, () => {
    for (const seed of ['t1', 't2', 't3', 't4']) {
      const F = makeField(seed, { N: 64 }); F.f = f; F.k = k; advance(F, 4000);
      assert.equal(classify(F), want, `${seed}: ${want} のはずが ${classify(F)}`);
    }
  });
}

test('計測：斑は島が多く覆い率が低い／孔は地が満ちて孔が多い', () => {
  const spots = makeField('m-sp', { N: 64 }); spots.f = 0.026; spots.k = 0.0615; advance(spots, 4000);
  const holes = makeField('m-ho', { N: 64 }); holes.f = 0.050; holes.k = 0.0600; advance(holes, 4000);
  const ms = measure(spots), mh = measure(holes);
  assert.ok(ms.coverage < 0.25 && ms.fg >= 6, `斑が斑らしくない: ${JSON.stringify(ms)}`);
  assert.ok(mh.coverage > 0.55 && mh.bg >= 3, `孔が孔らしくない: ${JSON.stringify(mh)}`);
});

test('名づけ：肌の形に偽りなし（豹は斑から、虎は縞から）', () => {
  for (const klass of ['spots', 'stripes', 'maze', 'holes', 'void']) {
    const n = nameOf('any-seed', klass);
    assert.equal(n.coat, klass, '肌の種別が食い違う');
    assert.ok(typeof n.kana === 'string' && n.kana.length > 0, '名がない');
    assert.ok(typeof n.note === 'string' && n.note.length > 0, '由来がない');
  }
  // 決定的：同じ種・同じ肌からは、同じ獣。
  assert.equal(nameOf('zzz', 'spots').en, nameOf('zzz', 'spots').en);
});

test('素性：identify は計測・分類・名を矛盾なくまとめる', () => {
  const F = grow('identity', 3000, { N: 56 });
  const id = identify(F);
  assert.equal(id.coat, classify(F), 'coat が分類とずれた');
  assert.equal(id.kana, nameOf(F.seed, id.coat).kana, '名が肌とずれた');
  assert.ok(id.coverage >= 0 && id.coverage <= 1, '覆い率が範囲外');
});

test('バイオーム：種から決まる (f,k) は、生きている帯に収まる', () => {
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    const { biome, f, k } = biomeOf(seed);
    assert.ok(BIOMES.some((b) => b.key === biome), '知らない土地');
    assert.ok(f > 0.01 && f < 0.07, `f が帯の外: ${f}`);
    assert.ok(k > 0.05 && k < 0.07, `k が帯の外: ${k}`);
  }
  // 決定的：同じ種からは同じ土地。
  assert.deepEqual(biomeOf('seed-x'), biomeOf('seed-x'));
});

test('色：パレットは種で決まり、地は地色・斑は斑色になる', () => {
  const p = makePalette('coat-color');
  assert.deepEqual(makePalette('coat-color'), p, 'パレットが種で決まっていない');
  const ground = colorOf(p, 0, 0.4);          // V=0 は地色
  const mark = colorOf(p, 0.4, 0.4);          // V=peak は斑色
  for (let c = 0; c < 3; c++) {
    assert.ok(Math.abs(ground[c] - p.ground[c]) <= 1, '地が地色になっていない');
    assert.ok(Math.abs(mark[c] - p.mark[c]) <= 1, '斑が斑色になっていない');
    assert.ok(ground[c] >= 0 && ground[c] <= 255 && mark[c] >= 0 && mark[c] <= 255, '色が範囲外');
  }
});

test('描画：RGBA バッファは N*N*4・不透明・8bit に収まる', () => {
  const F = grow('render', 1000, { N: 32 });
  const buf = renderRGBA(F, makePalette('render'));
  assert.equal(buf.length, 32 * 32 * 4, 'バッファの寸法が違う');
  for (let i = 0; i < buf.length; i += 4) {
    assert.equal(buf[i + 3], 255, '不透明でない');
    for (let c = 0; c < 3; c++) assert.ok(buf[i + c] >= 0 && buf[i + c] <= 255, '色が範囲外');
  }
});
