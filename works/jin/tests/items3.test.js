import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';                 // すべての追加得物を登録
import { ITEMS, item as itemDef, WTYPE, isMagicType } from '../js/core/items.js';
import { RNG } from '../js/core/rng.js';
import { createUnit } from '../js/core/unit.js';
import { Board } from '../js/core/board.js';
import { resolveCombat, forecast } from '../js/core/combat.js';
import { addStatus } from '../js/core/status.js';
import { STAT_KEYS } from '../js/core/stats.js';

const NEW_WEAPONS = ['brave_sword', 'brave_lance', 'brave_axe', 'brave_bow', 'rune_sword', 'spear', 'tomahawk', 'wyrmslayer', 'longbow', 'venom_dagger', 'hexblade', 'eclipse'];
const NEW_BOOST = ['spirit_dust', 'secret_book', 'talisman', 'boots'];

test('新装備：すべて登録され、値と型が妥当', () => {
  for (const id of [...NEW_WEAPONS, ...NEW_BOOST, 'antitoxin', 'pure_water']) {
    const it = itemDef(id);
    assert.ok(it, `${id} が登録済み`);
    assert.ok(it.price > 0, `${id} に値がある`);
  }
  for (const id of NEW_WEAPONS) {
    const it = itemDef(id);
    assert.ok(WTYPE[it.wtype], `${id} の型 ${it.wtype}`);
    assert.ok(it.mt >= 0 && it.hit >= 0 && it.min >= 1 && it.max >= it.min);
  }
  for (const id of NEW_BOOST) {
    const it = itemDef(id);
    assert.ok(STAT_KEYS.includes(it.stat) || it.stat === 'mov', `${id} の能力 ${it.stat}`);
    assert.ok(it.amount > 0);
  }
});

test('ブレイブ：予報で「連撃」が立つ（速さによらず）', () => {
  const r = new RNG(2);
  const slow = createUnit({ classId: 'general', level: 10, items: ['brave_lance'], side: 'player', statBoost: { spd: -5 } }, r.derive('a'));
  const fast = createUnit({ classId: 'swordmaster', level: 14, items: ['iron_sword'], side: 'enemy', statBoost: { spd: 10 } }, r.derive('b'));
  const b = new Board(4, 1); b.add(slow, 1, 0); b.add(fast, 2, 0); b.rebuildIndex();
  const fc = forecast(slow, fast, b);
  assert.equal(fc.doubles, true, '連射の得物は遅くても二撃');
});

test('ブレイブ：一手で二度当たる', () => {
  const r = new RNG(4);
  const att = createUnit({ classId: 'hero', level: 12, items: ['brave_sword'], side: 'player', statBoost: { spd: -6, skl: 10 } }, r.derive('a'));
  const def = createUnit({ classId: 'knight', level: 12, items: ['iron_lance'], side: 'enemy', statBoost: { spd: 10 } }, r.derive('d'));
  const b = new Board(4, 1); b.add(att, 1, 0); b.add(def, 2, 0); b.rebuildIndex();
  addStatus(def, 'sleep', 3);                  // 眠らせて必中・反撃なしにして撃数を数える
  const { events } = resolveCombat(att, def, b, new RNG(9));
  const hitsByAtt = events.filter(e => (e.type === 'hit' || e.type === 'crit') && e.by === att.uid).length;
  assert.equal(hitsByAtt, 2, 'ブレイブで二撃（速さ追撃なしでも）');
});

test('ブレイブ弓は飛行に特効', () => {
  const it = itemDef('brave_bow');
  assert.ok(it.brave && it.eff && it.eff.includes('fly'));
});

test('魔の名品：エクリプスとルーンは魔法武器', () => {
  assert.ok(isMagicType(itemDef('eclipse').wtype));
  assert.ok(itemDef('rune_sword').magic && itemDef('rune_sword').drain);
});

test('毒の短剣は状態異常を付与する設定を持つ', () => {
  const it = itemDef('venom_dagger');
  assert.equal(it.inflict.id, 'poison');
  assert.ok(it.inflict.chance > 0);
});
