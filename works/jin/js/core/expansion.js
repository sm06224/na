/* ============================================================
   陣 — 拡張：さらなる職と、二つの素質。
   既存の登録簿（CLASSES／SKILLS）に追記する（他のファイルは触らない）。
   combat/unit はクラスの欄を汎用に読むので、新しい職はそのまま戦える。
   再生（renewal）と天稟（paragon）は battle.js が実際に効かせる。
   ============================================================ */

import { CLASSES } from './classes.js';
import { SKILLS } from './skills.js';

function cls(o) { o.caps = o.caps || {}; CLASSES[o.id] = o; return o; }
function sk(o) { SKILLS[o.id] = o; return o; }

/* ---- 機能する素質（battle.js が読む） ---- */
sk({ id: 'renewal', name: '再生', kind: 'passive', effect: 'renewal',
  desc: '自分のターンのはじめ、最大HPの2割が癒える。' });
sk({ id: 'paragon', name: '天稟', kind: 'passive', effect: 'paragon',
  desc: '得られる経験が二倍。才ある者の伸び。' });
sk({ id: 'charm', name: '魅力', kind: 'passive', effect: 'charm',
  desc: '周囲三マスの味方の命中・回避がわずかに上がる（旗印）。' });
sk({ id: 'arithmetic', name: '算術', kind: 'command', effect: 'arithmetic',
  desc: '能力値（Lv/HP/守/魔防/速）が「ある数の倍数」の敵を、間合いを問わず全員撃つ。' });

/* ---- 追加の職 ---- */
cls({
  id: 'dancer', name: '踊り子', tier: 1, mode: 'foot', mov: 6,
  weapons: { sword: 'D' }, skills: ['rally', 'charm'],
  bases: { hp: 16, str: 2, mag: 0, skl: 5, spd: 9, lck: 8, def: 2, res: 4 },
  growths: { hp: 55, str: 20, mag: 10, skl: 45, spd: 65, lck: 60, def: 12, res: 35 },
  promotesTo: [], desc: '舞で味方を励ます者。戦わずして戦を変える。',
});
cls({
  id: 'villager', name: '村人', tier: 1, mode: 'foot', mov: 5,
  weapons: { lance: 'E' }, skills: ['paragon'],
  bases: { hp: 16, str: 3, mag: 1, skl: 3, spd: 4, lck: 6, def: 2, res: 1 },
  growths: { hp: 60, str: 40, mag: 20, skl: 40, spd: 45, lck: 60, def: 25, res: 20 },
  promotesTo: ['soldier', 'mercenary', 'fighter', 'archer'],
  desc: '何者でもない者。天稟だけが、すべての可能性をひらく。',
});
cls({
  id: 'bard', name: '吟遊詩人', tier: 1, mode: 'foot', mov: 5,
  weapons: { anima: 'D' }, skills: ['rally', 'renewal'],
  bases: { hp: 17, str: 0, mag: 4, skl: 4, spd: 7, lck: 7, def: 2, res: 5 },
  growths: { hp: 55, str: 5, mag: 40, skl: 40, spd: 55, lck: 55, def: 15, res: 45 },
  promotesTo: [], desc: '詩で士気を保ち、傷を歌で癒す者。',
});
cls({
  id: 'darkflier', name: '闇の天馬', tier: 2, mode: 'fly', mov: 8,
  weapons: { anima: 'A', lance: 'B' }, skills: ['focus'],
  bases: { hp: 26, str: 4, mag: 9, skl: 8, spd: 11, lck: 5, def: 6, res: 10 },
  growths: { hp: 65, str: 25, mag: 50, skl: 45, spd: 55, lck: 40, def: 22, res: 45 },
  desc: '理を操り空を翔ける、稀なる騎手。',
});
cls({
  id: 'dread', name: '魔戦士', tier: 2, mode: 'foot', mov: 6,
  weapons: { sword: 'A', dark: 'B' }, skills: ['nihil', 'sol'],
  bases: { hp: 30, str: 9, mag: 7, skl: 9, spd: 9, lck: 5, def: 7, res: 9 },
  growths: { hp: 80, str: 45, mag: 35, skl: 50, spd: 50, lck: 30, def: 30, res: 35 },
  desc: '剣と闇を併せ持ち、敵の技を無効化する歴戦の戦士。',
});
cls({
  id: 'trueblade', name: '真剣聖', tier: 2, mode: 'foot', mov: 6,
  weapons: { sword: 'S' }, skills: ['astra', 'quickblade', 'focus'],
  bases: { hp: 28, str: 8, mag: 0, skl: 13, spd: 13, lck: 7, def: 6, res: 5 },
  growths: { hp: 75, str: 45, mag: 5, skl: 62, spd: 62, lck: 42, def: 25, res: 25 },
  caps: { skl: 30, spd: 30 }, desc: '剣聖の奥——流星を纏う者。',
});

