import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { classDef } from '../js/core/classes.js';
import { BESTIARY, WORLD } from '../js/core/lore.js';
import { EXTRA_BESTIARY11, EXTRA_WORLD11 } from '../js/core/lore_extra11.js';
import { EXTRA_BESTIARY12, EXTRA_WORLD12 } from '../js/core/lore_extra12.js';

test('図鑑の追補・其の十一＆十二：魔物各20・世界史各16が本編へ合流、実在職', () => {
  for (const [b, w] of [[EXTRA_BESTIARY11, EXTRA_WORLD11], [EXTRA_BESTIARY12, EXTRA_WORLD12]]) {
    assert.equal(b.length, 20);
    assert.equal(w.length, 16);
    for (const e of b) assert.ok(classDef(e.classId) && e.name && e.blurb && e.tactics && BESTIARY.includes(e), `${e.name}`);
    for (const x of w) assert.ok(WORLD.includes(x) && x.title && x.text, `${x.title}`);
  }
});

test('図鑑の総数がさらに増えた（魔物誌270以上・世界史195以上）', () => {
  assert.ok(BESTIARY.length >= 270, `魔物誌が豊富（${BESTIARY.length}）`);
  assert.ok(WORLD.length >= 195, `世界史が豊富（${WORLD.length}）`);
});
