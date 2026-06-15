import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../js/core/rng.js';
import { Board } from '../js/core/board.js';
import { createUnit, faithOf, promote } from '../js/core/unit.js';
import { Battle } from '../js/core/battle.js';
import { forecast } from '../js/core/combat.js';

test('信仰：光の徒は篤く、闇の徒は薄い', () => {
  assert.ok(faithOf('bishop') > faithOf('mercenary'));
  assert.ok(faithOf('sorcerer') < faithOf('cleric'));
  const monk = createUnit({ classId: 'monk', level: 1, items: ['lightning'], side: 'player' }, new RNG(1));
  assert.equal(monk.faith, faithOf('monk'));
});

test('信仰：光魔法は信仰ぶん威力が増す', () => {
  const mk = (faith) => {
    const b = new Board(3, 1);
    const r = new RNG(5);
    const a = createUnit({ classId: 'monk', level: 8, items: ['lightning'], side: 'player', faith }, r.derive('a'));
    a.statsBase.mag = 14;
    const d = createUnit({ classId: 'soldier', level: 6, items: ['iron_lance'], side: 'enemy' }, r.derive('d'));
    b.add(a, 0, 0); b.add(d, 1, 0); b.rebuildIndex();
    return forecast(a, d, b).dmg;
  };
  assert.ok(mk(20) > mk(0), '信仰が高いほど光は強い');
});

test('信仰：闇の傷は信仰ぶんやわらぐ', () => {
  const mk = (faith) => {
    const b = new Board(3, 1);
    const r = new RNG(7);
    const a = createUnit({ classId: 'shaman', level: 8, items: ['flux'], side: 'enemy' }, r.derive('a'));
    a.statsBase.mag = 16;
    const d = createUnit({ classId: 'knight', level: 8, items: ['iron_lance'], side: 'player', faith }, r.derive('d'));
    d.statsBase.res = 2;
    b.add(a, 0, 0); b.add(d, 1, 0); b.rebuildIndex();
    return forecast(a, d, b).dmg;
  };
  assert.ok(mk(0) > mk(24), '信仰が高い者ほど闇に強い');
});

test('信仰：杖の回復は信仰ぶん増える', () => {
  const mk = (faith) => {
    const b = new Board(3, 1);
    const r = new RNG(3);
    const healer = createUnit({ classId: 'cleric', level: 8, items: ['mend'], side: 'player', faith }, r.derive('a'));
    healer.statsBase.mag = 8;
    const hurt = createUnit({ classId: 'knight', level: 8, items: ['iron_lance'], side: 'player' }, r.derive('b'));
    hurt.hp = 1;
    b.add(healer, 0, 0); b.add(hurt, 1, 0); b.rebuildIndex();
    const battle = new Battle(b, { rng: new RNG(1) });
    const before = hurt.hp;
    battle.doStaff(healer, hurt);
    return hurt.hp - before;
  };
  assert.ok(mk(18) > mk(0), '篤い信仰はよく癒す');
});
