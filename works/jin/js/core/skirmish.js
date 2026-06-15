/* ============================================================
   陣 — 演習（スカーミッシュ）。物語の外で、種ひとつから一発の戦場を布く。
   キャンペーンの育成・拠点・物語からは独立。地勢と広さと格を選べば、
   軍も敵も地形も決定的に立ち上がる。同じ種なら、何度でも同じ一戦。
   ============================================================ */

import { RNG } from './rng.js';
import { generateMap } from './mapgen.js';
import { generateEnemies } from './enemies.js';
import { Battle } from './battle.js';
import { createUnit } from './unit.js';
import { weatherForChapter } from './weather.js';

export const SKIRMISH_BIOMES = ['green', 'desert', 'snow', 'ruins', 'volcano'];

export const SKIRMISH_SIZES = {
  small:  { id: 'small',  name: '小', w: 14, h: 10, enemies: 6 },
  medium: { id: 'medium', name: '中', w: 18, h: 12, enemies: 9 },
  large:  { id: 'large',  name: '大', w: 20, h: 14, enemies: 12 },
};

/* 演習の手勢——主従六騎。職と得物は固定、能力はレベルと種から決まる。 */
const SQUAD = [
  { classId: 'lord',      name: '隊長リン',  items: ['steel_sword', 'vulnerary'], isLord: true },
  { classId: 'knight',    name: 'ガレス',    items: ['steel_lance', 'javelin'] },
  { classId: 'mercenary', name: 'カイ',      items: ['steel_sword'] },
  { classId: 'archer',    name: 'ロウェン',  items: ['steel_bow'] },
  { classId: 'mage',      name: 'ミラ',      items: ['fire', 'thunder'] },
  { classId: 'cleric',    name: 'セラ',      items: ['heal', 'mend'] },
];

/* 演習の手勢を組む（種とレベルから決定的）。 */
export function makeSkirmishSquad(seed, level = 8) {
  const r = new RNG((seed >>> 0) ^ 0x5ec0d1a);
  return SQUAD.map((s, i) => createUnit({ ...s, level, side: 'player' }, r.derive('sq' + i)));
}

/* 演習を布く。{ battle, board, squad, biome, size } を返す。 */
export function makeSkirmish(seed, opts = {}) {
  const { size = 'medium', level = 8, initiative = false, difficulty = 0 } = opts;
  const master = new RNG(seed >>> 0);
  const sz = SKIRMISH_SIZES[size] || SKIRMISH_SIZES.medium;
  const biome = opts.biome || SKIRMISH_BIOMES[master.derive('biome').int(SKIRMISH_BIOMES.length)];

  const gen = generateMap(master.derive('map'), { w: sz.w, h: sz.h, biome, objective: 'rout', enemyCount: sz.enemies });
  const board = gen.board;

  const squad = makeSkirmishSquad(seed, level);
  squad.forEach((u, i) => {
    const t = gen.deploy[i % gen.deploy.length] || gen.deploy[0] || { x: 1, y: 1 };
    board.add(u, t.x, t.y);
  });

  generateEnemies(master.derive('foe'), board, gen.spawns, {
    chapter: Math.max(1, level), level: Math.max(1, level + difficulty), monster: false,
  });
  board.rebuildIndex();
  board.weather = weatherForChapter(seed, 0, biome);

  const battle = new Battle(board, {
    rng: master.derive('fight'), objective: { type: 'rout' }, initiative,
  });
  return { battle, board, squad, biome, size: sz.id, level };
}
