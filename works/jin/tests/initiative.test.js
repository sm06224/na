import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, CHAPTERS } from '../js/core/game.js';
import { attackSpeed } from '../js/core/unit.js';

test('行動順：速さ（攻速）の高い順に並ぶ', () => {
  const g = new Game(20260615, { initiative: true });
  const { battle } = g.startChapter(0);
  assert.ok(battle.initiative);
  assert.ok(Array.isArray(battle.order) && battle.order.length > 0);
  for (let i = 1; i < battle.order.length; i++) {
    assert.ok(attackSpeed(battle.order[i - 1]) >= attackSpeed(battle.order[i]), '攻速の降順');
  }
  const active = battle.activeUnit();
  assert.equal(active, battle.order[0], 'いちばん速い者から');
});

test('行動順：手番を送ると次の者へ、一巡で次ラウンド', () => {
  const g = new Game(7, { initiative: true });
  const { battle } = g.startChapter(0);
  const n = battle.order.length;
  const first = battle.activeUnit();
  battle.startUnitTurn(first);
  battle.endUnitTurn();
  const second = battle.activeUnit();
  assert.notEqual(first, second, '次の者へ');
  // 残りを送りきると turn が増える
  const startTurn = battle.turn;
  let guard = 0;
  while (battle.turn === startTurn && guard++ < n + 5) { const u = battle.activeUnit(); if (!u) break; battle.endUnitTurn(); }
  assert.ok(battle.turn > startTurn, '一巡で新ラウンド');
});

test('行動順モードでも全章が決着する（両軍 AI）', () => {
  for (let i = 0; i < CHAPTERS.length; i++) {
    const g = new Game(4000 + i, { initiative: true });
    const { battle } = g.startChapter(i);
    const res = battle.autoResolveInitiative(150);
    assert.ok(res.over, `第${i + 1}章（行動順）が決着`);
  }
});

test('行動順モードは決定的（同じ種なら同じ結果）', () => {
  const run = () => { const g = new Game(55, { initiative: true }); return g.startChapter(2).battle.autoResolveInitiative(150); };
  assert.deepEqual(run(), run());
});
