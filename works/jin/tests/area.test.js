import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../js/core/rng.js';
import { Board } from '../js/core/board.js';
import { createUnit, isAlive } from '../js/core/unit.js';
import { Battle } from '../js/core/battle.js';
import { areaTargets, isAreaWeapon } from '../js/core/combat.js';
import '../js/core/items_area.js';

function setup(seed) {
  const b = new Board(14, 4);
  const r = new RNG(seed);
  const caster = createUnit({ classId: 'sage', level: 16, items: ['meteor'], side: 'player' }, r.derive('c'));
  caster.statsBase.mag = 24; caster.maxHp = 40; caster.hp = 40;
  b.add(caster, 0, 1);
  // 敵を密集させる
  const foes = [[9, 1], [9, 0], [10, 1]].map((p, i) => {
    const e = createUnit({ classId: 'soldier', level: 6, items: ['iron_lance'], side: 'enemy' }, r.derive('e' + i));
    b.add(e, p[0], p[1]); return e;
  });
  b.rebuildIndex();
  return { b, caster, foes };
}

test('範囲武器：着弾点の周りの敵をまとめて狙う', () => {
  const { b, caster } = setup(1);
  assert.ok(isAreaWeapon(caster), 'メテオは範囲武器');
  const hit = areaTargets(caster, { x: 9, y: 1 }, b);
  assert.equal(hit.length, 3, '半径1に三体とも入る');
});

test('撃てる着弾点：射程内で巻き込める所が挙がる', () => {
  const { b, caster } = setup(2);
  const battle = new Battle(b, { rng: new RNG(2) });
  const centers = battle.areaCentersFrom(caster, caster.pos);
  assert.ok(centers.length >= 1, '撃てる点がある');
  assert.ok(centers.some(c => c.x === 9 && c.y === 1), '密集点を狙える');
  // 撃てる点はすべて射程内（3..10）
  for (const c of centers) {
    const d = Math.abs(c.x - caster.pos.x) + Math.abs(c.y - caster.pos.y);
    assert.ok(d >= 3 && d <= 10, '射程内');
  }
});

test('範囲攻撃：反撃なしで複数体に当たる、決定的', () => {
  const run = () => {
    const { b, caster } = setup(7);
    const battle = new Battle(b, { rng: new RNG(7) });
    const res = battle.doAreaAttack(caster, { x: 9, y: 1 });
    return { res, caster };
  };
  const a = run(), b2 = run();
  assert.equal(a.res.targets.length, 3);
  // すべて術者からの一撃（反撃イベントは無い）
  for (const e of a.res.events) if (e.by != null) assert.equal(e.by, a.caster.uid, '反撃は起きない');
  assert.ok(a.caster.hasActed);
  assert.deepEqual(a.res.events.map(e => [e.type, e.dmg]), b2.res.events.map(e => [e.type, e.dmg]));
});

test('範囲攻撃の splash タイル：半径ぶん挙がる', () => {
  const { b, caster } = setup(3);
  const battle = new Battle(b, { rng: new RNG(3) });
  const tiles = battle.areaSplashTiles(caster, { x: 9, y: 1 });
  for (const t of tiles) assert.ok(Math.abs(t.x - 9) + Math.abs(t.y - 1) <= 1);
});
