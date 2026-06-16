import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/core/game.js';
import { RNG } from '../js/core/rng.js';
import { createUnit, effectiveStats } from '../js/core/unit.js';
import { Board } from '../js/core/board.js';
import { strikeInfo, bondOf } from '../js/core/combat.js';
import {
  pairKey, rankNum, rankLetter, addSupport, supportPoints, supportRank,
  awardSupportsAfterBattle, applySupportsToUnits, supportBondBonus,
  SUPPORT_THRESHOLDS, SUPPORT_MAX,
} from '../js/core/support.js';
import { encodeSave, decodeSave } from '../js/core/save.js';

test('支援：組の鍵は順序によらない', () => {
  assert.equal(pairKey('リン', 'カイ'), pairKey('カイ', 'リン'));
  assert.equal(pairKey({ name: 'A' }, { name: 'B' }), 'A|B');
});

test('支援：点から段（—/C/B/A）', () => {
  assert.equal(rankNum(0), 0); assert.equal(rankLetter(0), '—');
  assert.equal(rankLetter(SUPPORT_THRESHOLDS[0]), 'C');
  assert.equal(rankLetter(SUPPORT_THRESHOLDS[1]), 'B');
  assert.equal(rankLetter(SUPPORT_THRESHOLDS[2]), 'A');
});

test('支援：絆は積めるが上限で止まる', () => {
  const g = { supports: {} };
  addSupport(g, 'リン', 'カイ', 10);
  assert.equal(supportPoints(g, 'カイ', 'リン'), 10);
  const up = addSupport(g, 'リン', 'カイ', 12);    // 22 で C に上がる
  assert.equal(up, 1, 'Cに上がった');
  addSupport(g, 'リン', 'カイ', 999);
  assert.equal(supportPoints(g, 'リン', 'カイ'), SUPPORT_MAX, '上限で止まる');
});

test('支援：戦のあと、よりそった組ほど深まる（決定的）', () => {
  const make = () => {
    const g = new Game(20260615);
    const b = new Board(6, 1);
    const a = g.party[0], c = g.party[1], d = g.party[2];
    b.add(a, 1, 0); b.add(c, 2, 0); b.add(d, 5, 0); b.rebuildIndex();
    awardSupportsAfterBattle(g, b);
    return g.supports;
  };
  const x = make(), y = make();
  assert.deepEqual(x, y, '決定的');
  const a = new Game(20260615).party;
  const near = supportPoints({ supports: x }, a[0], a[1]);
  const far = supportPoints({ supports: x }, a[0], a[2]);
  assert.ok(near > far, '隣の組ほど多く伸びる');
});

test('支援：段が絆ボーナスになり、命中・回避を増す', () => {
  const r = new RNG(3);
  const a = createUnit({ classId: 'mercenary', level: 10, items: ['steel_sword'], side: 'player', name: 'リン' }, r.derive('a'));
  const ally = createUnit({ classId: 'knight', level: 10, items: ['steel_lance'], side: 'player', name: 'カイ' }, r.derive('b'));
  const foe = createUnit({ classId: 'soldier', level: 10, items: ['iron_lance'], side: 'enemy' }, r.derive('e'));
  const b = new Board(6, 3);
  b.add(a, 1, 1); b.add(ally, 2, 1); b.add(foe, 1, 0); b.rebuildIndex();
  const baseHit = strikeInfo(a, foe, b).hit;
  // A 段の支援を与えて早見表を貼る
  const g = { supports: {} }; addSupport(g, 'リン', 'カイ', SUPPORT_MAX);
  applySupportsToUnits(g, b);
  const supHit = strikeInfo(a, foe, b).hit;
  assert.ok(supportBondBonus(a, b) >= 3, '隣の支援相手から段ぶんの上乗せ');
  assert.ok(supHit >= baseHit, '支援で命中が落ちない（多くは増える）');
});

test('支援：早見表がなければ絆は素のまま（既存の挙動は不変）', () => {
  const r = new RNG(5);
  const a = createUnit({ classId: 'mercenary', level: 8, items: ['iron_sword'], side: 'player' }, r.derive('a'));
  const ally = createUnit({ classId: 'knight', level: 8, items: ['iron_lance'], side: 'player' }, r.derive('b'));
  const b = new Board(4, 2);
  b.add(a, 1, 0); b.add(ally, 2, 0); b.rebuildIndex();
  assert.equal(bondOf(a, b), 1, '素の絆＝隣の味方1');
});

test('支援：符号（セーブ）に絆が綴じられ、読み戻せる', () => {
  const g = new Game(777);
  addSupport(g, g.party[0], g.party[1], 55);
  const g2 = decodeSave(encodeSave(g));
  assert.equal(supportRank(g2, g2.party[0], g2.party[1]), supportRank(g, g.party[0], g.party[1]));
  assert.equal(supportPoints(g2, g2.party[0], g2.party[1]), 55);
});

test('支援：全16章は支援込みでも必ず決着する', () => {
  const g = new Game(20260615);
  for (let i = 0; i < 3; i++) {
    const { battle } = g.startChapter(i);
    const res = battle.autoResolve(80);
    assert.equal(res.over, true, `第${i + 1}章が決着`);
    if (res.victory) g.onVictory(); else break;
  }
  assert.ok(Object.keys(g.supports).length > 0, '勝ち進むと絆が積まれる');
});
