import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/core/game.js';
import { jobChoices, reclass, canReclass, RECLASS_COST } from '../js/core/party.js';
import { classDef } from '../js/core/classes.js';
import { canUse, equippedWeapon } from '../js/core/unit.js';
import { item } from '../js/core/items.js';

test('ジョブ：同じ段の職が候補に並ぶ（敵専用・主君は除く）', () => {
  const g = new Game(7);
  const kai = g.party.find(u => u.classId === 'mercenary');
  const ch = jobChoices(kai);
  assert.ok(ch.includes('fighter') && ch.includes('mage'), '一段の職へ移れる');
  assert.ok(!ch.includes('mercenary'), '今の職は除く');
  assert.ok(!ch.includes('brigand'), '敵専用は除く');
  assert.ok(!ch.includes('hero'), '別の段（上級）は混ざらない');
  assert.ok(!jobChoices(g.party[0]).length === false);     // lord は…
  assert.ok(!canReclass(g, g.party[0], 'mercenary'), '主君は転職不可');
});

test('再クラス：金を払って職が変わり、得物の扱いも変わる', () => {
  const g = new Game(9); g.gold = 100000;
  const mira = g.party.find(u => u.classId === 'mage');
  assert.ok(!canUse(mira, item('iron_axe')), '魔道士は斧不可');
  const before = g.gold;
  assert.ok(reclass(g, mira, 'fighter'));
  assert.equal(mira.classId, 'fighter');
  assert.equal(g.gold, before - RECLASS_COST);
  assert.ok(canUse(mira, item('iron_axe')), '戦士になれば斧を扱える');
  // 金が足りねば不可
  g.gold = 0;
  assert.ok(!canReclass(g, mira, 'soldier'));
});

test('保存：再クラス後も復元できる', async () => {
  const { encodeSave, decodeSave } = await import('../js/core/save.js');
  const g = new Game(3); g.gold = 100000;
  const u = g.party.find(x => x.classId === 'archer');
  reclass(g, u, 'thief');
  const g2 = decodeSave(encodeSave(g));
  const u2 = g2.party.find(x => x.name === u.name);
  assert.equal(u2.classId, 'thief');
});
