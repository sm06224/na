/* ============================================================
   陣 — 店。章を進めるごとに、扱う品が増える。買えば荷駄（convoy）に入る。
   品揃えは種から決定的。売値は買値の半分。コアは DOM 非依存。
   ============================================================ */

import { ITEMS, ITEM_LIST, item } from './items.js';
import { RNG } from './rng.js';

/* つねに買える基本の品 */
const STAPLES = ['vulnerary', 'concoction', 'iron_sword', 'iron_lance', 'iron_axe', 'iron_bow', 'fire', 'heal', 'antitoxin'];

/* 章ごとの品揃え（基本＋その深さで解禁される品を種で選ぶ） */
export function shopStock(game, chapterIndex = game.chapterIndex) {
  const tier = chapterIndex;                       // 深いほど高位の品まで
  const maxPrice = 600 + chapterIndex * 700;
  const rng = new RNG((game.seed ^ 0x5f3a91 ^ (chapterIndex * 2654435761)) >>> 0);
  const pool = ITEM_LIST.filter(it => {
    if (STAPLES.includes(it.id)) return false;
    if (it.kind === 'weapon' || it.kind === 'consumable' || it.kind === 'accessory' || it.kind === 'booster') {
      return (it.price || 0) <= maxPrice;
    }
    return false;
  });
  const chosen = rng.shuffle(pool).slice(0, 8 + Math.min(10, chapterIndex * 2)).map(it => it.id);
  const ids = [...STAPLES, ...chosen];
  // 重複を除き、存在する品のみ
  return [...new Set(ids)].filter(id => ITEMS[id]);
}

export function canBuy(game, id) {
  const it = item(id);
  return !!it && game.gold >= (it.price || 0);
}
export function buy(game, id) {
  const it = item(id);
  if (!it || game.gold < (it.price || 0)) return false;
  game.gold -= it.price || 0;
  game.convoy.push(id);
  return true;
}
export function sellPrice(id) {
  const it = item(id);
  return it ? Math.floor((it.price || 0) / 2) : 0;
}
export function sellFromConvoy(game, index) {
  const id = game.convoy[index];
  if (id == null) return false;
  game.gold += sellPrice(id);
  game.convoy.splice(index, 1);
  return true;
}
