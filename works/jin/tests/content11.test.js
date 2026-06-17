import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { classDef } from '../js/core/classes.js';
import { BESTIARY, WORLD } from '../js/core/lore.js';
import { EXTRA_BESTIARY13, EXTRA_WORLD13 } from '../js/core/lore_extra13.js';

test('図鑑の追補・其の十三（海譚）：魔物20・世界史16が本編へ合流、実在職', () => {
  assert.equal(EXTRA_BESTIARY13.length, 20);
  assert.equal(EXTRA_WORLD13.length, 16);
  for (const e of EXTRA_BESTIARY13) assert.ok(classDef(e.classId) && e.name && e.blurb && e.tactics && BESTIARY.includes(e), `${e.name}`);
  for (const w of EXTRA_WORLD13) assert.ok(WORLD.includes(w) && w.title && w.text, `${w.title}`);
});

test('図鑑の総数がさらに増えた（魔物誌290以上・世界史210以上）', () => {
  assert.ok(BESTIARY.length >= 290, `魔物誌が豊富（${BESTIARY.length}）`);
  assert.ok(WORLD.length >= 210, `世界史が豊富（${WORLD.length}）`);
});
