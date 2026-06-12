/* ============================================================
   交易 — 都市は近くの都市と結びつく。
   富と技術を運び、国と国を和らげ、そして疫病も運ぶ。
   ============================================================ */

const TRADE_RANGE = 42;   // タイル距離
const MAX_LINKS = 3;

/* 全都市の交易網を組み直す（数年ごとに呼ぶ）。
   返り値は [idA, idB] のペア一覧（描画・疫病伝播に使う）。 */
export function rebuildTrade(world) {
  const pairs = [];
  const seen = new Set();
  for (const s of world.settlements) s.tradeLinks = [];

  for (const s of world.settlements) {
    if (s.pop < 250) continue;
    // 距離順に近い相手を選ぶ
    const others = world.settlements
      .filter(o => o !== s && o.pop >= 250)
      .map(o => {
        const dx = o.x - s.x, dy = o.y - s.y;
        return { o, d2: dx * dx + dy * dy };
      })
      .filter(e => e.d2 < TRADE_RANGE * TRADE_RANGE)
      .sort((a, b) => a.d2 - b.d2)
      .slice(0, MAX_LINKS);
    for (const { o } of others) {
      const key = s.id < o.id ? `${s.id}:${o.id}` : `${o.id}:${s.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push([s.id, o.id]);
      s.tradeLinks.push(o.id);
      o.tradeLinks.push(s.id);
    }
  }
  world.tradePairs = pairs;
  return pairs;
}

/* 国境を越える交易は関係を温める。国ごとの対外リンク数も数える。 */
export function tradeDiplomacy(world) {
  const external = new Map(); // nationId -> 対外交易リンク数
  for (const [a, b] of world.tradePairs) {
    const sa = world.settlementById.get(a);
    const sb = world.settlementById.get(b);
    if (!sa || !sb) continue;
    if (sa.nationId && sb.nationId && sa.nationId !== sb.nationId) {
      world.adjustRelation(sa.nationId, sb.nationId, +1.2);
      external.set(sa.nationId, (external.get(sa.nationId) || 0) + 1);
      external.set(sb.nationId, (external.get(sb.nationId) || 0) + 1);
    }
  }
  return external;
}
