import { test } from 'node:test';
import assert from 'node:assert/strict';

import { World } from '../js/core/world.js';
import { KIND } from '../js/core/chronicle.js';

const runYears = (w, years) => { for (let i = 0; i < years * 12; i++) w.step(); };

/* ---------- 創世 ---------- */
test('創世：最初の民が定住している', () => {
  const w = new World(2026);
  assert.ok(w.settlements.length >= 3, '集落がある');
  assert.equal(w.chronicle.entries[0].kind, KIND.GENESIS);
});

/* ---------- 文明の立ち上がり ---------- */
test('200 年も流せば、国が興り、歴史が書かれている', () => {
  const w = new World(7);
  runYears(w, 200);
  assert.ok(w.settlements.length > 6, '集落が増えている');
  assert.ok(w.nations.size >= 1, '建国されている');
  assert.ok(w.chronicle.entries.length > 10, '史書に記述がある');
  const kinds = new Set(w.chronicle.entries.map(e => e.kind));
  assert.ok(kinds.has(KIND.FOUND), '集落の建設が記録されている');
  assert.ok(kinds.has(KIND.NATION), '建国が記録されている');
});

/* ---------- 健全性 ---------- */
test('600 年流しても世界は壊れない（数値・人口・領土）', () => {
  const w = new World(12345);
  runYears(w, 600);
  let pop = 0;
  for (const s of w.settlements) {
    assert.ok(Number.isFinite(s.pop) && s.pop >= 0);
    assert.ok(s.x >= 0 && s.x < 200 && s.y >= 0 && s.y < 200);
    pop += s.pop;
  }
  assert.ok(pop > 1000, '人類は存続している');
  // 領土の所有者は実在する国
  for (let i = 0; i < w.owner.length; i++) {
    if (w.owner[i] > 0) assert.ok(w.nations.has(w.owner[i]));
  }
  // 首都は自国の都市
  for (const n of w.aliveNations()) {
    const cap = w.settlementById.get(n.capitalId);
    assert.ok(cap, `${n.name} に首都がある`);
    assert.equal(cap.nationId, n.id);
  }
});

/* ---------- 決定性 ---------- */
test('同じ種から始めた二つの世界は、同じ歴史を書く', () => {
  const a = new World(31415);
  const b = new World(31415);
  runYears(a, 250);
  runYears(b, 250);
  assert.equal(a.settlements.length, b.settlements.length);
  assert.equal(a.nations.size, b.nations.size);
  assert.equal(a.chronicle.entries.length, b.chronicle.entries.length);
  for (let i = 0; i < a.chronicle.entries.length; i++) {
    assert.equal(a.chronicle.entries[i].text, b.chronicle.entries[i].text);
  }
  for (let i = 0; i < a.settlements.length; i++) {
    assert.equal(a.settlements[i].pop, b.settlements[i].pop);
  }
});

test('種が違えば、歴史も違う', () => {
  const a = new World(1);
  const b = new World(2);
  runYears(a, 100);
  runYears(b, 100);
  const ta = a.chronicle.entries.map(e => e.text).join('|');
  const tb = b.chronicle.entries.map(e => e.text).join('|');
  assert.notEqual(ta, tb);
});

/* ---------- 歴史のドラマが実際に起こる ---------- */
test('長い歴史には、戦争・時代の進歩・王の代替わりが刻まれる', () => {
  const w = new World(20260612);
  runYears(w, 800);
  const kinds = new Set(w.chronicle.entries.map(e => e.kind));
  assert.ok(kinds.has(KIND.WAR) || kinds.has(KIND.REBEL),
    '戦火（戦争か反乱）が記録されている');
  assert.ok(kinds.has(KIND.ERA), '時代が進んでいる');
  assert.ok(kinds.has(KIND.RULER), '王が代替わりしている');
  assert.ok(w.history.length > 100, '年表が伸びている');
});

/* ---------- 保存と復元 ---------- */
test('世界は JSON に畳んで開き直せ、歴史は続けられる', () => {
  const w = new World(777);
  runYears(w, 150);
  const json = JSON.stringify(w.serialize());
  const w2 = World.deserialize(JSON.parse(json));
  assert.equal(w2.year, w.year);
  assert.equal(w2.settlements.length, w.settlements.length);
  assert.equal(w2.nations.size, w.nations.size);
  assert.equal(w2.chronicle.entries.length <= w.chronicle.entries.length, true);
  // 地形は種から完全に再生される
  assert.deepEqual(Array.from(w2.terrain.biome.slice(0, 1000)),
    Array.from(w.terrain.biome.slice(0, 1000)));
  // 開き直した世界も流れ続ける
  runYears(w2, 50);
  assert.ok(w2.year === w.year + 50);
  assert.ok(w2.settlements.length > 0);
});

/* ---------- 道路 ---------- */
test('入植が進むと、道が世界に張り巡らされる', () => {
  const w = new World(424242);
  runYears(w, 300);
  let roads = 0;
  for (let i = 0; i < w.road.length; i++) roads += w.road[i];
  assert.ok(roads > 30, `道のタイルがある（${roads}）`);
});
