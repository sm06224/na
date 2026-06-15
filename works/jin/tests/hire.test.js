import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/core/game.js';
import { hireRoster, hire, canHire, dismiss, canDismiss } from '../js/core/party.js';
import { encodeSave, decodeSave } from '../js/core/save.js';
import { isAlive } from '../js/core/unit.js';

test('斡旋名簿：種から決定的・4人・実在の職', () => {
  const g = new Game(20260615);
  const a = hireRoster(g, 0), b = hireRoster(g, 0);
  assert.equal(a.length, 4);
  assert.deepEqual(a.map(c => c.id), b.map(c => c.id));
  for (const c of a) { assert.ok(c.name && c.classId && c.cost > 0); }
});

test('雇用：金が要る、雇えば仲間が増え一度きり', () => {
  const g = new Game(7); g.gold = 100000;
  const cand = hireRoster(g, 0)[0];
  const n = g.party.length;
  assert.ok(canHire(g, cand));
  const u = hire(g, cand);
  assert.ok(u && u.side === 'player');
  assert.equal(g.party.length, n + 1);
  assert.ok(!canHire(g, cand), '同じ候補は二度雇えない');
  g.gold = 0;
  const cand2 = hireRoster(g, 0)[1];
  assert.ok(!canHire(g, cand2), '金がなければ雇えない');
});

test('解雇：主君は解雇できない、他は外せて持ち物は荷駄へ', () => {
  const g = new Game(3);
  assert.ok(!canDismiss(g, g.party[0]), '主君（リン）は外せない');
  const target = g.party[3];
  const items = target.items.length;
  const c0 = g.convoy.length;
  const n = g.party.length;
  assert.ok(dismiss(g, target));
  assert.equal(g.party.length, n - 1);
  assert.equal(g.convoy.length, c0 + items, '持ち物は荷駄に戻る');
});

test('保存：雇用記録も復元される', () => {
  const g = new Game(9); g.gold = 100000;
  hire(g, hireRoster(g, 0)[0]);
  const g2 = decodeSave(encodeSave(g));
  assert.deepEqual(g2.hired, g.hired);
  assert.equal(g2.party.length, g.party.length);
});
