/* ============================================================
   陣 — 拡張その五：さらなる上級職・第三陣。
   既存の登録簿（CLASSES）に追記し、対応する一段職の promotesTo へ繋ぐ。
   tier:2・enemyOnly でない職は、拠点の上級転職／ジョブ（再クラス）に並ぶ。
   combat/unit はクラスの欄を汎用に読むので、新しい職はそのまま戦える。
   既出（classes / expansion / expansion2〜4）と重ならぬ六種。
   ============================================================ */

import { CLASSES } from './classes.js';

function cls(o) { o.caps = o.caps || {}; CLASSES[o.id] = o; return o; }

/* この拡張で足した上級職の id（テスト等が参照する） */
export const EXPANSION5_CLASSES = ['vanguard', 'warpriest', 'shadowdancer', 'stormcaller', 'beastrider', 'runeknight'];

/* ---- さらなる上級職・第三陣（いずれも tier:2・味方も就ける） ---- */
cls({
  id: 'vanguard', name: '先鋒長', tier: 2, mode: 'foot', mov: 6,
  weapons: { sword: 'S', axe: 'A' }, skills: ['colossus', 'vantage'],
  bases: { hp: 40, str: 18, mag: 3, skl: 16, spd: 15, lck: 12, def: 15, res: 10 },
  growths: { hp: 74, str: 50, mag: 8, skl: 45, spd: 42, lck: 35, def: 36, res: 24 },
  promotesTo: [], desc: '隊の先頭を切り拓く猛者。剣斧で道を割り、窮地でこそ先んじて反撃する。',
});
cls({
  id: 'warpriest', name: '戦巫', tier: 2, mode: 'foot', mov: 6,
  weapons: { staff: 'S', axe: 'B' }, skills: ['miracle', 'guard'],
  bases: { hp: 36, str: 14, mag: 14, skl: 14, spd: 14, lck: 16, def: 13, res: 18 },
  growths: { hp: 62, str: 34, mag: 42, skl: 40, spd: 40, lck: 50, def: 28, res: 48 },
  promotesTo: [], desc: '祈りと斧をともに振るう戦の巫。傷を癒しつつ前へ立ち、死の淵から仲間を返す。',
});
cls({
  id: 'shadowdancer', name: '影舞', tier: 2, mode: 'foot', mov: 7,
  weapons: { dagger: 'S', sword: 'B' }, skills: ['astra', 'lethality'],
  bases: { hp: 31, str: 14, mag: 5, skl: 21, spd: 21, lck: 15, def: 10, res: 12 },
  growths: { hp: 55, str: 40, mag: 12, skl: 62, spd: 64, lck: 48, def: 22, res: 30 },
  promotesTo: [], desc: '影を纏って舞う刺客。連なる斬撃で翻弄し、時に急所をただ一突きで断つ。',
});
cls({
  id: 'stormcaller', name: '嵐術師', tier: 2, mode: 'mage', mov: 6,
  weapons: { anima: 'S', dark: 'B' }, skills: ['adept', 'focus'],
  bases: { hp: 31, str: 4, mag: 20, skl: 17, spd: 18, lck: 11, def: 8, res: 17 },
  growths: { hp: 54, str: 5, mag: 62, skl: 48, spd: 52, lck: 35, def: 16, res: 48 },
  promotesTo: [], desc: '雷と風を呼ぶ理の使い手。速き連唱で二度撃ち、孤立すればいっそう冴える。',
});
cls({
  id: 'beastrider', name: '獣騎', tier: 2, mode: 'ride', mov: 8,
  weapons: { axe: 'A', bow: 'B' }, skills: ['wrath', 'colossus'],
  bases: { hp: 38, str: 18, mag: 3, skl: 15, spd: 16, lck: 11, def: 14, res: 9 },
  growths: { hp: 70, str: 50, mag: 6, skl: 44, spd: 46, lck: 32, def: 32, res: 22 },
  promotesTo: [], desc: '荒野の獣を駆る騎兵。斧と弓を併せ持ち、怒りを力に変えて駆け抜ける。',
});
cls({
  id: 'runeknight', name: '紋章騎', tier: 2, mode: 'ride', mov: 8,
  weapons: { lance: 'A', anima: 'B' }, skills: ['luna', 'pavise'],
  bases: { hp: 37, str: 16, mag: 12, skl: 15, spd: 15, lck: 12, def: 16, res: 15 },
  growths: { hp: 66, str: 42, mag: 38, skl: 42, spd: 42, lck: 36, def: 38, res: 38 },
  promotesTo: [], desc: '紋章の理を槍に宿す騎士。月光で守りを割り、大盾で味方の傷を引き受ける。',
});

/* 一段職の昇格先に繋ぐ（上級転職で選べるように） */
const link = (from, to) => { const c = CLASSES[from]; if (!c) return; if (!c.promotesTo) c.promotesTo = []; if (!c.promotesTo.includes(to)) c.promotesTo.push(to); };
link('mercenary', 'vanguard'); link('fighter', 'vanguard');
link('cleric', 'warpriest'); link('monk', 'warpriest');
link('thief', 'shadowdancer'); link('mercenary', 'shadowdancer');
link('mage', 'stormcaller'); link('shaman', 'stormcaller');
link('brigand', 'beastrider'); link('cavalier', 'beastrider');
link('cavalier', 'runeknight'); link('mage', 'runeknight');
