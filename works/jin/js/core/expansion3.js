/* ============================================================
   陣 — 拡張その三：さらなる上級職。
   既存の登録簿（CLASSES）に追記し、対応する一段職の promotesTo へ繋ぐ。
   tier:2・enemyOnly でない職は、拠点の上級転職／ジョブ（再クラス）に並ぶ。
   combat/unit はクラスの欄を汎用に読むので、新しい職はそのまま戦える。
   既出の上級職（classes / expansion / expansion2）と重ならぬ六種。
   ============================================================ */

import { CLASSES } from './classes.js';

function cls(o) { o.caps = o.caps || {}; CLASSES[o.id] = o; return o; }

/* この拡張で足した上級職の id（テスト等が参照する） */
export const EXPANSION3_CLASSES = ['warlord', 'ravager', 'nightcaller', 'lightsage', 'skylord', 'windrider'];

/* ---- さらなる上級職（いずれも tier:2・味方も就ける） ---- */
cls({
  id: 'warlord', name: '大将', tier: 2, mode: 'foot', mov: 6,
  weapons: { axe: 'S', lance: 'A' }, skills: ['colossus', 'rally'],
  bases: { hp: 40, str: 19, mag: 3, skl: 14, spd: 13, lck: 11, def: 16, res: 9 },
  growths: { hp: 75, str: 55, mag: 8, skl: 40, spd: 35, lck: 35, def: 40, res: 22 },
  promotesTo: [], desc: '幾多の戦を率いた猛者。斧と槍を振るい、味方を鼓舞して前へ押し出す。',
});
cls({
  id: 'ravager', name: '鬼神', tier: 2, mode: 'foot', mov: 6,
  weapons: { axe: 'S' }, skills: ['wrath', 'vengeance'],
  bases: { hp: 42, str: 21, mag: 2, skl: 13, spd: 16, lck: 8, def: 12, res: 7 },
  growths: { hp: 80, str: 60, mag: 5, skl: 40, spd: 45, lck: 25, def: 28, res: 18 },
  promotesTo: [], desc: '怒りを力に変える荒武者。傷つくほどに刃は冴え、復讐の一撃は鬼神のごとし。',
});
cls({
  id: 'nightcaller', name: '宵闇導師', tier: 2, mode: 'mage', mov: 6,
  weapons: { dark: 'S', anima: 'B' }, skills: ['luna', 'vengeance'],
  bases: { hp: 32, str: 4, mag: 19, skl: 15, spd: 14, lck: 9, def: 9, res: 17 },
  growths: { hp: 58, str: 5, mag: 60, skl: 45, spd: 42, lck: 30, def: 20, res: 48 },
  promotesTo: [], desc: '宵闇に理を呼ぶ術師。月光で守りを割き、痛みを糧に闇を撃つ。',
});
cls({
  id: 'lightsage', name: '光聖者', tier: 2, mode: 'foot', mov: 6,
  weapons: { light: 'S', staff: 'A' }, skills: ['sol', 'miracle'],
  bases: { hp: 32, str: 4, mag: 18, skl: 15, spd: 15, lck: 15, def: 10, res: 19 },
  growths: { hp: 56, str: 6, mag: 55, skl: 45, spd: 45, lck: 50, def: 20, res: 52 },
  promotesTo: [], desc: '光の理を究めた聖者。傷を吸う陽光を放ち、祈りで仲間を死の淵から引き戻す。',
});
cls({
  id: 'skylord', name: '飛将', tier: 2, mode: 'fly', mov: 8,
  weapons: { lance: 'A', axe: 'A' }, skills: ['aether', 'pavise'],
  bases: { hp: 38, str: 18, mag: 5, skl: 15, spd: 15, lck: 10, def: 15, res: 11 },
  growths: { hp: 70, str: 50, mag: 10, skl: 45, spd: 45, lck: 30, def: 38, res: 28 },
  promotesTo: [], desc: '竜を統べる空の将。槍斧を携えて天より降り、天空の一撃で大盾を砕く。',
});
cls({
  id: 'windrider', name: '風駆', tier: 2, mode: 'fly', mov: 9,
  weapons: { sword: 'A', lance: 'B' }, skills: ['adept', 'bond'],
  bases: { hp: 32, str: 14, mag: 6, skl: 18, spd: 20, lck: 16, def: 11, res: 16 },
  growths: { hp: 58, str: 42, mag: 12, skl: 55, spd: 60, lck: 45, def: 24, res: 36 },
  promotesTo: [], desc: '風を駆る天馬の名手。連撃を冴えさせ、絆を力に変えて空を翔ける。',
});

/* 一段職の昇格先に繋ぐ（上級転職で選べるように） */
const link = (from, to) => { const c = CLASSES[from]; if (!c) return; if (!c.promotesTo) c.promotesTo = []; if (!c.promotesTo.includes(to)) c.promotesTo.push(to); };
link('fighter', 'warlord'); link('warrior', 'warlord');
link('brigand', 'ravager'); link('fighter', 'ravager');
link('shaman', 'nightcaller');
link('monk', 'lightsage'); link('cleric', 'lightsage');
link('wyvern', 'skylord');
link('pegasus', 'windrider');
