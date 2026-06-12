import { KIND } from './chronicle.js';

/* ============================================================
   厄災 — 疫病は交易路を旅し、火は都市を舐め、川は溢れる。
   繁栄そのものが、災いの通り道になる。
   ============================================================ */

export function stepDisasters(world) {
  const rng = world.rng;

  /* ---- 疫病の発生：交易の盛んな大都市から ---- */
  if (world.plagueCooldownUntil <= world.year && rng.chance(0.012)) {
    const hubs = world.settlements
      .filter(s => s.pop > 1500 && s.tradeLinks.length >= 2)
      .sort((a, b) => b.pop - a.pop);
    if (hubs.length) {
      const origin = hubs[0];
      infect(world, origin);
      world.plagueCooldownUntil = world.year + 40;
      world.chronicle.add(world.year, KIND.PLAGUE,
        `疫病、${origin.name}に現る`, { cityId: origin.id, x: origin.x, y: origin.y });
    }
  }

  /* ---- 疫病の伝播：交易路に沿って ---- */
  const month = world.totalMonths;
  for (const s of world.settlements) {
    if (s.plagueUntil <= month) continue;
    for (const otherId of s.tradeLinks) {
      const o = world.settlementById.get(otherId);
      if (o && o.plagueUntil <= month && rng.chance(0.22)) infect(world, o);
    }
    // 疫病は国を揺らす
    const n = world.nations.get(s.nationId);
    if (n) n.stability = Math.max(0.05, n.stability - 0.004);
  }

  /* ---- 大火 ---- */
  for (const s of world.settlements) {
    if (s.pop > 2000 && rng.chance(0.004)) {
      const loss = s.pop * rng.float(0.08, 0.2);
      s.pop -= loss;
      world.chronicle.add(world.year, KIND.DISASTER,
        `${s.name}大火 — 街の多くが灰になる`, { cityId: s.id, x: s.x, y: s.y });
    }
  }
}

function infect(world, settlement) {
  settlement.plagueUntil = world.totalMonths + 18 + world.rng.int(18);
}
