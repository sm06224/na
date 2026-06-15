import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/core/game.js';
import { serialize, deserialize, encodeSave, decodeSave } from '../js/core/save.js';
import { shopStock, buy, canBuy, sellFromConvoy, sellPrice } from '../js/core/shop.js';
import { giveItem, takeItem, equipItem, useBooster, MAX_ITEMS, canPromote, doPromote } from '../js/core/party.js';
import { item } from '../js/core/items.js';
import { gainExp, equippedWeapon } from '../js/core/unit.js';

/* ---- 保存・復元 ---- */
test('保存→復元：軍も所持も章も、そっくり戻る', () => {
  const g = new Game(20260615);
  g.gold = 1234; g.chapterIndex = 3; g.convoy.push('silver_sword');
  g.party[1].hp = 7;                              // 手負い
  const code = encodeSave(g);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  const g2 = decodeSave(code);
  assert.equal(g2.seed, g.seed);
  assert.equal(g2.gold, 1234);
  assert.equal(g2.chapterIndex, 3);
  assert.deepEqual(g2.convoy, g.convoy);
  assert.equal(g2.party.length, g.party.length);
  assert.equal(g2.party[1].hp, 7);
  assert.equal(g2.party[0].isLord, true);
  assert.deepEqual(g2.party[0].statsBase, g.party[0].statsBase);
});

test('死者は死者のまま復元される', () => {
  const g = new Game(7);
  g.party[2].hp = 0;
  const g2 = deserialize(serialize(g));
  assert.equal(g2.party[2].hp, 0);
  assert.equal(g2.livingParty().length, g.party.length - 1);
});

test('壊れた符号は弾く', () => {
  assert.throws(() => decodeSave('!!!notbase64!!!'));
});

/* ---- 店 ---- */
test('店：品揃えは決定的、基本の品は必ず並ぶ', () => {
  const g = new Game(42);
  const a = shopStock(g, 2), b = shopStock(g, 2);
  assert.deepEqual(a, b);
  assert.ok(a.includes('vulnerary') && a.includes('iron_sword'));
  assert.ok(a.every(id => item(id)), '実在する品だけ');
  assert.ok(shopStock(g, 6).length >= a.length, '深い章ほど品が増える');
});
test('店：買えば金が減り荷駄に入る、売れば半値で戻る', () => {
  const g = new Game(1); g.gold = 1000; g.convoy = [];
  const before = g.gold;
  assert.ok(canBuy(g, 'iron_sword'));
  assert.ok(buy(g, 'iron_sword'));
  assert.equal(g.gold, before - item('iron_sword').price);
  assert.deepEqual(g.convoy, ['iron_sword']);
  const g2gold = g.gold;
  assert.ok(sellFromConvoy(g, 0));
  assert.equal(g.gold, g2gold + sellPrice('iron_sword'));
  assert.equal(g.convoy.length, 0);
  // 金が足りなければ買えない
  g.gold = 0; assert.ok(!canBuy(g, 'silver_sword')); assert.ok(!buy(g, 'silver_sword'));
});

/* ---- 編成 ---- */
test('編成：荷駄と持ち物のやりとり、上限を守る', () => {
  const g = new Game(5); g.convoy = ['steel_sword', 'vulnerary'];
  const u = g.party[0];
  const n0 = u.items.length;
  assert.ok(giveItem(g, u, 0));
  assert.equal(u.items.length, n0 + 1);
  // 上限まで詰める
  while (u.items.length < MAX_ITEMS) u.items.push({ id: 'vulnerary', uses: 3 });
  g.convoy.push('iron_axe');
  assert.ok(!giveItem(g, u, g.convoy.length - 1), '満杯なら渡せない');
  // 戻す
  const c0 = g.convoy.length;
  assert.ok(takeItem(g, u, 0));
  assert.equal(g.convoy.length, c0 + 1);
});
test('編成：扱える得物だけ装備できる', () => {
  const g = new Game(9);
  const mira = g.party.find(u => u.classId === 'mage');
  mira.items.push({ id: 'fire', uses: null });
  mira.items.push({ id: 'iron_axe', uses: null });
  const fireIdx = mira.items.findIndex(i => i.id === 'fire');
  const axeIdx = mira.items.findIndex(i => i.id === 'iron_axe');
  assert.ok(equipItem(mira, fireIdx), '魔道士は理を装備できる');
  assert.ok(!equipItem(mira, axeIdx), '魔道士は斧を装備できない');
});
test('編成：力の雫で力が永続で上がる', () => {
  const g = new Game(3); const u = g.party[0];
  g.convoy = ['energy_drop'];
  const before = u.statsBase.str;
  assert.ok(useBooster(g, u, 0));
  assert.equal(u.statsBase.str, before + item('energy_drop').amount);
  assert.equal(g.convoy.length, 0);
});
test('編成：Lv10 で上級転職できる', () => {
  const g = new Game(11);
  const kai = g.party.find(u => u.classId === 'mercenary');
  assert.ok(!canPromote(kai), '低レベルでは不可');
  kai.level = 12;
  assert.ok(canPromote(kai));
  assert.ok(doPromote(kai, 'hero'));
  assert.equal(kai.classId, 'hero');
  assert.equal(kai.level, 1);
});
