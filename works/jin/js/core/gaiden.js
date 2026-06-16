/* ============================================================
   陣 — 外伝。本筋（全16章）の外で語られる、独立した戦記。
   演習の基盤を借りつつ、題と物語と小ボス・目標を持つ名物シナリオ群。
   キャンペーンの保存からは独立——同じ種なら何度でも同じ一戦。
   ============================================================ */

import { RNG } from './rng.js';
import { generateMap } from './mapgen.js';
import { generateEnemies, placeBoss } from './enemies.js';
import { Battle } from './battle.js';
import { weatherForChapter } from './weather.js';
import { makeSkirmishSquad, SKIRMISH_SIZES } from './skirmish.js';
import { EXTRA_GAIDEN } from './gaiden_extra.js';
import { EXTRA_GAIDEN2 } from './gaiden_extra2.js';

/* 外伝シナリオ（純粋なデータ）。 */
export const GAIDEN = [
  { id: 'iron', title: '外伝・鉄の試練', biome: 'green', size: 'small', level: 6, objective: 'rout',
    boss: { classId: 'hero', name: '試練の番兵ロガ', level: 9 },
    intro: '辺境の修練場。鉄の番兵が、挑む者すべてを試す。', outro: '番兵は膝をついた。「よき腕だ」と、たしかに聞こえた。' },
  { id: 'caravan', title: '外伝・砂漠の隊商', biome: 'desert', size: 'medium', level: 10, objective: 'defeat_boss',
    boss: { classId: 'berserker', name: '砂賊頭ガルバ', level: 14, items: ['steel_axe'] },
    intro: '隊商を襲う砂賊の頭を討て。熱砂が刃を鈍らせる。', outro: '砂賊は散り、隊商の鈴がまた鳴りはじめた。' },
  { id: 'icecave', title: '外伝・氷窟の魔', biome: 'snow', size: 'medium', level: 14, objective: 'defeat_boss', monster: true,
    boss: { classId: 'sorcerer', name: '氷霊術師ネイア', level: 18, items: ['nosferatu'] },
    intro: '凍てつく窟に、屍と霊を操る術師が棲む。', outro: '氷が割れ、囚われた光がこぼれ出た。' },
  { id: 'dragonshrine', title: '外伝・火竜の祠', biome: 'volcano', size: 'large', level: 18, objective: 'defeat_boss', monster: true,
    boss: { classId: 'wyvernlord', name: '祠守ヴェルガ', level: 24, items: ['steel_lance'] },
    intro: '火竜を祀る祠。鱗の守り手が、空から見下ろす。', outro: '祠は鎮まり、熱気の奥に古い静けさが戻った。' },
  { id: 'echoes', title: '外伝・禁書の残響', biome: 'ruins', size: 'large', level: 22, objective: 'seize',
    boss: { classId: 'sorcerer', name: '頁を継ぐ者', level: 26, items: ['nosferatu'] },
    intro: '禁書は閉じたはずだ。だが廃都の玉座に、まだ頁をめくる声がする。玉座を制せ。',
    outro: '声は途切れた。残響もまた、静かに消えていった。' },
];

/* 続編の外伝群を合流させる（題と物語だけのデータ）。 */
GAIDEN.push(...EXTRA_GAIDEN);
GAIDEN.push(...EXTRA_GAIDEN2);

export function gaidenById(id) { return GAIDEN.find(s => s.id === id) || null; }

function hashOf(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }

/* 外伝の一戦を布く。{ battle, board, squad, scenario } を返す。 */
export function makeGaiden(scenario, seed, opts = {}) {
  const idx = GAIDEN.indexOf(scenario);
  const master = new RNG(((seed >>> 0) ^ hashOf(scenario.id)) >>> 0);
  const sz = SKIRMISH_SIZES[scenario.size] || SKIRMISH_SIZES.medium;
  const gen = generateMap(master.derive('map'), { w: sz.w, h: sz.h, biome: scenario.biome, objective: scenario.objective, enemyCount: sz.enemies });
  const board = gen.board;

  const squad = makeSkirmishSquad(seed, scenario.level);
  squad.forEach((u, i) => {
    const t = gen.deploy[i % gen.deploy.length] || gen.deploy[0] || { x: 1, y: 1 };
    board.add(u, t.x, t.y);
  });

  generateEnemies(master.derive('foe'), board, gen.spawns, { chapter: scenario.level, level: scenario.level, monster: !!scenario.monster });

  let objective = gen.objective;
  if (scenario.boss) {
    const seat = (objective.type === 'seize' && objective.x != null) ? { x: objective.x, y: objective.y }
      : (gen.spawns[gen.spawns.length - 1] || { x: board.w - 2, y: (board.h / 2) | 0 });
    const occ = board.unitAt(seat.x, seat.y); if (occ) board.remove(occ);
    const boss = placeBoss(master.derive('boss'), board, { ...scenario.boss, pos: seat });
    if (scenario.objective === 'defeat_boss') objective = { type: 'defeat_boss', uid: boss.uid };
  }
  board.rebuildIndex();
  board.weather = weatherForChapter(seed, idx + 1, scenario.biome);

  const battle = new Battle(board, {
    rng: master.derive('fight'), objective, initiative: !!opts.initiative, expectLord: true,
  });
  return { battle, board, squad, scenario };
}
