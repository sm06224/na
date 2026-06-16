import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { RNG } from '../js/core/rng.js';
import { createUnit } from '../js/core/unit.js';
import { makeArmy, resolveMassCombat } from '../js/core/masscombat.js';
import { massPlan } from '../js/ui/massbattle.js';

function army(name, side, specs, seed) {
  const r = new RNG(seed);
  return makeArmy(name, specs.map((s, i) => createUnit({ ...s, side }, r.derive('u' + i))));
}

function sampleRes() {
  const a = army('A', 'player', Array.from({ length: 6 }, () => ({ classId: 'knight', level: 12, items: ['steel_lance'] })), 1);
  const b = army('B', 'enemy', Array.from({ length: 6 }, () => ({ classId: 'fighter', level: 11, items: ['steel_axe'] })), 2);
  return resolveMassCombat(a, b, new RNG(7));
}

test('会戦アニメ台本：粒数は上限以下、初期兵力を表す', () => {
  const res = sampleRes();
  const plan = massPlan(res, 48);
  assert.ok(plan.dotsA0 > 0 && plan.dotsA0 <= 48);
  assert.ok(plan.dotsB0 > 0 && plan.dotsB0 <= 48);
  assert.equal(plan.rounds.length, res.rounds.length);
});

test('会戦アニメ台本：損耗は非負で、粒は減る一方', () => {
  const plan = massPlan(sampleRes(), 48);
  let pa = plan.dotsA0, pb = plan.dotsB0;
  for (const r of plan.rounds) {
    assert.ok(r.killA >= 0 && r.killB >= 0);
    assert.ok(r.a <= pa && r.b <= pb, '粒は増えない');
    assert.equal(r.killA, pa - r.a);
    assert.equal(r.killB, pb - r.b);
    pa = r.a; pb = r.b;
  }
});

test('会戦アニメ台本：同じ結果なら同じ台本（純粋・決定的）', () => {
  const res = sampleRes();
  assert.deepEqual(massPlan(res), massPlan(res));
});

test('会戦アニメ台本：巨大な兵力でも上限に丸まる', () => {
  const res = { troops0A: 5000, troops0B: 9000, rounds: [{ round: 1, a: 4000, b: 6000, lossA: 1000, lossB: 3000 }], winner: 'a', survivorsA: 4000, survivorsB: 6000 };
  const plan = massPlan(res, 48);
  assert.ok(plan.dotsB0 <= 48 && plan.dotsA0 <= 48);
  assert.ok(plan.scale > 1, '丸めの倍率が立つ');
});
