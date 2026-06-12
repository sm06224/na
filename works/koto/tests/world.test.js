import { test } from 'node:test';
import assert from 'node:assert/strict';

import { World } from '../js/core/world.js';
import { EV } from '../js/core/chronicle.js';
import { CONCEPT_IDS } from '../js/core/meaning.js';

const run = (w, years) => { for (let i = 0; i < years; i++) w.step(); };

test('創世：ひと群が、言葉を持たずに現れる', () => {
  const w = new World(1);
  assert.equal(w.aliveDemes().length, 1);
  assert.equal(w.demes[0].lexicon.size(), 0, 'はじめは無言');
  assert.equal(w.chronicle.entries[0].kind, EV.GENESIS);
});

test('言葉は無から生まれる（最初の単語の発生）', () => {
  const w = new World(7);
  run(w, 60);
  const d = w.demes[0];
  assert.ok(d.lexicon.size() > 0, '語彙が生まれている');
  assert.ok(w.chronicle.byKind(EV.BIRTH).length > 0, '新語の発生が記録されている');
});

test('300 年で、語彙が定着し、理解度が育つ', () => {
  const w = new World(20260612);
  run(w, 300);
  // 主要概念のいくつかに優勢語がある
  const d = w.aliveDemes()[0];
  let named = 0;
  for (const cid of CONCEPT_IDS) if (d.lexicon.dominant(cid)) named++;
  assert.ok(named >= 4, `${named} 概念に名がついている`);
  const last = w.history[w.history.length - 1];
  assert.ok(last.comprehension > 0.3, `理解度 ${last.comprehension.toFixed(2)}`);
});

test('群は分裂し、方言が生まれ、互いに通じにくくなる', () => {
  const w = new World(99);
  run(w, 600);
  assert.ok(w.demes.length >= 2, '分裂が起きた');
  assert.ok(w.chronicle.byKind(EV.SPLIT).length > 0, '分岐が記録されている');
  // 親子の方言間で、相互理解度が 1 未満（=訛った）になっている組がある
  const alive = w.aliveDemes();
  let diverged = false;
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      if (w.intelligibility(alive[i], alive[j]) < 0.95) diverged = true;
    }
  }
  assert.ok(diverged, '方言間に差が生じている');
});

test('長い歴史には、意味の変化・死語が刻まれる', () => {
  const w = new World(2026);
  run(w, 800);
  assert.ok(w.chronicle.byKind(EV.SHIFT).length > 0, '意味のずれが起きた');
  assert.ok(w.chronicle.byKind(EV.BIRTH).length > 10, '多くの語が生まれた');
  // 語の死（死語 or 言語の死）が起きている
  const deaths = w.chronicle.byKind(EV.DEATH).length + w.chronicle.byKind(EV.DEMEDEATH).length;
  assert.ok(deaths > 0, '言葉の死が記録されている');
});

test('決定性：同じ種は同じ言語史を書く', () => {
  const a = new World(31415);
  const b = new World(31415);
  run(a, 250);
  run(b, 250);
  assert.equal(a.demes.length, b.demes.length);
  assert.equal(a.chronicle.entries.length, b.chronicle.entries.length);
  for (let i = 0; i < a.chronicle.entries.length; i++) {
    assert.equal(a.chronicle.entries[i].text, b.chronicle.entries[i].text);
  }
});

test('種が違えば言語史も違う', () => {
  const a = new World(1), b = new World(2);
  run(a, 150); run(b, 150);
  const ta = a.chronicle.entries.map(e => e.text).join('|');
  const tb = b.chronicle.entries.map(e => e.text).join('|');
  assert.notEqual(ta, tb);
});

test('健全性：600 年流しても壊れない', () => {
  const w = new World(555);
  run(w, 600);
  for (const d of w.demes) {
    assert.ok(Number.isFinite(d.pop) && d.pop >= 0);
    assert.ok(d.x >= 0 && d.x <= 200 && d.y >= 0 && d.y <= 200);
    for (const e of d.lexicon.allEntries()) {
      assert.ok(e.form.length >= 1);
      assert.ok(Number.isFinite(e.strength) && e.strength >= 0);
    }
  }
  assert.ok(w.aliveDemes().length >= 1, '言葉は生き残る');
});

test('世界は JSON に畳んで開き直せ、言語史は続けられる', () => {
  const w = new World(777);
  run(w, 200);
  const json = JSON.stringify(w.serialize());
  const w2 = World.deserialize(JSON.parse(json));
  assert.equal(w2.year, w.year);
  assert.equal(w2.demes.length, w.demes.length);
  // 語彙が保たれている
  const a0 = w.demes[0].lexicon.size();
  const b0 = w2.demes[0].lexicon.size();
  assert.equal(a0, b0);
  run(w2, 50);
  assert.equal(w2.year, w.year + 50);
  assert.ok(w2.aliveDemes().length >= 1);
});

test('世界事件は概念の必要度を一時的に押し上げる', () => {
  const w = new World(42);
  let sawEvent = false;
  for (let i = 0; i < 400 && !sawEvent; i++) {
    w.step();
    if (w.event) {
      sawEvent = true;
      const c = w.event.concept;
      // 事件中はその概念の relevance が基礎値を上回る
      assert.ok(w.relevance[c] > 1);
    }
  }
  assert.ok(sawEvent, '400 年のうちに世界事件が起きる');
});
