import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/core/game.js';
import { combatLine } from '../js/core/battle.js';

test('履歴：戦えば一行ずつ刻まれる', () => {
  const g = new Game(20260615);
  const { battle } = g.startChapter(0);
  assert.equal(battle.log.length, 0, 'はじめは空');
  battle.autoResolve(80);
  assert.ok(battle.log.length > 0, '戦いの記録が残る');
  for (const e of battle.log) {
    assert.ok(typeof e.text === 'string' && e.text.length > 0);
    assert.ok(typeof e.turn === 'number');
  }
});

test('履歴の一行：攻め手→受け手とダメージ、撃破も記す', () => {
  const att = { uid: 1, name: 'リン', hp: 20, maxHp: 20, side: 'player' };
  const def = { uid: 2, name: '賊', hp: 0, maxHp: 18, side: 'enemy' };
  const line = combatLine(att, def, [
    { type: 'hit', by: 1, tgt: 2, dmg: 9 },
    { type: 'crit', by: 1, tgt: 2, dmg: 9 },
    { type: 'skill', by: 1, id: 'sol' },
  ]);
  assert.ok(line.includes('リン') && line.includes('賊'));
  assert.ok(line.includes('撃破'));
  assert.ok(line.includes('sol'));
});

test('オート：自軍を AI が指して、戦いが進む', () => {
  const g = new Game(321);
  const { battle } = g.startChapter(1);
  const enemiesBefore = battle.board.unitsOf('enemy').length;
  // 数ターン、両軍を AI で
  for (let i = 0; i < 6 && !battle.over; i++) {
    battle.autoPlayerTurn();
    if (battle.over) break;
    battle.endPlayerPhase();
  }
  // 何らかの戦闘が起きて記録が残る（決着 or 進行）
  assert.ok(battle.log.length > 0, 'オートで戦いが記録される');
});
