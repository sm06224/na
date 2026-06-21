import test from 'node:test';
import assert from 'node:assert/strict';
import { prove, toHex, readName, sigil, tune, akashi, PENTA, TUNE_ROOT, TUNE_LEN, SIGIL_N } from '../js/core/akashi.js';

const popcount = x => { x = x >>> 0; let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; };
const hamming = (a, b) => { let d = 0; for (let i = 0; i < 8; i++) d += popcount((a[i] ^ b[i]) >>> 0); return d; };
// 小さな決定的乱数（テスト用の語を作る）
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test('証明：決定的——同じ入力からは寸分たがわぬ指紋', () => {
  assert.deepEqual(Array.from(prove('六花')), Array.from(prove('六花')));
  assert.equal(toHex(prove('abc')).length, 64);
  assert.deepEqual(akashi('x'), akashi('x'));
});

test('証明：無にも証がある（空文字でも安定・非ゼロ）', () => {
  const d = prove('');
  assert.deepEqual(Array.from(d), Array.from(prove('')));
  assert.ok(d.some(x => x !== 0), '無の指紋がすべて0ではいけない');
  assert.equal(toHex(d).length, 64);
});

test('証明：別の入力は別の指紋（衝突なし・小さな corpus）', () => {
  const seen = new Map();
  const r = rng(20260621);
  for (let i = 0; i < 4000; i++) {
    let s = ''; const n = 1 + (r() * 12 | 0);
    for (let j = 0; j < n; j++) s += String.fromCharCode(33 + (r() * 90 | 0));
    const hex = toHex(prove(s));
    if (seen.has(hex) && seen.get(hex) !== s) assert.fail(`衝突: ${seen.get(hex)} と ${s}`);
    seen.set(hex, s);
  }
});

test('証明：雪崩——一文字変えれば、半分のビットが裏返る', () => {
  const r = rng(7);
  let sum = 0, cnt = 0;
  for (let i = 0; i < 600; i++) {
    let s = ''; const n = 3 + (r() * 9 | 0);
    for (let j = 0; j < n; j++) s += String.fromCharCode(97 + (r() * 26 | 0));
    const arr = s.split('');
    const p = r() * arr.length | 0;
    arr[p] = String.fromCharCode(arr[p].charCodeAt(0) ^ 1);   // 一文字を1ビット変える
    sum += hamming(prove(s), prove(arr.join(''))); cnt++;
  }
  const mean = sum / cnt;                                     // 256bit の理想は 128
  assert.ok(mean > 108 && mean < 148, `雪崩が弱い/偏る (平均 ${mean.toFixed(1)} bit)`);
});

test('読み：決定的・ラテン字のみ・2〜4音ぶんの長さ', () => {
  assert.equal(readName(prove('a')), readName(prove('a')));
  const nm = readName(prove('まこと'));
  assert.match(nm, /^[A-Z][a-z]+$/);
  assert.ok(nm.length >= 4 && nm.length <= 9);
});

test('紋章：左右対称・決定的・入力で変わる', () => {
  const s = sigil(prove('crest'));
  assert.equal(s.n, SIGIL_N);
  for (let r = 0; r < s.n; r++) for (let c = 0; c < s.n; c++) assert.equal(s.cells[r][c], s.cells[r][s.n - 1 - c], '左右非対称');
  assert.deepEqual(sigil(prove('crest')), sigil(prove('crest')));
  assert.notDeepEqual(sigil(prove('a')).cells, sigil(prove('b')).cells);
  assert.ok(s.hue >= 0 && s.hue < 360);
});

test('旋律：八音・すべて五音音階・根は固定（重ねても濁らない）・決定的', () => {
  const t = tune(prove('song'));
  assert.equal(t.length, TUNE_LEN);
  const set = new Set(PENTA);
  for (const note of t) {
    assert.ok(set.has(((note.midi - TUNE_ROOT) % 12 + 12) % 12), '五音の外');
    assert.ok(note.dur > 0);
  }
  assert.deepEqual(tune(prove('song')), tune(prove('song')));
});

test('証ぜんぶ：入力を保ち、指紋・読み・紋章・旋律がそろう', () => {
  const a = akashi('証');
  assert.equal(a.input, '証');
  assert.equal(a.hex.length, 64);
  assert.ok(a.name && a.sigil && a.tune.length === TUNE_LEN);
});
