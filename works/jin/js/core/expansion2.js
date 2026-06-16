/* ============================================================
   陣 — 拡張その二：第三幕の上級職。
   既存の登録簿（CLASSES）に追記し、対応する一段職の promotesTo へ繋ぐ。
   tier:2・enemyOnly でない職は、拠点の上級転職／ジョブ（再クラス）に並ぶ。
   combat/unit はクラスの欄を汎用に読むので、新しい職はそのまま戦える。
   ============================================================ */

import { CLASSES } from './classes.js';

function cls(o) { o.caps = o.caps || {}; CLASSES[o.id] = o; return o; }

/* この拡張で足した上級職の id（テスト等が参照する） */
export const EXPANSION2_CLASSES = ['starknight', 'skyranger', 'starmage', 'towerguard', 'moonshadow', 'priestess'];

/* ---- 星をまとう上級職（いずれも tier:2・味方も就ける） ---- */
cls({
  id: 'starknight', name: '星騎士', tier: 2, mode: 'ride', mov: 8,
  weapons: { sword: 'A', lance: 'A' }, skills: ['charm', 'aether'],
  bases: { hp: 34, str: 16, mag: 4, skl: 15, spd: 15, lck: 12, def: 14, res: 10 },
  growths: { hp: 65, str: 45, mag: 10, skl: 45, spd: 45, lck: 35, def: 35, res: 25 },
  promotesTo: [], desc: '星明かりを背に駆ける騎士。剣槍を操り、天空の一撃を放つ。',
});
cls({
  id: 'skyranger', name: '天弓士', tier: 2, mode: 'foot', mov: 6,
  weapons: { bow: 'S', sword: 'C' }, skills: ['deadeye', 'pierce'],
  bases: { hp: 32, str: 15, mag: 3, skl: 19, spd: 18, lck: 11, def: 11, res: 12 },
  growths: { hp: 60, str: 45, mag: 10, skl: 60, spd: 55, lck: 40, def: 25, res: 30 },
  promotesTo: [], desc: '星を見て風を読み、遠き一矢を違えぬ射手。飛ぶものを必ず墜とす。',
});
cls({
  id: 'starmage', name: '星魔導', tier: 2, mode: 'mage', mov: 6,
  weapons: { anima: 'S', light: 'A' }, skills: ['ignis', 'focus'],
  bases: { hp: 30, str: 4, mag: 20, skl: 16, spd: 16, lck: 10, def: 8, res: 18 },
  growths: { hp: 55, str: 5, mag: 65, skl: 45, spd: 45, lck: 35, def: 18, res: 50 },
  promotesTo: [], desc: '星の理を逆しまに操る魔導。理と光の二色を束ねて撃つ。',
});
cls({
  id: 'towerguard', name: '聖塔衛', tier: 2, mode: 'armor', mov: 5,
  weapons: { lance: 'A', axe: 'B' }, skills: ['pavise', 'charm'],
  bases: { hp: 40, str: 18, mag: 3, skl: 12, spd: 9, lck: 9, def: 22, res: 12 },
  growths: { hp: 80, str: 45, mag: 8, skl: 35, spd: 25, lck: 30, def: 55, res: 28 },
  promotesTo: [], desc: '星詠みの塔を守った重騎。崩れぬ盾で味方をかばう。',
});
cls({
  id: 'moonshadow', name: '月影', tier: 2, mode: 'foot', mov: 7,
  weapons: { sword: 'A', dagger: 'S' }, skills: ['lethality', 'astra', 'lockpick'],
  bases: { hp: 30, str: 15, mag: 4, skl: 20, spd: 20, lck: 14, def: 10, res: 11 },
  growths: { hp: 55, str: 42, mag: 10, skl: 60, spd: 62, lck: 45, def: 22, res: 28 },
  promotesTo: [], desc: '月のない夜に紛れる影。急所を一突きで断ち、鍵を開け、宝を攫う。',
});
cls({
  id: 'priestess', name: '巫女姫', tier: 2, mode: 'foot', mov: 6,
  weapons: { staff: 'S', light: 'A' }, skills: ['miracle', 'renewal'],
  bases: { hp: 30, str: 4, mag: 18, skl: 14, spd: 15, lck: 16, def: 9, res: 20 },
  growths: { hp: 55, str: 6, mag: 55, skl: 40, spd: 45, lck: 55, def: 18, res: 55 },
  promotesTo: [], desc: '星の声に抗い、人のために祈る巫女。癒しと光をともに宿す。',
});

/* 一段職の昇格先に繋ぐ（上級転職で選べるように） */
const link = (from, to) => { const c = CLASSES[from]; if (c && c.promotesTo && !c.promotesTo.includes(to)) c.promotesTo.push(to); };
link('cavalier', 'starknight'); link('pegasus', 'starknight');
link('archer', 'skyranger');
link('mage', 'starmage');
link('knight', 'towerguard'); link('soldier', 'towerguard');
link('thief', 'moonshadow'); link('mercenary', 'moonshadow');
link('cleric', 'priestess'); link('monk', 'priestess');
