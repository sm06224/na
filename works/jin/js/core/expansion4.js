/* ============================================================
   陣 — 拡張その四：さらなる上級職・第二陣。
   既存の登録簿（CLASSES）に追記し、対応する一段職の promotesTo へ繋ぐ。
   tier:2・enemyOnly でない職は、拠点の上級転職／ジョブ（再クラス）に並ぶ。
   combat/unit はクラスの欄を汎用に読むので、新しい職はそのまま戦える。
   既出（classes / expansion / expansion2 / expansion3）と重ならぬ六種。
   ============================================================ */

import { CLASSES } from './classes.js';

function cls(o) { o.caps = o.caps || {}; CLASSES[o.id] = o; return o; }

/* この拡張で足した上級職の id（テスト等が参照する） */
export const EXPANSION4_CLASSES = ['warden', 'spellblade', 'huntmaster', 'templar', 'corsair', 'dragoon'];

/* ---- さらなる上級職・第二陣（いずれも tier:2・味方も就ける） ---- */
cls({
  id: 'warden', name: '守護者', tier: 2, mode: 'armor', mov: 5,
  weapons: { lance: 'S', sword: 'B' }, skills: ['pavise', 'guard'],
  bases: { hp: 42, str: 17, mag: 4, skl: 13, spd: 10, lck: 11, def: 21, res: 14 },
  growths: { hp: 80, str: 42, mag: 10, skl: 38, spd: 28, lck: 32, def: 52, res: 32 },
  promotesTo: [], desc: '城門を守り抜く老練の重騎。槍を構えて退かず、味方の傷を己が盾で減らす。',
});
cls({
  id: 'spellblade', name: '魔剣士', tier: 2, mode: 'foot', mov: 6,
  weapons: { sword: 'A', anima: 'A' }, skills: ['astra', 'ignis'],
  bases: { hp: 33, str: 13, mag: 14, skl: 18, spd: 18, lck: 11, def: 11, res: 14 },
  growths: { hp: 58, str: 38, mag: 40, skl: 52, spd: 52, lck: 35, def: 24, res: 36 },
  promotesTo: [], desc: '剣に理を宿す二刀の使い手。斬撃と魔を継いで放ち、守りも魔防も抜く。',
});
cls({
  id: 'huntmaster', name: '狩猟長', tier: 2, mode: 'foot', mov: 7,
  weapons: { bow: 'S', axe: 'B' }, skills: ['deadeye', 'colossus'],
  bases: { hp: 36, str: 18, mag: 3, skl: 17, spd: 16, lck: 10, def: 13, res: 10 },
  growths: { hp: 66, str: 50, mag: 8, skl: 50, spd: 48, lck: 35, def: 30, res: 24 },
  promotesTo: [], desc: '森と山を統べる狩りの長。遠き一矢で獣を眠らせ、近づけば斧で仕留める。',
});
cls({
  id: 'templar', name: '聖堂騎士', tier: 2, mode: 'ride', mov: 7,
  weapons: { sword: 'A', light: 'B' }, skills: ['sol', 'miracle'],
  bases: { hp: 36, str: 16, mag: 12, skl: 15, spd: 14, lck: 14, def: 16, res: 16 },
  growths: { hp: 66, str: 42, mag: 38, skl: 42, spd: 40, lck: 42, def: 38, res: 40 },
  promotesTo: [], desc: '光を奉じて馬上に駆ける聖堂の騎士。剣と祈りで仲間を守り、傷を糧に立つ。',
});
cls({
  id: 'corsair', name: '海賊頭', tier: 2, mode: 'foot', mov: 7,
  weapons: { axe: 'S', dagger: 'A' }, skills: ['wrath', 'pickpocket'],
  bases: { hp: 38, str: 19, mag: 2, skl: 16, spd: 17, lck: 12, def: 12, res: 8 },
  growths: { hp: 72, str: 52, mag: 5, skl: 45, spd: 48, lck: 38, def: 26, res: 18 },
  promotesTo: [], desc: '海を渡る荒くれの頭。斧で叩き割り、短剣で奪う。怒れば刃はいっそう冴える。',
});
cls({
  id: 'dragoon', name: '竜騎将', tier: 2, mode: 'fly', mov: 8,
  weapons: { lance: 'S', sword: 'C' }, skills: ['aether', 'vantage'],
  bases: { hp: 38, str: 19, mag: 4, skl: 16, spd: 16, lck: 11, def: 16, res: 10 },
  growths: { hp: 70, str: 52, mag: 10, skl: 46, spd: 46, lck: 30, def: 40, res: 26 },
  promotesTo: [], desc: '竜とともに天を征く将。長槍を振るって空より降り、窮地でこそ先んじて反撃する。',
});

/* 一段職の昇格先に繋ぐ（上級転職で選べるように） */
const link = (from, to) => { const c = CLASSES[from]; if (!c) return; if (!c.promotesTo) c.promotesTo = []; if (!c.promotesTo.includes(to)) c.promotesTo.push(to); };
link('knight', 'warden'); link('soldier', 'warden');
link('mercenary', 'spellblade'); link('mage', 'spellblade');
link('archer', 'huntmaster'); link('fighter', 'huntmaster');
link('cavalier', 'templar'); link('monk', 'templar');
link('brigand', 'corsair'); link('thief', 'corsair');
link('wyvern', 'dragoon'); link('pegasus', 'dragoon');
