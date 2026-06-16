/* ============================================================
   陣 — 鍛冶。拠点の炉で、得物を鍛え直す。
   一段ごとに威力・命中・会心がわずかに増し、最大五段まで。
   強化は得物の一本一本（持ち物の口）に宿り、符号（セーブ）に綴じられる。
   段が上がるほど次の鍛えは高くつく。決定的——同じ段は同じ上乗せ。
   ============================================================ */

export const MAX_FORGE = 5;

/* 段ごとの上乗せ（威力＋1／命中＋3／会心＋1 ずつ）。 */
export function forgeBonus(level) {
  const f = Math.max(0, Math.min(MAX_FORGE, level | 0));
  return { mt: f, hit: f * 3, crit: f };
}

/* 段 level から level+1 へ鍛える費用。 */
export function forgeCost(level) {
  return 500 + (level | 0) * 500;     // 1段目500・2段目1000…5段目2500
}

/* 装備中の得物の口（スタック）。 */
export function weaponStack(unit) {
  if (!unit.items || unit.equipped == null || unit.equipped < 0) return null;
  return unit.items[unit.equipped] || null;
}

export function forgeLevelOf(stack) { return (stack && stack.forge) | 0; }

export function isForgeable(item) {
  return !!item && item.kind === 'weapon' && item.wtype !== 'staff';
}

/* この口を、いま鍛えられるか（鍛冶可能・上限未満・金が足りる）。 */
export function canForge(game, stack, item) {
  if (!isForgeable(item) || !stack) return false;
  const lv = forgeLevelOf(stack);
  return lv < MAX_FORGE && game.gold >= forgeCost(lv);
}

/* 鍛える。金を払い、口の段を一つ上げる。{ level, cost } を返す。 */
export function applyForge(game, stack) {
  const lv = forgeLevelOf(stack);
  const cost = forgeCost(lv);
  game.gold -= cost;
  stack.forge = lv + 1;
  return { level: stack.forge, cost };
}
