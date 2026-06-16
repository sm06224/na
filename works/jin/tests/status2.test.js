import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { RNG } from '../js/core/rng.js';
import { createUnit, attackSpeed } from '../js/core/unit.js';
import { Board } from '../js/core/board.js';
import { strikeInfo, resolveCombat } from '../js/core/combat.js';
import { item as itemDef } from '../js/core/items.js';
import { addStatus, hasStatus, STATUS, SLOW_PENALTY, BLIND_PENALTY } from '../js/core/status.js';

function duel(aItems, dItems, aSkills) {
  const r = new RNG(11);
  const a = createUnit({ classId: 'mercenary', level: 10, items: aItems, side: 'player', skills: aSkills }, r.derive('a'));
  const d = createUnit({ classId: 'soldier', level: 10, items: dItems, side: 'enemy', statBoost: { spd: 18, lck: 12 } }, r.derive('d'));
  const b = new Board(4, 1); b.add(a, 1, 0); b.add(d, 2, 0); b.rebuildIndex();
  return { a, d, b };
}

test('状態：鈍足・盲目が辞書に加わった', () => {
  assert.ok(STATUS.slow && STATUS.blind);
  assert.ok(SLOW_PENALTY > 0 && BLIND_PENALTY > 0);
});

test('鈍足：攻速が落ちる', () => {
  const r = new RNG(3);
  const u = createUnit({ classId: 'swordmaster', level: 14, items: ['iron_sword'], side: 'player' }, r);
  const base = attackSpeed(u);
  addStatus(u, 'slow', 3);
  assert.equal(attackSpeed(u), base - SLOW_PENALTY, '鈍足で攻速が削がれる');
});

test('盲目：命中が大きく下がる', () => {
  const { a, d, b } = duel(['steel_sword'], ['iron_lance']);
  const before = strikeInfo(a, d, b).hit;
  addStatus(a, 'blind', 2);
  const after = strikeInfo(a, d, b).hit;
  assert.equal(before - after, BLIND_PENALTY, '盲目で命中−30');
});

test('状態を与える得物：鈍足・盲目の付与設定が正しい', () => {
  assert.equal(itemDef('shackle_lance').inflict.id, 'slow');
  assert.equal(itemDef('sand_dagger').inflict.id, 'blind');
  assert.equal(itemDef('flash_tome').inflict.id, 'blind');
  assert.ok(itemDef('flash_tome').magic, '閃光の書は魔法');
});

test('縛鎖の槍で殴れば、相手が鈍足になりうる（確率を満たせば）', () => {
  // 確実に当て、確実に付与するよう条件を整える
  const r = new RNG(1);
  const a = createUnit({ classId: 'general', level: 14, items: ['shackle_lance'], side: 'player', statBoost: { skl: 30, lck: 20 } }, r.derive('a'));
  const d = createUnit({ classId: 'knight', level: 8, items: ['iron_lance'], side: 'enemy' }, r.derive('d'));
  const b = new Board(4, 1); b.add(a, 1, 0); b.add(d, 2, 0); b.rebuildIndex();
  // inflict 判定が当たるまで複数シードで試す（決定的に少なくとも一つは付与される）
  let inflicted = false;
  for (let s = 0; s < 12 && !inflicted; s++) {
    const dd = createUnit({ classId: 'knight', level: 8, items: ['iron_lance'], side: 'enemy' }, new RNG(100 + s).derive('d'));
    const bb = new Board(4, 1); bb.add(a, 1, 0); bb.add(dd, 2, 0); bb.rebuildIndex();
    resolveCombat(a, dd, bb, new RNG(200 + s));
    if (hasStatus(dd, 'slow')) inflicted = true;
  }
  assert.ok(inflicted, '何度か殴れば鈍足が入る');
});

test('新装備（指輪・大弓）も登録されている', () => {
  for (const id of ['short_spear', 'great_bow', 'guard_ring', 'speed_ring', 'tar_hammer']) {
    assert.ok(itemDef(id) && itemDef(id).price > 0, `${id} 登録`);
  }
});
