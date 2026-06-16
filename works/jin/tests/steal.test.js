import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { RNG } from '../js/core/rng.js';
import { createUnit, effectiveStats } from '../js/core/unit.js';
import { Board } from '../js/core/board.js';
import { canSteal, stealableItems, stealTargetsFrom, resolveSteal, stealSpeed } from '../js/core/steal.js';

// 速さを確実に上回らせるための素質下駄
function fastThief(items = ['iron_sword'], skills = ['steal']) {
  return createUnit({ classId: 'thief', level: 12, items, skills, side: 'player', statBoost: { spd: 12 } }, new RNG(1));
}
function slowFoe(items) {
  return createUnit({ classId: 'knight', level: 4, items, side: 'enemy' }, new RNG(2));
}

test('盗み：盗賊は心得があり、重装兵にはない', () => {
  assert.equal(canSteal(fastThief()), true);
  assert.equal(canSteal(slowFoe(['iron_lance'])), false);
});

test('盗み：速さが上でないと盗めない', () => {
  const thief = createUnit({ classId: 'thief', level: 1, items: ['iron_sword'], side: 'player' }, new RNG(3));
  const foe = createUnit({ classId: 'myrmidon', level: 18, items: ['vulnerary'], side: 'enemy', statBoost: { spd: 20 } }, new RNG(4));
  assert.ok(stealSpeed(foe) >= stealSpeed(thief));
  assert.deepEqual(stealableItems(thief, foe), []);
});

test('盗み：武器以外は盗めるが、装備中の武器は盗めない', () => {
  const thief = fastThief();
  const foe = slowFoe(['iron_lance', 'vulnerary', 'door_key']);   // 0=装備武器,1,2
  const idx = stealableItems(thief, foe);
  assert.ok(idx.includes(1) && idx.includes(2), '道具は盗める');
  assert.ok(!idx.includes(0), '装備中の武器は盗めない');
});

test('盗み：「盗む」では武器を盗めない／「強奪」なら持ち物の予備武器も盗める', () => {
  const foe = slowFoe(['iron_lance', 'hand_axe', 'vulnerary']);   // 1=予備武器
  const thief = fastThief(['iron_sword'], ['steal']);
  assert.ok(!stealableItems(thief, foe).includes(1), '盗むでは予備武器は不可');
  const rogue = fastThief(['iron_sword'], ['pickpocket']);
  assert.ok(stealableItems(rogue, foe).includes(1), '強奪なら予備武器も可');
});

test('盗み：持ち物が満杯なら盗めない', () => {
  const thief = fastThief(['iron_sword', 'vulnerary', 'vulnerary', 'door_key', 'chest_key']);   // 5個=満杯
  const foe = slowFoe(['iron_lance', 'elixir']);
  assert.deepEqual(stealableItems(thief, foe), []);
});

test('盗み：隣接の相手だけを狙える', () => {
  const thief = fastThief();
  const near = slowFoe(['iron_lance', 'vulnerary']);
  const far = slowFoe(['iron_lance', 'elixir']);
  const b = new Board(8, 1);
  b.add(thief, 1, 0); b.add(near, 2, 0); b.add(far, 5, 0); b.rebuildIndex();
  const tgts = stealTargetsFrom(b, thief, thief.pos);
  assert.ok(tgts.includes(near), '隣は狙える');
  assert.ok(!tgts.includes(far), '遠くは狙えない');
});

test('盗み：品が移り、相手の装備は保たれる', () => {
  const thief = fastThief();
  const foe = slowFoe(['iron_lance', 'elixir']);
  const items0 = thief.items.length;
  const eqId = foe.items[foe.equipped].id;
  const res = resolveSteal(thief, foe, 1);   // elixir を盗む
  assert.equal(res.item, 'elixir');
  assert.equal(thief.items.length, items0 + 1, '盗賊の手に増える');
  assert.ok(!foe.items.some(it => it.id === 'elixir'), '相手から消える');
  assert.equal(foe.items[foe.equipped].id, eqId, '相手の装備は保たれる');
});

test('盗み：装備より前の品を盗むと、装備の索引が直る', () => {
  const thief = fastThief(['iron_sword'], ['pickpocket']);
  const foe = slowFoe(['vulnerary', 'iron_lance']);   // 0=道具, 1=装備武器
  assert.equal(foe.equipped, 1);
  resolveSteal(thief, foe, 0);                          // 前の道具を盗む
  assert.equal(foe.items[foe.equipped].id, 'iron_lance', '装備はずれない');
});
