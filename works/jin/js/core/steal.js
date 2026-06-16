/* ============================================================
   陣 — 盗み。盗賊の手は、刃のかわりに懐をねらう。
   速さが相手より上なら、隣のマスから持ち物をかすめ取る。
   「盗む」は武器以外、「強奪」（盗賊頭）は武器すら奪う。ただし装備中の品は取れぬ。
   一切の判定は決定的（速さ比べと持ち物だけで決まり、運に拠らない）。
   ============================================================ */

import { effectiveStats, hasSkill, isAlive, autoEquip } from './unit.js';
import { item as itemDef } from './items.js';
import { manhattan } from './grid.js';
import { MAX_ITEMS } from './party.js';

export function stealSpeed(u) { return effectiveStats(u).spd; }

/* この者は盗みの心得があるか。 */
export function canSteal(thief) {
  return hasSkill(thief, 'steal') || hasSkill(thief, 'pickpocket');
}

/* 相手から盗める持ち物の索引（装備中は不可、武器は強奪のみ）。 */
export function stealableItems(thief, target) {
  if (!canSteal(thief) || !target.items) return [];
  if (stealSpeed(thief) <= stealSpeed(target)) return [];      // 速さが上でないと盗めない
  if ((thief.items ? thief.items.length : 0) >= MAX_ITEMS) return [];   // 持ちきれない
  const canWeapon = hasSkill(thief, 'pickpocket');
  const idx = [];
  target.items.forEach((st, i) => {
    if (i === target.equipped) return;                         // 装備中は盗めない
    const it = itemDef(st.id);
    if (!it) return;
    if (it.kind === 'weapon' && !canWeapon) return;            // 「盗む」は武器以外
    idx.push(i);
  });
  return idx;
}

/* この間合い（隣接）で盗める相手。 */
export function stealTargetsFrom(board, thief, pos) {
  if (!canSteal(thief)) return [];
  return board.enemiesOf(thief).filter(e =>
    isAlive(e) && e.pos && manhattan(pos, e.pos) === 1 && stealableItems(thief, e).length > 0);
}

/* 盗みを遂行。{ item } を返す。盗賊・相手の装備整合も取る。 */
export function resolveSteal(thief, target, itemIndex) {
  const st = target.items[itemIndex];
  if (!st) return null;
  target.items.splice(itemIndex, 1);
  if (target.equipped > itemIndex) target.equipped -= 1;       // 索引のずれを直す
  thief.items.push({ id: st.id, uses: st.uses });
  autoEquip(target);                                           // 念のため再装備
  return { item: st.id };
}
