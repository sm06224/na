import test from 'node:test';
import assert from 'node:assert/strict';
import { Battle } from '../js/core/battle.js';
import { Board } from '../js/core/board.js';
import { createUnit } from '../js/core/unit.js';
import { RNG } from '../js/core/rng.js';

function setup(objective, withEnemy, reinforce) {
  const b = new Board(6, 1);
  b.terrain.forEach((x, y) => b.setTerrain(x, y, 'plain'));
  if (objective.type === 'seize') b.setTerrain(objective.x, objective.y, 'throne');
  const lord = createUnit({ classId: 'lord', level: 5, items: ['iron_sword'], side: 'player', isLord: true }, new RNG(1));
  b.add(lord, 0, 0);
  if (withEnemy) { const e = createUnit({ classId: 'soldier', level: 3, items: ['iron_lance'], side: 'enemy' }, new RNG(2)); b.add(e, 5, 0); }
  b.rebuildIndex();
  return new Battle(b, { rng: new RNG(3), objective, expectLord: true, reinforce: reinforce || [] });
}

test('倒し切れば勝ち：制圧マップでも、敵全滅で勝利になる（玉座に乗らずとも）', () => {
  const seat = { x: 4, y: 0 };
  const battle = setup({ type: 'seize', x: seat.x, y: seat.y }, false);
  battle.checkEnd();
  assert.equal(battle.over, true);
  assert.equal(battle.victory, true, '敵がいなければ制圧でも勝ち');
});

test('倒し切れば勝ち：離脱マップでも、敵全滅で勝利', () => {
  const battle = setup({ type: 'escape', tiles: [{ x: 5, y: 0 }] }, false);
  battle.checkEnd();
  assert.equal(battle.over, true);
  assert.equal(battle.victory, true);
});

test('倒し切れば勝ち：生存マップでも、敵全滅で即勝利', () => {
  const battle = setup({ type: 'survive', turns: 10 }, false);
  battle.checkEnd();
  assert.equal(battle.over, true);
  assert.equal(battle.victory, true);
});

test('敵が残っていれば勝ちにならない（制圧）', () => {
  const battle = setup({ type: 'seize', x: 4, y: 0 }, true);
  battle.checkEnd();
  assert.equal(battle.over, false, '敵がいる間は決着しない');
});

test('未到来の増援が残るうちは、盤上の敵を倒しても勝ちにならない', () => {
  const wave = { turn: 3, units: [createUnit({ classId: 'soldier', level: 3, side: 'enemy' }, new RNG(9))], done: false };
  const battle = setup({ type: 'rout' }, false, [wave]);
  battle.checkEnd();
  assert.equal(battle.over, false, '増援待ちなら保留');
  wave.done = true;
  battle.checkEnd();
  assert.equal(battle.over, true, '増援も尽きれば勝ち');
  assert.equal(battle.victory, true);
});

test('従来の勝ち筋も健在：玉座制圧で勝利（敵が残っていても）', () => {
  const battle = setup({ type: 'seize', x: 4, y: 0 }, true);
  const lord = battle.lord();
  battle.board.moveUnit(lord, 4, 0);
  battle.checkEnd();
  assert.equal(battle.victory, true, '玉座に乗れば敵が残っていても勝ち');
  assert.equal(battle.reason, 'seize');
});
