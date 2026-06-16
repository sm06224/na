import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { classDef } from '../js/core/classes.js';
import { parseMap } from '../js/core/maps.js';
import { EXTRA_SETPIECES3 } from '../js/core/maps3.js';
import { BESTIARY, WORLD } from '../js/core/lore.js';
import { EXTRA_BESTIARY2, EXTRA_WORLD2 } from '../js/core/lore_extra2.js';

test('第三幕の設置マップ：8枚が解け、将ひとり・出撃と湧きがある', () => {
  assert.equal(EXTRA_SETPIECES3.length, 8);
  for (const sp of EXTRA_SETPIECES3) {
    const parsed = parseMap(sp);
    assert.ok(parsed.board.w >= 10 && parsed.board.h >= 10, `${sp.id} の盤面`);
    const flat = sp.rows.join('');
    assert.equal([...flat].filter(c => c === 'B').length, 1, `${sp.id} は将ひとり`);
    assert.ok([...flat].filter(c => c === 'P').length >= 6, `${sp.id} に出撃マス`);
    assert.ok([...flat].filter(c => c === 'E').length >= 6, `${sp.id} に湧きマス`);
    // 行は等幅
    assert.ok(sp.rows.every(r => r.length === sp.rows[0].length), `${sp.id} は等幅`);
  }
});

test('第三幕の図鑑：魔物18・世界史14が本編へ合流', () => {
  assert.equal(EXTRA_BESTIARY2.length, 18);
  assert.equal(EXTRA_WORLD2.length, 14);
  for (const e of EXTRA_BESTIARY2) {
    assert.ok(classDef(e.classId), `職 ${e.classId}`);
    assert.ok(e.name && e.blurb && e.tactics);
    assert.ok(BESTIARY.includes(e), `${e.name} が図鑑に合流`);
  }
  for (const w of EXTRA_WORLD2) { assert.ok(w.title && w.text); assert.ok(WORLD.includes(w), `${w.title} が世界史に合流`); }
});

test('第三幕の設置マップで、第十七〜終々章が自動で決着する', () => {
  // game.js が EXTRA_SETPIECES3 を index16..23 に充てる
  return import('../js/core/game.js').then(({ Game }) => {
    for (let i = 16; i < 24; i++) {
      const g = new Game(4242 + i, { setpiece: true });
      const { battle } = g.startChapter(i);
      assert.equal(battle.autoResolve(200).over, true, `第${i + 1}章（設置マップ）が決着`);
    }
  });
});
