import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../js/core/rng.js';
import { Board } from '../js/core/board.js';
import { createUnit } from '../js/core/unit.js';
import { forecast, flankBonus, dirToward } from '../js/core/combat.js';
import { Game, CHAPTERS } from '../js/core/game.js';

test('方角：守り手の向きと攻め手の位置で、正面/側面/背後が決まる', () => {
  const def = { facing: 2, pos: { x: 5, y: 5 } };          // 南を向く
  const front = { facing: 0, pos: { x: 5, y: 6 } };          // 南側（正面）
  const back = { facing: 0, pos: { x: 5, y: 4 } };           // 北側（背後）
  const side = { facing: 0, pos: { x: 6, y: 5 } };           // 東側（側面）
  assert.equal(flankBonus(front, def).kind, 'front');
  assert.equal(flankBonus(back, def).kind, 'back');
  assert.equal(flankBonus(side, def).kind, 'side');
  assert.ok(flankBonus(back, def).hit > flankBonus(side, def).hit);
});

test('背後からの攻撃は、正面より命中・会心が高い', () => {
  const mk = (ax, ay) => {
    const b = new Board(11, 11);
    const r = new RNG(5);
    const a = createUnit({ classId: 'mercenary', level: 6, items: ['iron_sword'], side: 'player' }, r.derive('a'));
    const d = createUnit({ classId: 'soldier', level: 6, items: ['iron_lance'], side: 'enemy' }, r.derive('d'));
    d.facing = 2;                          // 南を向く
    b.add(a, ax, ay); b.add(d, 5, 5); b.rebuildIndex();
    return forecast(a, d, b);
  };
  const front = mk(5, 6);                   // 南＝正面
  const back = mk(5, 4);                    // 北＝背後
  assert.ok(back.hit > front.hit, '背後は当てやすい');
  assert.ok(back.crit > front.crit, '背後は急所を突きやすい');
  assert.equal(back.flank, 'back');
});

test('dirToward：主要軸の方角を返す', () => {
  assert.equal(dirToward({ x: 0, y: 0 }, { x: 3, y: 1 }), 1);  // 東
  assert.equal(dirToward({ x: 0, y: 0 }, { x: 0, y: -2 }), 0); // 北
});

test('向き補正があっても、全章は決着する', () => {
  for (let i = 0; i < CHAPTERS.length; i++) {
    const g = new Game(7000 + i);
    assert.ok(g.startChapter(i).battle.autoResolve(90).over);
  }
});
