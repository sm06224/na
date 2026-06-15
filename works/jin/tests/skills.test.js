import test from 'node:test';
import assert from 'node:assert/strict';
import { RNG } from '../js/core/rng.js';
import { Board } from '../js/core/board.js';
import { createUnit, isAlive, hasSkill } from '../js/core/unit.js';
import { forecast, resolveCombat, bondOf } from '../js/core/combat.js';
import { SKILLS } from '../js/core/skills.js';
import { hasStatus } from '../js/core/status.js';
import '../js/core/expansion.js';
import '../js/core/items_status.js';
import { item } from '../js/core/items.js';

test('新しい技がすべて登録されている', () => {
  for (const id of ['ignis', 'adept', 'wrath', 'vantage', 'lifetaker', 'bond']) {
    assert.ok(SKILLS[id], `技 ${id}`);
  }
});

test('絆：隣に味方がいると命中・会心が上がる', () => {
  const mk = (withAlly) => {
    const b = new Board(4, 3);
    const r = new RNG(5);
    const a = createUnit({ classId: 'mercenary', level: 5, items: ['iron_sword'], side: 'player' }, r.derive('a'));
    const d = createUnit({ classId: 'soldier', level: 5, items: ['iron_lance'], side: 'enemy' }, r.derive('d'));
    b.add(a, 1, 1); b.add(d, 2, 1);
    if (withAlly) { const ally = createUnit({ classId: 'soldier', level: 5, items: ['iron_lance'], side: 'player' }, r.derive('e')); b.add(ally, 1, 0); }
    b.rebuildIndex();
    return { b, a, d };
  };
  const alone = mk(false), bonded = mk(true);
  assert.equal(bondOf(bonded.a, bonded.b), 1);
  assert.equal(bondOf(alone.a, alone.b), 0);
  const f0 = forecast(alone.a, alone.d, alone.b);
  const f1 = forecast(bonded.a, bonded.d, bonded.b);
  assert.ok(f1.hit > f0.hit, '絆で命中が上がる');
  assert.ok(f1.crit >= f0.crit, '絆で会心も上がる');
});

test('状態異常の得物：当たれば毒に侵す', () => {
  let poisoned = 0, hits = 0;
  for (let s = 0; s < 40; s++) {
    const b = new Board(3, 1);
    const r = new RNG(100 + s);
    const a = createUnit({ classId: 'mercenary', level: 8, items: ['venin_edge'], side: 'player' }, r.derive('a'));
    const d = createUnit({ classId: 'general', level: 8, items: ['iron_lance'], side: 'enemy' }, r.derive('d'));
    d.statsBase.hp = 80; d.maxHp = 80; d.hp = 80;        // 死なずに毒だけ見たい
    b.add(a, 0, 0); b.add(d, 1, 0); b.rebuildIndex();
    const res = resolveCombat(a, d, b, new RNG(s));
    if (res.events.some(e => (e.type === 'hit' || e.type === 'crit') && e.by === a.uid)) hits++;
    if (hasStatus(d, 'poison')) poisoned++;
  }
  assert.ok(hits > 0 && poisoned > 0, `毒の刃は当たれば毒を与える（${poisoned}/${hits}）`);
});

test('命奪：敵を倒すと使い手が癒える', () => {
  let healedSeen = false, killSeen = false;
  for (let s = 0; s < 40 && !healedSeen; s++) {
    const b = new Board(3, 1);
    const r = new RNG(7);
    const a = createUnit({ classId: 'sorcerer', level: 12, items: ['flux'], side: 'player' }, r.derive('a'));
    assert.ok(hasSkill(a, 'lifetaker'));
    a.hp = 5;
    const d = createUnit({ classId: 'mage', level: 1, items: ['fire'], side: 'enemy' }, r.derive('d'));
    d.hp = 1;
    b.add(a, 0, 0); b.add(d, 1, 0); b.rebuildIndex();
    const before = a.hp;
    resolveCombat(a, d, b, new RNG(s));
    if (!isAlive(d)) { killSeen = true; if (a.hp > before) healedSeen = true; }
  }
  assert.ok(killSeen, '倒せる場面があった');
  assert.ok(healedSeen, '倒したとき癒えた');
});

test('先制（vantage）：手負いの守り手は先に反撃する', () => {
  const b = new Board(3, 1);
  const r = new RNG(9);
  const att = createUnit({ classId: 'fighter', level: 6, items: ['iron_axe'], side: 'enemy' }, r.derive('a'));
  const def = createUnit({ classId: 'swordmaster', level: 10, items: ['iron_sword'], side: 'player' }, r.derive('d'));
  assert.ok(hasSkill(def, 'vantage'));
  def.hp = Math.floor(def.maxHp / 2);                 // 半分以下
  b.add(att, 0, 0); b.add(def, 1, 0); b.rebuildIndex();
  const res = resolveCombat(att, def, b, new RNG(3));
  const firstStrike = res.events.find(e => e.type === 'hit' || e.type === 'crit' || e.type === 'miss');
  assert.ok(firstStrike && firstStrike.by === def.uid, '最初の一撃は守り手から');
});
