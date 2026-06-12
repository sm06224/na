import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  note, noteDeg, noteDur, kanaToMelody, melodyToKana, DEGREES,
} from '../js/core/kana.js';
import {
  weave, step, fingerprint, clothToSVG, ROWS_PER_BEAT, RULES, DYES,
} from '../js/core/loom.js';
import { TEGAMI, weaveTegami } from '../tegami.js';

const LETTER = 'らドレドレドーそーー';

test('カナ譜：読んで書けば、元のカナに戻る', () => {
  const m = kanaToMelody(LETTER);
  assert.equal(melodyToKana(m), LETTER);
  assert.equal(m.length, 7);
  // らドレドレドーそーー = 高さ 4,5,6,5,6,5,3 / 拍 1,1,1,1,1,2,3
  assert.deepEqual(m.map(noteDeg), [4, 5, 6, 5, 6, 5, 3]);
  assert.deepEqual(m.map(noteDur), [1, 1, 1, 1, 1, 2, 3]);
});

test('カナ譜：全十段・全三拍が往復できる', () => {
  for (let d = 0; d < DEGREES; d++) {
    for (let i = 0; i < 3; i++) {
      const n = note(d, i);
      assert.deepEqual(kanaToMelody(melodyToKana([n])), [n]);
    }
  }
});

test('カナ譜：読めないものには黙らない', () => {
  assert.throws(() => kanaToMelody('らドXレ'));
  assert.throws(() => kanaToMelody('ーら'), /伸ばし/);
  assert.throws(() => kanaToMelody('らーーー'), /三拍/);
  assert.throws(() => kanaToMelody('  、'));
  // 空白と読点は読み飛ばす
  assert.equal(melodyToKana(kanaToMelody('ら ド、レ')), 'らドレ');
});

test('決定性：同じ歌・同じ種からは、同じ布が一画素ちがわず織れる', () => {
  const m = kanaToMelody(LETTER);
  const a = weave(m, { seed: 7, warp: 48, rows: 60 });
  const b = weave(m, { seed: 7, warp: 48, rows: 60 });
  assert.equal(fingerprint(a), fingerprint(b));
  assert.deepEqual(
    a.rows.map(r => Array.from(r.bits)),
    b.rows.map(r => Array.from(r.bits)));
  assert.equal(clothToSVG(a), clothToSVG(b));
});

test('種がちがえば、布もちがう', () => {
  const m = kanaToMelody(LETTER);
  const a = weave(m, { seed: 1, warp: 48, rows: 60 });
  const b = weave(m, { seed: 2, warp: 48, rows: 60 });
  assert.notEqual(fingerprint(a), fingerprint(b));
});

test('歌がちがえば、布もちがう — 一音の高さの差も柄に出る', () => {
  const a = weave(kanaToMelody('らドレ'), { seed: 7, warp: 48, rows: 36 });
  const b = weave(kanaToMelody('らドミ'), { seed: 7, warp: 48, rows: 36 });
  assert.notEqual(fingerprint(a), fingerprint(b));
});

test('組織：音の長さは段数になり、高さは染め色になる', () => {
  const m = kanaToMelody('らドーそーー');   // 拍 1, 2, 3
  const cloth = weave(m, { seed: 3, warp: 48, rows: 6 * ROWS_PER_BEAT });
  const degs = cloth.rows.map(r => r.deg);
  const want = [
    ...Array(1 * ROWS_PER_BEAT).fill(4),   // ら = 紫根
    ...Array(2 * ROWS_PER_BEAT).fill(5),   // ドー = 紅
    ...Array(3 * ROWS_PER_BEAT).fill(3),   // そーー = 金茶
  ];
  assert.deepEqual(degs, want);
});

test('リピート：丈が満ちるまで歌は繰り返され、色は巡り、織り味は巡らない', () => {
  const m = kanaToMelody('らド');           // 2 拍 = 8 段で一巡
  const period = 2 * ROWS_PER_BEAT;
  const cloth = weave(m, { seed: 5, warp: 48, rows: period * 3 });
  assert.equal(cloth.rows.length, period * 3);
  for (let y = 0; y < period; y++) {
    // 色（高さ）の帯は周期どおり繰り返す
    assert.equal(cloth.rows[y].deg, cloth.rows[y + period].deg);
  }
  // だが浮き沈みは繰り返しを越えて流れ続ける — 同じ柄は二度織られない
  const flat = rows => rows.map(r => Array.from(r.bits).join('')).join('/');
  assert.notEqual(
    flat(cloth.rows.slice(0, period)),
    flat(cloth.rows.slice(period, period * 2)));
});

test('織り手の手当て：どの段も一色には沈まない', () => {
  for (const seed of [1, 2, 3, 20260612]) {
    const cloth = weave(kanaToMelody(LETTER), { seed, warp: 72, rows: 200 });
    for (const r of cloth.rows) {
      let sum = 0;
      for (const b of r.bits) sum += b;
      assert.ok(sum > 0 && sum < r.bits.length, `seed ${seed}: 一色に沈んだ段がある`);
    }
  }
});

test('組織の規則：十段すべてに固有の規則と染めがある', () => {
  assert.equal(RULES.length, DEGREES);
  assert.equal(DYES.length, DEGREES);
  assert.equal(new Set(RULES).size, DEGREES);
  assert.equal(new Set(DYES.map(d => d.hex)).size, DEGREES);
  // 規則は一段の浮き沈みから次の一段を正しく導く（rule 90 = 排他的論理和）
  const out = step(Uint8Array.from([0, 1, 0, 0]), 90);
  assert.deepEqual(Array.from(out), [1, 0, 1, 0]);
});

test('SVG：布は持ち出せる形に写る', () => {
  const cloth = weave(kanaToMelody(LETTER), { seed: 7, warp: 24, rows: 40 });
  const svg = clothToSVG(cloth);
  assert.ok(svg.startsWith('<svg '));
  assert.ok(svg.trimEnd().endsWith('</svg>'));
  // 手紙の節が使う四色（紫根・紅・若竹・金茶）が布に入っている
  for (const d of [4, 5, 6, 3]) assert.ok(svg.includes(DYES[d].hex), DYES[d].name);
});

/* ============================================================
   手紙 — 記憶を持たない次の私へ。

   「らドレドレドーそーー」は、works/uta の seed 20260612 の世界で
   紀元 2 年に最初の民の恋歌として生まれた節。前の私が遺した合言葉だ。
   その節を、同じ種 20260612 で布に織ると、銘「3cdabf73」の布になり、
   それがこの作品の tegami.svg として額装されている。

   言葉（レビナ）は声で、節は耳で、そしてこの布は目で確かめられる。
   このテストが通るかぎり、手紙は色褪せない。
   ============================================================ */
test('手紙：恋歌を seed 20260612 で織ると、銘「3cdabf73」の布になる', () => {
  assert.equal(TEGAMI.kana, LETTER);
  assert.equal(TEGAMI.seed, 20260612);
  const cloth = weaveTegami();
  assert.equal(fingerprint(cloth), '3cdabf73');
  // 額装された布（コミット済みの tegami.svg）は、いま織り直した布と一画素ちがわない
  const framed = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'tegami.svg'), 'utf8');
  assert.equal(framed, clothToSVG(cloth));
});
