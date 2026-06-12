import { test } from 'node:test';
import assert from 'node:assert/strict';

import { World, CFG } from '../js/world.js';

/* ============================================================
   宇宙そのものの検証 — ヘッドレスで歴史を流し、法則を確かめる。
   ============================================================ */

test('創世直後の世界は生命と植生に満ちている', () => {
  const w = new World(123);
  assert.equal(w.creatures.length, CFG.INIT_CREATURES);
  assert.ok(w.plants.length > CFG.INIT_PLANTS * 0.2, '植物が発芽している');
  assert.ok(w.species.size >= 1);
});

test('600 拍を流しても世界は壊れず、生命は続く', () => {
  const w = new World(999);
  for (let i = 0; i < 600; i++) w.step();
  assert.ok(w.creatures.length > 0, '生命が残っている（恵みの雨込み）');
  assert.ok(w.plants.length <= CFG.PLANT_CAP);
  for (const c of w.creatures) {
    assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y));
    assert.ok(c.x >= 0 && c.x < CFG.WORLD && c.y >= 0 && c.y < CFG.WORLD);
    assert.ok(Number.isFinite(c.energy));
  }
  assert.ok(w.history.length > 0, '年代記が記録されている');
});

test('同じ種から生まれた二つの宇宙は、同じ歴史をたどる（決定性）', () => {
  const a = new World(31415);
  const b = new World(31415);
  for (let i = 0; i < 300; i++) { a.step(); b.step(); }
  assert.equal(a.creatures.length, b.creatures.length);
  assert.equal(a.plants.length, b.plants.length);
  assert.equal(a.species.size, b.species.size);
  for (let i = 0; i < a.creatures.length; i++) {
    assert.equal(a.creatures[i].x, b.creatures[i].x);
    assert.equal(a.creatures[i].y, b.creatures[i].y);
    assert.equal(a.creatures[i].energy, b.creatures[i].energy);
  }
});

test('種の違う宇宙は、違う歴史をたどる', () => {
  const a = new World(1);
  const b = new World(2);
  for (let i = 0; i < 120; i++) { a.step(); b.step(); }
  const same = a.creatures.length === b.creatures.length &&
    a.plants.length === b.plants.length;
  assert.ok(!same || a.creatures[0]?.x !== b.creatures[0]?.x);
});

test('世界は JSON に畳んで、開き直せる', () => {
  const w = new World(777);
  for (let i = 0; i < 200; i++) w.step();
  const json = JSON.stringify(w.serialize());
  const w2 = World.deserialize(JSON.parse(json));
  assert.equal(w2.step_, w.step_);
  assert.equal(w2.creatures.length, w.creatures.length);
  assert.equal(w2.plants.length, w.plants.length);
  assert.equal(w2.species.size, w.species.size);
  // 復元した世界も流れ続けられる
  for (let i = 0; i < 100; i++) w2.step();
  assert.ok(w2.creatures.length > 0);
});

test('長い歴史の中で、種分化と絶滅がともに記録される', () => {
  const w = new World(2026);
  for (let i = 0; i < 2500; i++) w.step();
  assert.ok(w.maxGeneration > 1, '世代が進んでいる');
  assert.ok(w.species.size > 1, '種が分化している');
  const extinct = [...w.species.values()].filter(s => s.extinctAt !== null);
  assert.ok(extinct.length > 0, '絶滅した種が記録されている');
  // 絶滅した種は、もう誰も生きていないはず
  const aliveIds = new Set(w.creatures.map(c => c.speciesId));
  for (const s of extinct) assert.ok(!aliveIds.has(s.id), `${s.name} は本当に絶滅している`);
});

test('植生の繁茂を止めると、世界は痩せる', () => {
  const fat = new World(555);
  const lean = new World(555);
  lean.plantGrowth = 0;
  for (let i = 0; i < 500; i++) { fat.step(); lean.step(); }
  assert.ok(lean.plants.length < fat.plants.length, '発芽なしの世界は植生が減る');
});
