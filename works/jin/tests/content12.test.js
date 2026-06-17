import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { classDef } from '../js/core/classes.js';
import { BESTIARY, WORLD } from '../js/core/lore.js';
import { EXTRA_BESTIARY14, EXTRA_WORLD14 } from '../js/core/lore_extra14.js';
import { EXTRA_BESTIARY15, EXTRA_WORLD15 } from '../js/core/lore_extra15.js';
import { EXTRA_BESTIARY16, EXTRA_WORLD16 } from '../js/core/lore_extra16.js';
import { EXTRA_BESTIARY17, EXTRA_WORLD17 } from '../js/core/lore_extra17.js';
import { EXTRA_BESTIARY18, EXTRA_WORLD18 } from '../js/core/lore_extra18.js';

test('図鑑の追補・其の十四〜十七：各巻が魔物20・世界史16で本編へ合流、実在職', () => {
  const vols = [
    [EXTRA_BESTIARY14, EXTRA_WORLD14], [EXTRA_BESTIARY15, EXTRA_WORLD15],
    [EXTRA_BESTIARY16, EXTRA_WORLD16], [EXTRA_BESTIARY17, EXTRA_WORLD17],
  ];
  for (const [b, w] of vols) {
    assert.equal(b.length, 20);
    assert.equal(w.length, 16);
    for (const e of b) assert.ok(classDef(e.classId) && e.name && e.blurb && e.tactics && BESTIARY.includes(e), `${e.name}`);
    for (const x of w) assert.ok(WORLD.includes(x) && x.title && x.text, `${x.title}`);
  }
});

test('終譚・其の十八：戦後の余話が本編へ合流、実在職', () => {
  assert.equal(EXTRA_BESTIARY18.length, 10);
  assert.equal(EXTRA_WORLD18.length, 10);
  for (const e of EXTRA_BESTIARY18) assert.ok(classDef(e.classId) && e.name && e.blurb && e.tactics && BESTIARY.includes(e), `${e.name}`);
  for (const x of EXTRA_WORLD18) assert.ok(WORLD.includes(x) && x.title && x.text, `${x.title}`);
});

test('図鑑の総数がさらに増えた（魔物誌370以上・世界史275以上）', () => {
  assert.ok(BESTIARY.length >= 370, `魔物誌が豊富（${BESTIARY.length}）`);
  assert.ok(WORLD.length >= 275, `世界史が豊富（${WORLD.length}）`);
});
