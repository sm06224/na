import { KIND } from './chronicle.js';

/* ============================================================
   戦争と外交 — 国境の摩擦は不信を育て、不信はやがて火を噴く。
   会戦は抽象化され、勝敗は国力と運が決める。
   都市は陥落し、国は削られ、疲れ果てて和平を結ぶ。
   ============================================================ */

const WAR_THRESHOLD = -55;     // 関係がここを割ると開戦の危険
const MAX_WAR_YEARS = 18;      // これ以上続く戦争はない（厭戦）

export function relationKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/* 1 年ぶんの外交。frictions は国境の接触数 Map(key→count)。 */
export function stepDiplomacy(world, frictions) {
  const alive = world.aliveNations();
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const A = alive[i], B = alive[j];
      const key = relationKey(A.id, B.id);
      let rel = world.relations.get(key);
      if (!rel) { rel = { val: 0, war: false, score: 0, since: 0 }; world.relations.set(key, rel); }

      const friction = frictions.get(key) || 0;
      // 国境の摩擦は関係を蝕み、何もなければゆっくり水に流れる
      rel.val += -friction * 0.55 - world.rng.float(0, 1.5);
      rel.val += (0 - rel.val) * 0.06;
      rel.val = Math.max(-100, Math.min(100, rel.val));

      if (!rel.war && rel.val < WAR_THRESHOLD && world.rng.chance(0.22)) {
        rel.war = true;
        rel.score = 0;
        rel.since = world.year;
        world.chronicle.add(world.year, KIND.WAR,
          `${A.name}、${B.name}に宣戦 — ${A.name}・${B.name}戦争はじまる`,
          { nationId: A.id });
      }

      if (rel.war) stepWar(world, A, B, rel, key);
    }
  }
}

function stepWar(world, A, B, rel) {
  const sa = A.strength(world), sb = B.strength(world);
  const total = sa + sb;
  if (total <= 0) { makePeace(world, A, B, rel); return; }

  // 今年の戦況：国力差 + 運
  const swing = (sa - sb) / total + world.rng.gauss(0, 0.3);
  rel.score += swing;

  // 戦争は人を減らし、国を疲れさせる
  for (const N of [A, B]) {
    N.stability = Math.max(0.05, N.stability - 0.03);
    for (const c of N.cities(world)) c.pop *= (1 - world.rng.float(0.005, 0.02));
  }

  // 戦況が一方に大きく傾くと、都市が陥落する
  if (Math.abs(rel.score) > 1.0) {
    const winner = rel.score > 0 ? A : B;
    const loser = rel.score > 0 ? B : A;
    const prize = pickBorderCity(world, loser, winner);
    if (prize) {
      transferCity(world, prize, winner.id);
      world.chronicle.add(world.year, KIND.CONQUEST,
        `${prize.name}陥落 — ${winner.name}の手に落ちる`,
        { cityId: prize.id, nationId: winner.id, x: prize.x, y: prize.y });
      checkFallen(world, loser);
    }
    rel.score = 0;
    // 都市を失うほどの敗北は講和に傾く
    if (world.rng.chance(0.45)) { makePeace(world, A, B, rel); return; }
  }

  // 厭戦・偶発の講和
  const years = world.year - rel.since;
  if (years > MAX_WAR_YEARS || world.rng.chance(0.08 + years * 0.01)) {
    makePeace(world, A, B, rel);
  }
}

function makePeace(world, A, B, rel) {
  rel.war = false;
  rel.val = Math.max(rel.val, -15);
  if (A.fallenAt === null && B.fallenAt === null) {
    world.chronicle.add(world.year, KIND.PEACE,
      `${A.name}と${B.name}、和平を結ぶ`, { nationId: A.id });
  }
}

/* 勝者の首都に一番近い、敗者の都市を奪う */
function pickBorderCity(world, loser, winner) {
  const cities = loser.cities(world);
  if (cities.length === 0) return null;
  const cap = world.settlementById.get(winner.capitalId);
  if (!cap) return world.rng.pick(cities);
  let best = null, bestD = Infinity;
  for (const c of cities) {
    const dx = c.x - cap.x, dy = c.y - cap.y;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function transferCity(world, city, newNationId) {
  const old = world.nations.get(city.nationId);
  city.nationId = newNationId;
  city.isCapital = false;
  // 首都を失った国は、残る最大の都市へ遷都する
  if (old && old.capitalId === city.id) {
    const rest = old.cities(world);
    if (rest.length) {
      const next = rest.reduce((a, b) => (a.pop > b.pop ? a : b));
      old.capitalId = next.id;
      next.isCapital = true;
      world.chronicle.add(world.year, KIND.BATTLE,
        `${old.name}、${next.name}へ遷都`, { nationId: old.id, cityId: next.id });
    }
  }
  world.territoryDirty = true;
}

export function checkFallen(world, nation) {
  if (nation.fallenAt !== null) return;
  if (nation.cities(world).length === 0) {
    nation.fallenAt = world.year;
    const span = world.year - nation.founded;
    world.chronicle.add(world.year, KIND.FALL,
      `${nation.name}、滅ぶ（${span} 年の歴史だった）`, { nationId: nation.id });
    // 滅んだ国との関係・戦争はすべて終わる
    for (const [key, rel] of world.relations) {
      const [a, b] = key.split(':').map(Number);
      if (a === nation.id || b === nation.id) rel.war = false;
    }
  }
}
