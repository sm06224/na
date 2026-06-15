import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../js/core/rng.js';
import { Board } from '../js/core/board.js';
import { createUnit, isAlive, hasSkill } from '../js/core/unit.js';
import { Battle } from '../js/core/battle.js';
import { arithmeticTargets, statValue } from '../js/core/combat.js';
import '../js/core/expansion.js';

function field(seed) {
  const b = new Board(12, 3);
  const r = new RNG(seed);
  const caster = createUnit({ classId: 'calculator', level: 16, items: ['fire'], side: 'player' }, r.derive('c'));
  caster.statsBase.mag = 30; caster.maxHp = 40; caster.hp = 40;
  assert.ok(hasSkill(caster, 'arithmetic'), '算術士は算術を持つ');
  b.add(caster, 0, 1);
  const foes = [];
  for (let i = 0; i < 6; i++) {
    const e = createUnit({ classId: 'soldier', level: i + 1, items: ['iron_lance'], side: 'enemy' }, r.derive('e' + i));
    e.statsBase.res = 0; e.maxHp = 99; e.hp = 99;     // 死なせず判定だけ見る
    b.add(e, 4 + i, 1); foes.push(e);
  }
  b.rebuildIndex();
  return { b, caster, foes };
}

test('算術：指定した数の倍数のLvを持つ敵だけを狙う', () => {
  const { b, caster, foes } = field(3);
  // foes の Lv は 1..6。×3 → Lv3,6 が対象
  const t = arithmeticTargets(caster, 'level', 3, b);
  const lvs = t.map(u => u.level).sort();
  assert.deepEqual(lvs, [3, 6]);
});

test('算術：間合いを問わず、対象全員に当たる（決定的・反撃なし）', () => {
  const run = () => {
    const { b, caster } = field(7);
    const battle = new Battle(b, { rng: new RNG(7) });
    return battle.doArithmetic(caster, 'level', 2);     // 偶数Lv = 2,4,6 の3体
  };
  const a = run(), c = run();
  assert.equal(a.targets.length, 3);
  for (const e of a.events) assert.equal(e.by, a.targets[0] ? a.events[0].by : e.by);  // すべて術者から
  assert.deepEqual(a.events.map(e => [e.type, e.dmg]), c.events.map(e => [e.type, e.dmg]));
});

test('statValue：Lv/HP/能力を読む', () => {
  const u = { level: 7, hp: 12, statsBase: { def: 8, res: 4, spd: 9 }, classId: 'soldier', wexp: {}, accessory: null, buffs: {} };
  assert.equal(statValue(u, 'level'), 7);
  assert.equal(statValue(u, 'hp'), 12);
});
