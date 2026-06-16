/* ============================================================
   陣 — 試練の塔。種ひとつから、果てのない登攀を布く。
   一層ごとに敵は格を増し、五層ごとに塔守（ボス）が立ちはだかる。
   物語にも拠点にも触れぬ——同じ種・同じ層なら、何度でも同じ一戦。
   登りつめた最高到達層だけが、静かに記録に残る。
   ============================================================ */

import { RNG } from './rng.js';
import { generateMap } from './mapgen.js';
import { generateEnemies, placeBoss } from './enemies.js';
import { Battle } from './battle.js';
import { weatherForChapter } from './weather.js';
import { makeSkirmishSquad, SKIRMISH_SIZES } from './skirmish.js';

/* 層ごとに巡る地勢。登るほどに景色が移ろう。 */
const TOWER_BIOMES = ['green', 'ruins', 'snow', 'desert', 'volcano'];

/* 塔守（五層ごとのボス）。最奥に近いほど、強き名が現れる。 */
const TOWER_BOSSES = [
  { classId: 'general',    name: '塔守ガロン',     items: ['steel_lance'] },
  { classId: 'swordmaster', name: '剣鬼サイガ',    items: ['killing_edge'] },
  { classId: 'sniper',     name: '射手頭ヴェルナ', items: ['killer_bow'] },
  { classId: 'sage',       name: '塔の賢者モルド', items: ['elfire'] },
  { classId: 'wyvernlord', name: '竜将バルガス',   items: ['silver_lance'] },
  { classId: 'sorcerer',   name: '闇導師ネクト',   items: ['flux'] },
  { classId: 'hero',       name: '塔頂の勇カイル', items: ['silver_sword'] },
  { classId: 'greatlord',  name: '簒奪の影',       items: ['killing_edge'] },
];

/* 層番号（1始まり）から、その層の仕様を決める（決定的）。 */
export function floorSpec(floor) {
  const f = Math.max(1, floor | 0);
  const isBoss = f % 5 === 0;
  // 格は登るほど上がる。塔守の層はさらに一段重い。
  const level = Math.min(60, 4 + Math.round(f * 1.6) + (isBoss ? 2 : 0));
  // 広さは段階的に広がる。
  const size = f >= 15 ? 'large' : f >= 7 ? 'medium' : 'small';
  // 魔物が混じる層（三層ごと、ただし塔守層は通常兵）。
  const monster = !isBoss && f % 3 === 0;
  const biome = TOWER_BIOMES[(f - 1) % TOWER_BIOMES.length];
  const spec = { floor: f, level, size, biome, monster, isBoss };
  if (isBoss) {
    const b = TOWER_BOSSES[((f / 5) - 1) % TOWER_BOSSES.length];
    spec.boss = { ...b, level: Math.min(60, level + 3) };
  }
  return spec;
}

/* 層の称（記録・表示用）。 */
export function floorTitle(floor) {
  const s = floorSpec(floor);
  return s.isBoss ? `試練の塔 ${s.floor}層・塔守の間` : `試練の塔 ${s.floor}層`;
}

function hashOf(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }

/* 塔の一層を布く。{ battle, board, squad, spec } を返す。 */
export function makeTowerFloor(seed, floor, opts = {}) {
  const spec = floorSpec(floor);
  const master = new RNG(((seed >>> 0) ^ hashOf('tower' + spec.floor)) >>> 0);
  const sz = SKIRMISH_SIZES[spec.size] || SKIRMISH_SIZES.medium;
  const objective = spec.isBoss ? 'defeat_boss' : 'rout';

  const gen = generateMap(master.derive('map'), { w: sz.w, h: sz.h, biome: spec.biome, objective, enemyCount: sz.enemies });
  const board = gen.board;

  const squad = makeSkirmishSquad(seed, spec.level);
  squad.forEach((u, i) => {
    const t = gen.deploy[i % gen.deploy.length] || gen.deploy[0] || { x: 1, y: 1 };
    board.add(u, t.x, t.y);
  });

  generateEnemies(master.derive('foe'), board, gen.spawns, { chapter: spec.level, level: spec.level, monster: spec.monster });

  let obj = gen.objective;
  if (spec.boss) {
    const seat = (obj.type === 'seize' && obj.x != null) ? { x: obj.x, y: obj.y }
      : (gen.spawns[gen.spawns.length - 1] || { x: board.w - 2, y: (board.h / 2) | 0 });
    const occ = board.unitAt(seat.x, seat.y); if (occ) board.remove(occ);
    const boss = placeBoss(master.derive('boss'), board, { ...spec.boss, pos: seat });
    obj = { type: 'defeat_boss', uid: boss.uid };
  }
  board.rebuildIndex();
  board.weather = weatherForChapter(seed, spec.floor, spec.biome);

  const battle = new Battle(board, {
    rng: master.derive('fight'), objective: obj, initiative: !!opts.initiative, expectLord: true,
  });
  return { battle, board, squad, spec };
}
