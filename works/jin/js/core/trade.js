/* ============================================================
   陣 — 交易。土地（biome）ごとに相場が違う。安く仕入れ、高く売る。
   戦には使えぬ「交易品」を持ち越し、次の章の土地で利ざやを取る。
   コアは DOM 非依存。
   ============================================================ */

/* base：基準価格。mod：土地ごとの倍率（産地は安く、遠国は高い）。 */
export const TRADE_GOODS = [
  { id: 'spice', name: '香辛料', base: 600, mod: { desert: 0.6, green: 1.0, ruins: 1.2, volcano: 1.3, snow: 1.6 } },
  { id: 'fur', name: '毛皮', base: 500, mod: { snow: 0.6, green: 1.0, ruins: 1.1, volcano: 1.4, desert: 1.6 } },
  { id: 'ore', name: '鉄鉱', base: 400, mod: { volcano: 0.6, ruins: 1.0, desert: 1.1, green: 1.2, snow: 1.3 } },
  { id: 'silk', name: '絹', base: 800, mod: { green: 0.7, volcano: 1.1, desert: 1.2, snow: 1.3, ruins: 1.4 } },
  { id: 'relic', name: '古物', base: 1000, mod: { ruins: 0.6, snow: 1.2, green: 1.3, desert: 1.3, volcano: 1.5 } },
  { id: 'salt', name: '塩', base: 300, mod: { green: 0.8, snow: 1.0, ruins: 1.1, desert: 1.3, volcano: 1.5 } },
];
const GOOD = {};
for (const g of TRADE_GOODS) GOOD[g.id] = g;
export function tradeGood(id) { return GOOD[id] || null; }

/* その土地での値段 */
export function tradePrice(id, biome) {
  const g = GOOD[id]; if (!g) return 0;
  return Math.round(g.base * (g.mod[biome] || 1));
}
/* いまの章の土地 */
export function currentBiome(game) {
  const ch = game.chapter || (game.constructor && game.chapterIndex != null ? null : null);
  return (game.chapter && game.chapter.biome) || 'green';
}

export function canBuyGood(game, id, biome) {
  return game.gold >= tradePrice(id, biome);
}
export function buyGood(game, id, biome) {
  const cost = tradePrice(id, biome);
  if (!GOOD[id] || game.gold < cost) return false;
  game.gold -= cost;
  (game.tradeGoods = game.tradeGoods || []).push(id);
  return true;
}
export function holdings(game) {
  const h = {};
  for (const id of (game.tradeGoods || [])) h[id] = (h[id] || 0) + 1;
  return h;
}
export function sellGood(game, id, biome) {
  const list = game.tradeGoods || [];
  const i = list.indexOf(id);
  if (i < 0) return false;
  game.gold += tradePrice(id, biome);
  list.splice(i, 1);
  return true;
}
