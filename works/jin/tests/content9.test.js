import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { classDef } from '../js/core/classes.js';
import { BESTIARY, WORLD } from '../js/core/lore.js';
import { EXTRA_BESTIARY9, EXTRA_WORLD9 } from '../js/core/lore_extra9.js';
import { EXTRA_BESTIARY10, EXTRA_WORLD10 } from '../js/core/lore_extra10.js';

test('図鑑の追補・其の九＆十：魔物各20・世界史各16が本編へ合流、実在職', () => {
  for (const [b, w] of [[EXTRA_BESTIARY9, EXTRA_WORLD9], [EXTRA_BESTIARY10, EXTRA_WORLD10]]) {
    assert.equal(b.length, 20);
    assert.equal(w.length, 16);
    for (const e of b) assert.ok(classDef(e.classId) && e.name && e.blurb && e.tactics && BESTIARY.includes(e), `${e.name}`);
    for (const x of w) assert.ok(WORLD.includes(x) && x.title && x.text, `${x.title}`);
  }
});

test('図鑑の総数がさらに増えた（魔物誌230以上・世界史165以上）', () => {
  assert.ok(BESTIARY.length >= 230, `魔物誌が豊富（${BESTIARY.length}）`);
  assert.ok(WORLD.length >= 165, `世界史が豊富（${WORLD.length}）`);
});
