/* ============================================================
   窟 — 店。地の底にも商人はいる。金を出せば品が買える。
   品には値札がつく（item.data.price）。払わず持ち去ろうとすると、
   店主は牙を剥く。
   ============================================================ */

const BASE = { weapon: 80, armor: 90, potion: 45, scroll: 55, wand: 160, ring: 210, food: 16, amulet: 0 };

/* その品の言い値 */
export function priceOf(item, depth) {
  const d = item.d;
  let p = (BASE[d.category] || 40) + depth * 8;
  if (d.enchantable) p += (item.enchant || 0) * 40;
  if (item.charges != null) p += item.charges * 12;
  if (d.rarity) p += Math.max(0, (9 - d.rarity)) * 8;
  if (item.count > 1) p *= item.count;
  if (item.cursed) p = Math.round(p * 0.5);
  return Math.max(5, Math.round(p));
}

/* 床の品に値札をつける */
export function tagForSale(item, depth) {
  item.data = item.data || {};
  item.data.shop = true;
  item.data.price = priceOf(item, depth);
  return item;
}

export function isForSale(item) { return !!(item.data && item.data.shop); }
export function priceTag(item) { return item.data ? item.data.price : 0; }