/* ---- 追加の敵（魔物・大型） ---- */
cls({
  id: 'necromancer', name: '屍術師', tier: 2, mode: 'mage', mov: 6,
  weapons: { dark: 'S', staff: 'B' }, skills: ['nihil'], tags: ['undead'],
  bases: { hp: 30, str: 0, mag: 12, skl: 8, spd: 6, lck: 2, def: 8, res: 12 },
  growths: { hp: 75, str: 0, mag: 55, skl: 45, spd: 38, lck: 15, def: 28, res: 50 },
  desc: '死者を統べる者。', enemyOnly: true,
});
cls({
  id: 'wightlord', name: '屍将', tier: 2, mode: 'foot', mov: 5,
  weapons: { axe: 'A' }, skills: ['colossus'], tags: ['undead'],
  bases: { hp: 40, str: 13, mag: 0, skl: 6, spd: 5, lck: 0, def: 12, res: 4 },
  growths: { hp: 95, str: 60, mag: 0, skl: 40, spd: 35, lck: 5, def: 50, res: 12 },
  desc: '朽ちぬ鎧をまとう、墓所の主。', enemyOnly: true,
});
cls({
  id: 'firedrake', name: '炎竜', tier: 2, mode: 'fly', mov: 7,
  weapons: { fist: 'S' }, skills: ['colossus'], tags: ['monster', 'fly', 'dragon'],
  bases: { hp: 44, str: 14, mag: 6, skl: 7, spd: 7, lck: 3, def: 13, res: 9 },
  growths: { hp: 95, str: 60, mag: 20, skl: 40, spd: 40, lck: 10, def: 50, res: 30 },
  desc: '火口に棲まう古き竜。息吹は鎧を溶かす。', enemyOnly: true,
});
cls({
  id: 'archmage_foe', name: '大魔道', tier: 2, mode: 'mage', mov: 6,
  weapons: { anima: 'S' }, skills: ['focus'],
  bases: { hp: 28, str: 0, mag: 14, skl: 10, spd: 9, lck: 4, def: 6, res: 11 },
  growths: { hp: 65, str: 0, mag: 60, skl: 50, spd: 48, lck: 25, def: 18, res: 48 },
  desc: '長射程の理を操る敵の魔道長。', enemyOnly: true,
});

cls({
  id: 'calculator', name: '算術士', tier: 2, mode: 'mage', mov: 6,
  weapons: { anima: 'B', staff: 'C' }, skills: ['arithmetic', 'focus'],
  bases: { hp: 24, str: 0, mag: 10, skl: 9, spd: 7, lck: 5, def: 5, res: 9 },
  growths: { hp: 60, str: 5, mag: 55, skl: 55, spd: 45, lck: 40, def: 18, res: 45 },
  desc: '数の理で戦場を読む者。倍数の敵をまとめて討つ。',
});

export const EXPANSION_CLASSES = ['dancer', 'villager', 'bard', 'darkflier', 'dread', 'trueblade', 'necromancer', 'wightlord', 'firedrake', 'archmage_foe', 'calculator'];
export const EXPANSION_SKILLS = ['renewal', 'paragon', 'charm'];
export default true;
