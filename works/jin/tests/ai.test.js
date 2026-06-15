import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../js/core/rng.js';
import { Board } from '../js/core/board.js';
import { createUnit, equippedWeapon } from '../js/core/unit.js';
import { Battle } from '../js/core/battle.js';
import { planTurn } from '../js/core/ai.js';
import { Game, CHAPTERS } from '../js/core/game.js';

test('癒し手AI：傷ついた味方を癒すことを選ぶ', () => {
  const b = new Board(8, 3);
  const r = new RNG(5);
  const cleric = createUnit({ classId: 'cleric', level: 8, items: ['mend'], side: 'enemy' }, r.derive('c'));
  const hurt = createUnit({ classId: 'soldier', level: 6, items: ['iron_lance'], side: 'enemy' }, r.derive('h'));
  hurt.hp = 5;
  const foe = createUnit({ classId: 'mercenary', level: 6, items: ['iron_sword'], side: 'player' }, r.derive('f'));
  b.add(cleric, 1, 1); b.add(hurt, 2, 1); b.add(foe, 7, 1); b.rebuildIndex();
  assert.equal(equippedWeapon(cleric).wtype, 'staff');
  const plan = planTurn(b, cleric, new RNG(1));
  assert.equal(plan.heal, hurt.uid, '傷ついた味方を癒す計画');
});

test('癒し手AI：実際に手番を指すと味方のHPが回復する', () => {
  const b = new Board(8, 3);
  const r = new RNG(9);
  const cleric = createUnit({ classId: 'cleric', level: 10, items: ['mend'], side: 'enemy' }, r.derive('c'));
  const hurt = createUnit({ classId: 'knight', level: 8, items: ['iron_lance'], side: 'enemy' }, r.derive('h'));
  hurt.hp = 6;
  const foe = createUnit({ classId: 'mage', level: 6, items: ['fire'], side: 'player' }, r.derive('f'));
  b.add(cleric, 1, 1); b.add(hurt, 2, 1); b.add(foe, 7, 1); b.rebuildIndex();
  const battle = new Battle(b, { rng: new RNG(2) });
  const before = hurt.hp;
  const rec = battle.aiActOnce(cleric);
  assert.ok(hurt.hp > before, '回復した');
  assert.equal(rec.heal, hurt.uid);
});

test('癒し手を含んでも、全章は決着する（無限ループしない）', () => {
  for (let i = 0; i < CHAPTERS.length; i++) {
    const g = new Game(5000 + i);
    const res = g.startChapter(i).battle.autoResolve(90);
    assert.ok(res.over, `第${i + 1}章が決着`);
  }
});
