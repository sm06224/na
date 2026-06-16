import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { classDef } from '../js/core/classes.js';
import { BESTIARY, WORLD } from '../js/core/lore.js';
import { EXTRA_BESTIARY5, EXTRA_WORLD5 } from '../js/core/lore_extra5.js';

test('図鑑の追補・其の五：魔物20・世界史16が本編へ合流、実在職', () => {
  assert.equal(EXTRA_BESTIARY5.length, 20);
  assert.equal(EXTRA_WORLD5.length, 16);
  for (const e of EXTRA_BESTIARY5) {
    assert.ok(classDef(e.classId), `職 ${e.classId}`);
    assert.ok(e.name && e.blurb && e.tactics, `${e.name} の記述`);
    assert.ok(BESTIARY.includes(e), `${e.name} が図鑑に`);
  }
  for (const w of EXTRA_WORLD5) assert.ok(WORLD.includes(w) && w.title && w.text, `${w.title} が世界史に`);
});

test('図鑑の総数がさらに増えた（魔物誌130以上・世界史85以上）', () => {
  assert.ok(BESTIARY.length >= 130, `魔物誌が豊富（${BESTIARY.length}）`);
  assert.ok(WORLD.length >= 85, `世界史が豊富（${WORLD.length}）`);
});
