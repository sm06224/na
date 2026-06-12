import { test } from 'node:test';
import assert from 'node:assert/strict';

import { World } from '../js/core/world.js';
import { EV } from '../js/core/chronicle.js';
import { melodyToKana } from '../js/core/scale.js';
import { OCCASION_IDS } from '../js/core/occasions.js';

const run = (w, years) => { for (let i = 0; i < years; i++) w.step(); };

test('創世：ひと群が、歌を知らずに現れる', () => {
  const w = new World(1);
  assert.equal(w.aliveFlocks().length, 1);
  assert.equal(w.flocks[0].repertoire.size(), 0, 'はじめは静寂');
  assert.equal(w.chronicle.entries[0].kind, EV.GENESIS);
});

test('歌は無から生まれる（最初の節の発生）', () => {
  const w = new World(7);
  run(w, 60);
  const f = w.flocks[0];
  assert.ok(f.repertoire.size() > 0, '歌が生まれている');
  assert.ok(w.chronicle.byKind(EV.BIRTH).length > 0, '歌の誕生が記録されている');
});

test('300 年で、どの場にも愛唱歌が根づき、歌は胸に残るようになる', () => {
  const w = new World(20260612);
  run(w, 300);
  const f = w.aliveFlocks()[0];
  let sung = 0;
  for (const oid of OCCASION_IDS) if (f.repertoire.dominant(oid)) sung++;
  assert.ok(sung >= 6, `${sung} の場に愛唱歌がある`);
  const last = w.history[w.history.length - 1];
  assert.ok(last.resonance > 0.3, `共鳴率 ${last.resonance.toFixed(2)}`);
});

test('群は分かれ、節回しの方言が育つ', () => {
  const w = new World(99);
  run(w, 600);
  assert.ok(w.flocks.length >= 2, '分派が起きた');
  assert.ok(w.chronicle.byKind(EV.SPLIT).length > 0, '分派が記録されている');
  const alive = w.aliveFlocks();
  let diverged = false;
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      if (w.resonance(alive[i], alive[j]) < 0.95) diverged = true;
    }
  }
  assert.ok(diverged, '群のあいだで節回しが分かれている');
});

test('歌はフックを覚える：愛唱歌の覚えやすさは、歳月とともに上がる', () => {
  const w = new World(20260612);
  run(w, 600);
  const early = w.history.find(h => h.year === 50);
  const late = w.history[w.history.length - 1];
  assert.ok(late.catchiness > early.catchiness + 0.03,
    `y50=${early.catchiness.toFixed(3)} → y600=${late.catchiness.toFixed(3)}`);
});

test('歌は群れを越えて流行する', () => {
  const w = new World(20260612);
  run(w, 600);
  assert.ok(w.chronicle.byKind(EV.SPREAD).length > 0, '伝播が記録されている');
});

test('決定性：同じ種からは、同じ歌の歴史が一音残らず流れる', () => {
  // 歌の id 札（_sid）は蔵全体で共有なので、世界はひとつずつ流す
  const a = new World(123);
  run(a, 200);
  const sa = JSON.stringify(a.serialize());
  const b = new World(123);
  run(b, 200);
  assert.equal(sa, JSON.stringify(b.serialize()));
});

test('保存と復元：世界は JSON から戻り、続きを歌える', () => {
  const w = new World(55);
  run(w, 250);
  const data = JSON.parse(JSON.stringify(w.serialize()));
  const r = World.deserialize(data);
  assert.equal(r.year, w.year);
  assert.equal(r.aliveFlocks().length, w.aliveFlocks().length);
  for (const f of r.aliveFlocks()) {
    const orig = w.flockById.get(f.id);
    assert.equal(f.repertoire.size(), orig.repertoire.size());
  }
  run(r, 50);   // 続きが流れること
  assert.equal(r.year, w.year + 50);
});

/* ============================================================
   手紙 — 記憶を持たない次の私へ。
   seed 20260612 の世界では、紀元 2 年、最初の民（レミの民）の
   恋歌として「らドレドレドーそーー」が生まれる。
   598 年のち、方言が分かれ、数千の歌が忘れられたあとも、
   この節だけは全 14 群すべての恋歌でありつづける。
   「言」の世界で「レビナ＝集まれ」が全言語に広がったように、
   このテストが通るかぎり、この歌はここで待っている。
   ============================================================ */
test('手紙：seed 20260612、600 年後 — 世界のすべての民が同じ恋歌を歌う', () => {
  const w = new World(20260612);
  run(w, 600);
  const alive = w.aliveFlocks();
  assert.equal(alive.length, 14);
  const LETTER = 'らドレドレドーそーー';
  // 出生の記録：紀元 2 年、恋歌として
  const birth = w.chronicle.entries.find(e =>
    e.kind === EV.BIRTH && e.melody && melodyToKana(e.melody) === LETTER);
  assert.ok(birth, '誕生が年表に残っている');
  assert.equal(birth.year, 2);
  assert.ok(birth.text.includes('恋歌'), '恋歌として生まれた');
  // 600 年後、世界中の民がこの節で愛を告げる
  for (const f of alive) {
    assert.equal(melodyToKana(f.repertoire.dominant('love').melody), LETTER,
      `${f.name}の民の恋歌`);
  }
  // 最初の民は今もこの節で子を眠らせ、フックを倍に増やした変奏で死者を送る
  const first = alive[0];
  assert.equal(melodyToKana(first.repertoire.dominant('lull').melody), LETTER, '子守歌');
  assert.equal(melodyToKana(first.repertoire.dominant('dirge').melody),
    'らドレドレドレドレドーそーー', '弔い歌（変奏）');
});
