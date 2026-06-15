import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../js/core/rng.js';
import { createUnit } from '../js/core/unit.js';
import { makeArmy, resolveMassCombat, armyTroops, regimentOf } from '../js/core/masscombat.js';
import { Game } from '../js/core/game.js';

function army(name, side, specs, seed) {
  const r = new RNG(seed);
  return makeArmy(name, specs.map((s, i) => createUnit({ ...s, side }, r.derive('u' + i))));
}

test('連隊：兵力・攻・守が能力から決まる', () => {
  const u = createUnit({ classId: 'knight', level: 10, items: ['steel_lance'], side: 'player' }, new RNG(1));
  const reg = regimentOf(u);
  assert.ok(reg.troops > 0 && reg.atk > 0 && reg.def > 0);
  assert.equal(reg.troops, reg.troops0);
});

test('会戦：必ず決着し、強い軍が勝ちやすい', () => {
  const strong = army('強', 'player', Array.from({ length: 6 }, () => ({ classId: 'general', level: 18, items: ['silver_lance'] })), 1);
  const weak = army('弱', 'enemy', Array.from({ length: 4 }, () => ({ classId: 'soldier', level: 3, items: ['iron_lance'] })), 2);
  const res = resolveMassCombat(strong, weak, new RNG(7));
  assert.ok(res.rounds.length >= 1, '会戦が進む');
  assert.equal(res.winner, 'a', '強い軍が勝つ');
  assert.ok(res.survivorsB < res.troops0B, '敗者は兵を失う');
});

test('会戦：決定的（同じ種・同じ軍なら同じ結果）', () => {
  const run = () => {
    const a = army('A', 'player', Array.from({ length: 5 }, (_, i) => ({ classId: 'mercenary', level: 8 + i, items: ['steel_sword'] })), 3);
    const b = army('B', 'enemy', Array.from({ length: 5 }, (_, i) => ({ classId: 'fighter', level: 8 + i, items: ['steel_axe'] })), 4);
    return resolveMassCombat(a, b, new RNG(9));
  };
  const x = run(), y = run();
  assert.equal(x.winner, y.winner);
  assert.deepEqual(x.rounds.map(r => [r.a, r.b]), y.rounds.map(r => [r.a, r.b]));
});

test('会戦：味方軍と敵軍を組んで戦える（実キャンペーン）', () => {
  const g = new Game(20260615);
  const a = makeArmy('自軍', g.party);
  const r = new RNG(g.seed ^ 5);
  const foes = Array.from({ length: 8 }, (_, i) => createUnit({ classId: 'soldier', level: 5, items: ['iron_lance'], side: 'enemy' }, r.derive('f' + i)));
  const b = makeArmy('敵軍', foes);
  const res = resolveMassCombat(a, b, new RNG(11));
  assert.ok(['a', 'b', 'draw'].includes(res.winner));
  assert.ok(armyTroops(a) >= 0 && armyTroops(b) >= 0);
});
