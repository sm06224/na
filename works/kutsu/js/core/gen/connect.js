/* ============================================================
   窟 — 連結の保証。どんな彫り方でも、すべての床がひとつに繋がるよう、
   離れ小島どうしを最短のあたりで掘り抜く。
   ============================================================ */

import { T } from '../tile.js';
import { tunnelL } from './carve.js';

/* すべての歩ける領域を、いちばん大きい領域へ繋ぐ。 */
export function ensureConnected(level, rng) {
  let guard = 0;
  while (guard++ < 40) {
    const regions = level.walkableRegions();
    if (regions.length <= 1) break;
    regions.sort((a, b) => b.length - a.length);
    const main = regions[0];
    // 主領域に最も近い小島を選び、最近セルどうしを結ぶ
    let bestRegion = null, bestA = null, bestB = null, bestD = Infinity;
    for (let r = 1; r < regions.length; r++) {
      const reg = regions[r];
      // 標本を絞って総当たりを軽く
      const sa = sample(reg, rng, 24), sb = sample(main, rng, 24);
      for (const a of sa) for (const b of sb) {
        const d = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
        if (d < bestD) { bestD = d; bestA = a; bestB = b; bestRegion = reg; }
      }
    }
    if (!bestA) break;
    tunnelL(level, bestA.x, bestA.y, bestB.x, bestB.y, rng, T.CORRIDOR);
  }
}

function sample(arr, rng, k) {
  if (arr.length <= k) return arr;
  const out = [];
  for (let i = 0; i < k; i++) out.push(arr[rng.int(arr.length)]);
  return out;
}
