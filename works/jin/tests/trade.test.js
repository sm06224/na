import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/core/game.js';
import { TRADE_GOODS, tradePrice, buyGood, sellGood, holdings, canBuyGood } from '../js/core/trade.js';
import { encodeSave, decodeSave } from '../js/core/save.js';

test('相場：産地は安く、遠国は高い', () => {
  assert.ok(tradePrice('spice', 'desert') < tradePrice('spice', 'snow'), '香辛料は砂漠で安く雪原で高い');
  assert.ok(tradePrice('fur', 'snow') < tradePrice('fur', 'desert'), '毛皮は雪原で安く砂漠で高い');
  for (const g of TRADE_GOODS) assert.ok(tradePrice(g.id, 'green') > 0);
});

test('交易：安い土地で買い、高い土地で売れば儲かる', () => {
  const g = new Game(7); g.gold = 100000;
  const start = g.gold;
  assert.ok(canBuyGood(g, 'spice', 'desert'));
  buyGood(g, 'spice', 'desert');               // 砂漠で安く仕入れ
  assert.equal(holdings(g).spice, 1);
  const afterBuy = g.gold;
  assert.equal(afterBuy, start - tradePrice('spice', 'desert'));
  sellGood(g, 'spice', 'snow');                // 雪原で高く売る
  assert.ok(g.gold > afterBuy + tradePrice('spice', 'desert') - 1, '利ざやが出る');
  assert.equal(holdings(g).spice || 0, 0);
});

test('交易：金がなければ買えない、持っていなければ売れない', () => {
  const g = new Game(3); g.gold = 0;
  assert.ok(!canBuyGood(g, 'relic', 'green'));
  assert.ok(!buyGood(g, 'relic', 'green'));
  assert.ok(!sellGood(g, 'relic', 'green'));
});

test('保存：交易品も復元される', () => {
  const g = new Game(9); g.gold = 100000;
  buyGood(g, 'silk', 'green'); buyGood(g, 'ore', 'volcano');
  const g2 = decodeSave(encodeSave(g));
  assert.deepEqual(g2.tradeGoods.sort(), g.tradeGoods.sort());
});
