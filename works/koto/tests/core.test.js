import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RNG } from '../js/core/rng.js';
import {
  syl, sylC, sylV, coinWord, mutateForm, formDistance, makeProfile,
  wordToKana, wordToRoma, CONSONANTS, VOWELS,
} from '../js/core/phonology.js';
import { Lexicon, mutualIntelligibility, _resetWordId } from '../js/core/lexicon.js';
import { CONCEPT_IDS } from '../js/core/meaning.js';

/* ---------- 乱数 ---------- */
test('RNG.weighted は重みに従い、決定的', () => {
  const a = new RNG(5), b = new RNG(5);
  const counts = [0, 0, 0];
  for (let i = 0; i < 3000; i++) counts[a.weighted([1, 0, 3])]++;
  assert.equal(counts[1], 0, '重み 0 は選ばれない');
  assert.ok(counts[2] > counts[0], '重み 3 が重み 1 より多い');
  // 決定性
  for (let i = 0; i < 50; i++) assert.equal(a.next === b.next, false); // 別インスタンス
  const c = new RNG(9), d = new RNG(9);
  for (let i = 0; i < 50; i++) assert.equal(c.weighted([1, 2, 3]), d.weighted([1, 2, 3]));
});

/* ---------- 音節 ---------- */
test('音節の合成と分解は往復する', () => {
  for (let ci = 0; ci < CONSONANTS.length; ci++) {
    for (let vi = 0; vi < VOWELS.length; vi++) {
      const s = syl(ci, vi);
      assert.equal(sylC(s), ci);
      assert.equal(sylV(s), vi);
    }
  }
});

test('語形はカナとローマ字に写せる', () => {
  const w = [syl(0, 0), syl(2, 1)]; // ka, shi
  assert.equal(wordToRoma(w), 'kasi');
  assert.equal(wordToKana(w), 'カシ');
});

test('coinWord は 1〜3 音節の語を作る', () => {
  const rng = new RNG(3);
  const p = makeProfile(rng);
  for (let i = 0; i < 200; i++) {
    const w = coinWord(p, rng);
    assert.ok(w.length >= 1 && w.length <= 3);
    for (const s of w) assert.ok(s >= 0 && s < CONSONANTS.length * VOWELS.length);
  }
});

/* ---------- 音変化 ---------- */
test('mutateForm は元を壊さず、空語を作らない', () => {
  const rng = new RNG(7);
  const orig = [syl(0, 0), syl(4, 2)];
  for (let i = 0; i < 500; i++) {
    const copy = orig.slice();
    const m = mutateForm(copy, rng, 1.5);
    assert.deepEqual(copy, orig, '元配列は不変');
    assert.ok(m.length >= 1, '空にならない');
  }
});

test('音変化を重ねるほど元から遠ざかる傾向', () => {
  const rng = new RNG(11);
  let w = coinWord(makeProfile(rng), rng);
  const orig = w.slice();
  for (let i = 0; i < 40; i++) w = mutateForm(w, rng, 2);
  assert.ok(formDistance(orig, w) >= 1, '40 回の訛りで形が変わる');
});

test('formDistance は同一で 0、対称', () => {
  const a = [syl(0, 0), syl(1, 1)];
  const b = [syl(0, 0), syl(1, 2)];
  assert.equal(formDistance(a, a), 0);
  assert.equal(formDistance(a, b), formDistance(b, a));
  assert.ok(formDistance(a, b) > 0);
});

/* ---------- 語彙 ---------- */
test('Lexicon: 造語・選択・強化・減衰・死語', () => {
  _resetWordId(1);
  const lex = new Lexicon();
  const rng = new RNG(2);
  const form = [syl(0, 0)];
  const e = lex.coin('food', form, 1);
  assert.ok(e);
  assert.equal(lex.coin('food', form.slice(), 1), null, '同形は二重登録されない');
  lex.reinforce(e, 2, 5);
  assert.ok(e.strength > 1);
  assert.equal(lex.dominant('food'), e);
  // 減衰で死語に
  let dead = [];
  for (let i = 0; i < 2000 && lex.size() > 0; i++) {
    dead = dead.concat(lex.decay(0.05, 100 + i));
  }
  assert.equal(lex.size(), 0);
  assert.ok(dead.some(d => d.entry.wid === e.wid));
});

test('chooseForm は強い語を好むが、弱い語にも機会を残す', () => {
  _resetWordId(1);
  const lex = new Lexicon();
  const rng = new RNG(4);
  const strong = lex.coin('food', [syl(0, 0)], 1);
  const weak = lex.coin('food', [syl(1, 1)], 1);
  lex.reinforce(strong, 5, 1);
  let s = 0, wk = 0;
  for (let i = 0; i < 2000; i++) {
    const e = lex.chooseForm('food', rng);
    if (e === strong) s++; else wk++;
  }
  assert.ok(s > wk * 3, '強い語が多数派');
  assert.ok(wk > 0, '弱い語も時々選ばれる');
});

test('mutualIntelligibility: 同一語彙は 1、無関係は低い', () => {
  _resetWordId(1);
  const a = new Lexicon();
  for (const cid of CONCEPT_IDS) a.coin(cid, [syl(0, 0), syl(1, 1)], 1);
  const b = a.clone();
  assert.equal(mutualIntelligibility(a, b), 1);
  // b を大きく変える
  const c = new Lexicon();
  for (const cid of CONCEPT_IDS) c.coin(cid, [syl(7, 4), syl(9, 3), syl(5, 2)], 1);
  assert.ok(mutualIntelligibility(a, c) < 0.5);
});
