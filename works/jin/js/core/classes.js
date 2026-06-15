/* ============================================================
   陣 — 職（クラス）。素質・成長・移動・扱える得物・覚える技。
   一段（tier 1）は二段へ上級転職できる。職が、その者の戦い方を決める。
   bases: 初期値の下駄。growths: 育つ確率(%)。caps: 上限。
   mode: foot/ride/fly/armor/mage。weapons: 扱える得物と最大ランク。
   ============================================================ */

export const CLASSES = {};
function cls(o) {
  o.caps = o.caps || {};
  CLASSES[o.id] = o;
  return o;
}

/* ---- 一段（下級） ---- */
cls({
  id: 'soldier', name: '兵士', tier: 1, mode: 'foot', mov: 5,
  weapons: { lance: 'C' }, skills: [],
  bases: { hp: 18, str: 5, mag: 0, skl: 3, spd: 4, lck: 2, def: 4, res: 1 },
  growths: { hp: 80, str: 50, mag: 5, skl: 40, spd: 40, lck: 30, def: 35, res: 20 },
  caps: { hp: 60, str: 24, mag: 18, skl: 24, spd: 24, lck: 30, def: 24, res: 22 },
  promotesTo: ['halberdier', 'sentinel'], desc: '槍を持つ歩兵。守りに堅い。',
});
cls({
  id: 'mercenary', name: '傭兵', tier: 1, mode: 'foot', mov: 5,
  weapons: { sword: 'C' }, skills: ['quickblade'],
  bases: { hp: 19, str: 5, mag: 0, skl: 6, spd: 6, lck: 3, def: 3, res: 1 },
  growths: { hp: 75, str: 50, mag: 5, skl: 60, spd: 55, lck: 35, def: 25, res: 20 },
  promotesTo: ['hero', 'swordmaster'], desc: '剣で身を立てる流れ者。技と速さに長ける。',
});
cls({
  id: 'fighter', name: '戦士', tier: 1, mode: 'foot', mov: 5,
  weapons: { axe: 'C' }, skills: [],
  bases: { hp: 22, str: 7, mag: 0, skl: 4, spd: 4, lck: 2, def: 3, res: 0 },
  growths: { hp: 85, str: 65, mag: 0, skl: 45, spd: 40, lck: 30, def: 25, res: 10 },
  promotesTo: ['warrior', 'berserker'], desc: '斧をふるう荒くれ。力は随一。',
});
cls({
  id: 'archer', name: '射手', tier: 1, mode: 'foot', mov: 5,
  weapons: { bow: 'C' }, skills: [],
  bases: { hp: 17, str: 4, mag: 0, skl: 5, spd: 5, lck: 2, def: 2, res: 1 },
  growths: { hp: 65, str: 50, mag: 5, skl: 60, spd: 50, lck: 30, def: 20, res: 20 },
  promotesTo: ['sniper', 'ranger'], desc: '弓を引く者。間合いの外から射る。',
});
cls({
  id: 'cavalier', name: '騎兵', tier: 1, mode: 'ride', mov: 7,
  weapons: { sword: 'D', lance: 'D' }, skills: [],
  bases: { hp: 20, str: 5, mag: 0, skl: 4, spd: 5, lck: 2, def: 5, res: 1 },
  growths: { hp: 75, str: 45, mag: 5, skl: 45, spd: 45, lck: 30, def: 35, res: 18 },
  promotesTo: ['paladin', 'greatknight'], desc: '馬を駆る騎士。広く動ける。',
});
cls({
  id: 'knight', name: '重騎士', tier: 1, mode: 'armor', mov: 4,
  weapons: { lance: 'C' }, skills: [],
  bases: { hp: 24, str: 6, mag: 0, skl: 3, spd: 2, lck: 1, def: 9, res: 0 },
  growths: { hp: 90, str: 55, mag: 0, skl: 35, spd: 25, lck: 25, def: 60, res: 15 },
  promotesTo: ['general', 'greatknight'], desc: '鋼の壁。遅いが砕けない。',
});
cls({
  id: 'pegasus', name: '天馬騎士', tier: 1, mode: 'fly', mov: 7,
  weapons: { lance: 'C' }, skills: [],
  bases: { hp: 17, str: 4, mag: 0, skl: 5, spd: 7, lck: 4, def: 3, res: 5 },
  growths: { hp: 65, str: 40, mag: 10, skl: 50, spd: 60, lck: 45, def: 20, res: 40 },
  promotesTo: ['falcon', 'wyvernlord'], desc: '空を翔ける乙女。速く、魔に強い。弓に注意。',
});
cls({
  id: 'wyvern', name: '飛竜騎士', tier: 1, mode: 'fly', mov: 7,
  weapons: { lance: 'C' }, skills: [],
  bases: { hp: 22, str: 6, mag: 0, skl: 4, spd: 5, lck: 2, def: 7, res: 0 },
  growths: { hp: 80, str: 55, mag: 0, skl: 40, spd: 45, lck: 25, def: 45, res: 12 },
  promotesTo: ['wyvernlord', 'griffon'], desc: '竜にまたがる重き翼。守り高く、魔防低い。',
});
cls({
  id: 'mage', name: '魔道士', tier: 1, mode: 'mage', mov: 5,
  weapons: { anima: 'C' }, skills: [],
  bases: { hp: 16, str: 0, mag: 5, skl: 4, spd: 5, lck: 3, def: 2, res: 4 },
  growths: { hp: 60, str: 5, mag: 60, skl: 50, spd: 50, lck: 35, def: 15, res: 40 },
  promotesTo: ['sage', 'mortalsavant'], desc: '理（アニマ）を操る。遠近を打つ炎雷。',
});
cls({
  id: 'monk', name: '修道士', tier: 1, mode: 'mage', mov: 5,
  weapons: { light: 'C' }, skills: [],
  bases: { hp: 16, str: 0, mag: 5, skl: 5, spd: 4, lck: 4, def: 1, res: 6 },
  growths: { hp: 55, str: 5, mag: 55, skl: 55, spd: 45, lck: 45, def: 12, res: 55 },
  promotesTo: ['bishop', 'sage'], desc: '光を宿す者。屍者に強く、魔防に優れる。',
});
cls({
  id: 'shaman', name: '呪術師', tier: 1, mode: 'mage', mov: 5,
  weapons: { dark: 'C' }, skills: [],
  bases: { hp: 18, str: 0, mag: 5, skl: 4, spd: 3, lck: 2, def: 3, res: 5 },
  growths: { hp: 65, str: 5, mag: 55, skl: 45, spd: 40, lck: 30, def: 25, res: 45 },
  promotesTo: ['druid', 'sorcerer'], desc: '闇を編む者。固く、生命を吸う。',
});
cls({
  id: 'cleric', name: '神官', tier: 1, mode: 'foot', mov: 5,
  weapons: { staff: 'C' }, skills: ['mend_skill'],
  bases: { hp: 16, str: 0, mag: 4, skl: 3, spd: 5, lck: 5, def: 2, res: 6 },
  growths: { hp: 55, str: 0, mag: 45, skl: 40, spd: 50, lck: 55, def: 12, res: 50 },
  promotesTo: ['bishop', 'valkyrie'], desc: '杖で癒す者。戦わずして戦を支える。',
});
cls({
  id: 'thief', name: '盗賊', tier: 1, mode: 'foot', mov: 6,
  weapons: { sword: 'D', dagger: 'C' }, skills: ['steal', 'lockpick'],
  bases: { hp: 16, str: 3, mag: 0, skl: 6, spd: 8, lck: 4, def: 2, res: 2 },
  growths: { hp: 60, str: 35, mag: 5, skl: 60, spd: 70, lck: 45, def: 18, res: 22 },
  promotesTo: ['assassin', 'rogue'], desc: '速き影。盗み、鍵を開け、宝を運ぶ。',
});

/* ---- 二段（上級） ---- */
cls({
  id: 'halberdier', name: '重槍士', tier: 2, mode: 'foot', mov: 6,
  weapons: { lance: 'A' }, skills: ['pierce'],
  bases: { hp: 28, str: 9, mag: 0, skl: 7, spd: 7, lck: 4, def: 8, res: 3 },
  growths: { hp: 85, str: 55, mag: 5, skl: 45, spd: 45, lck: 30, def: 40, res: 25 },
  desc: '兵士の極み。貫きの一撃。',
});
cls({
  id: 'sentinel', name: '聖騎兵', tier: 2, mode: 'foot', mov: 6,
  weapons: { lance: 'A', sword: 'B' }, skills: ['wary'],
  bases: { hp: 30, str: 9, mag: 0, skl: 6, spd: 6, lck: 5, def: 10, res: 4 },
  growths: { hp: 90, str: 50, mag: 5, skl: 40, spd: 40, lck: 35, def: 45, res: 25 },
  desc: '不動の守り手。',
});
cls({
  id: 'hero', name: '勇者', tier: 2, mode: 'foot', mov: 6,
  weapons: { sword: 'A', axe: 'B' }, skills: ['quickblade', 'sol'],
  bases: { hp: 30, str: 8, mag: 0, skl: 9, spd: 9, lck: 5, def: 6, res: 3 },
  growths: { hp: 80, str: 50, mag: 5, skl: 55, spd: 50, lck: 35, def: 30, res: 25 },
  desc: '傭兵の到達点。剣と斧をふるう英雄。',
});
cls({
  id: 'swordmaster', name: '剣聖', tier: 2, mode: 'foot', mov: 6,
  weapons: { sword: 'S' }, skills: ['quickblade', 'astra'],
  bases: { hp: 26, str: 7, mag: 0, skl: 12, spd: 12, lck: 6, def: 5, res: 4 },
  growths: { hp: 75, str: 45, mag: 5, skl: 60, spd: 60, lck: 40, def: 25, res: 25 },
  caps: { skl: 30, spd: 30 },
  desc: '剣の道を極めし者。会心の星を降らせる。',
});
cls({
  id: 'warrior', name: '武将', tier: 2, mode: 'foot', mov: 6,
  weapons: { axe: 'A', bow: 'B' }, skills: ['colossus'],
  bases: { hp: 34, str: 11, mag: 0, skl: 6, spd: 6, lck: 4, def: 6, res: 2 },
  growths: { hp: 90, str: 60, mag: 0, skl: 45, spd: 40, lck: 30, def: 30, res: 15 },
  desc: '斧と弓を操る豪傑。',
});
cls({
  id: 'berserker', name: '狂戦士', tier: 2, mode: 'foot', mov: 6,
  weapons: { axe: 'S' }, skills: ['colossus'],
  bases: { hp: 35, str: 12, mag: 0, skl: 7, spd: 8, lck: 3, def: 5, res: 1 },
  growths: { hp: 85, str: 65, mag: 0, skl: 50, spd: 45, lck: 25, def: 22, res: 12 },
  critBonus: 15,
  desc: '会心に憑かれた斧の鬼。',
});
cls({
  id: 'sniper', name: '狙撃手', tier: 2, mode: 'foot', mov: 6,
  weapons: { bow: 'S' }, skills: ['deadeye'],
  bases: { hp: 26, str: 8, mag: 0, skl: 11, spd: 9, lck: 4, def: 5, res: 4 },
  growths: { hp: 70, str: 50, mag: 5, skl: 60, spd: 50, lck: 35, def: 25, res: 22 },
  desc: '射手の極み。狙えば、外さない。',
});
cls({
  id: 'ranger', name: '遊撃', tier: 2, mode: 'ride', mov: 8,
  weapons: { bow: 'A', sword: 'B' }, skills: [],
  bases: { hp: 28, str: 8, mag: 0, skl: 8, spd: 9, lck: 5, def: 5, res: 4 },
  growths: { hp: 75, str: 45, mag: 5, skl: 50, spd: 50, lck: 40, def: 28, res: 22 },
  desc: '馬上の弓使い。神出鬼没。',
});
cls({
  id: 'paladin', name: '聖騎士', tier: 2, mode: 'ride', mov: 8,
  weapons: { sword: 'A', lance: 'A' }, skills: ['aegis'],
  bases: { hp: 30, str: 8, mag: 0, skl: 7, spd: 8, lck: 5, def: 9, res: 5 },
  growths: { hp: 80, str: 45, mag: 5, skl: 45, spd: 45, lck: 35, def: 40, res: 25 },
  desc: '騎士の鑑。剣槍を携え駆ける。',
});
cls({
  id: 'greatknight', name: '将騎士', tier: 2, mode: 'armor', mov: 6,
  weapons: { sword: 'A', lance: 'A', axe: 'A' }, skills: ['wary'],
  bases: { hp: 33, str: 10, mag: 0, skl: 6, spd: 5, lck: 4, def: 12, res: 4 },
  growths: { hp: 90, str: 55, mag: 0, skl: 40, spd: 35, lck: 30, def: 50, res: 20 },
  desc: '三種の得物を持つ重騎。鈍重だが鉄壁。',
});
cls({
  id: 'general', name: '将軍', tier: 2, mode: 'armor', mov: 5,
  weapons: { lance: 'A', axe: 'A' }, skills: ['wary', 'pavise'],
  bases: { hp: 36, str: 11, mag: 0, skl: 6, spd: 4, lck: 4, def: 14, res: 4 },
  growths: { hp: 95, str: 55, mag: 0, skl: 40, spd: 30, lck: 30, def: 55, res: 22 },
  desc: '城そのもの。最強の守り。',
});
cls({
  id: 'falcon', name: '飛翔騎士', tier: 2, mode: 'fly', mov: 8,
  weapons: { lance: 'A', sword: 'B' }, skills: ['wing'],
  bases: { hp: 26, str: 7, mag: 0, skl: 9, spd: 11, lck: 6, def: 6, res: 9 },
  growths: { hp: 70, str: 45, mag: 10, skl: 50, spd: 60, lck: 45, def: 25, res: 45 },
  desc: '空を統べる天馬の極み。魔に強く、速い。',
});
cls({
  id: 'wyvernlord', name: '飛竜将', tier: 2, mode: 'fly', mov: 8,
  weapons: { lance: 'A', axe: 'A' }, skills: ['wing'],
  bases: { hp: 32, str: 10, mag: 0, skl: 7, spd: 8, lck: 4, def: 11, res: 3 },
  growths: { hp: 85, str: 55, mag: 0, skl: 45, spd: 45, lck: 25, def: 45, res: 18 },
  desc: '竜と一体の重き翼。空からの鉄槌。',
});
cls({
  id: 'griffon', name: '鷲獅子騎士', tier: 2, mode: 'fly', mov: 9,
  weapons: { axe: 'A' }, skills: ['wing'],
  bases: { hp: 30, str: 10, mag: 0, skl: 8, spd: 9, lck: 4, def: 8, res: 4 },
  growths: { hp: 80, str: 55, mag: 0, skl: 45, spd: 50, lck: 30, def: 35, res: 18 },
  desc: '最速の翼。一撃離脱。',
});
cls({
  id: 'sage', name: '賢者', tier: 2, mode: 'mage', mov: 6,
  weapons: { anima: 'S', staff: 'B' }, skills: ['focus'],
  bases: { hp: 24, str: 0, mag: 11, skl: 8, spd: 8, lck: 5, def: 5, res: 9 },
  growths: { hp: 65, str: 5, mag: 60, skl: 50, spd: 50, lck: 35, def: 18, res: 45 },
  desc: '理を究め、杖も握る知の極み。',
});
cls({
  id: 'mortalsavant', name: '魔剣士', tier: 2, mode: 'foot', mov: 6,
  weapons: { sword: 'A', anima: 'B' }, skills: [],
  bases: { hp: 28, str: 7, mag: 8, skl: 9, spd: 8, lck: 4, def: 6, res: 6 },
  growths: { hp: 70, str: 40, mag: 40, skl: 50, spd: 45, lck: 30, def: 28, res: 30 },
  desc: '剣と理、両の道を歩む者。',
});
cls({
  id: 'bishop', name: '司教', tier: 2, mode: 'mage', mov: 6,
  weapons: { light: 'S', staff: 'A' }, skills: ['miracle'],
  bases: { hp: 24, str: 0, mag: 10, skl: 8, spd: 7, lck: 7, def: 5, res: 12 },
  growths: { hp: 65, str: 5, mag: 55, skl: 50, spd: 45, lck: 50, def: 18, res: 55 },
  desc: '光と杖の聖者。屍者を祓い、味方を癒す。',
});
cls({
  id: 'druid', name: '司祭', tier: 2, mode: 'mage', mov: 6,
  weapons: { dark: 'S', staff: 'B' }, skills: ['focus'],
  bases: { hp: 26, str: 0, mag: 10, skl: 8, spd: 6, lck: 4, def: 6, res: 10 },
  growths: { hp: 70, str: 5, mag: 55, skl: 45, spd: 40, lck: 30, def: 25, res: 50 },
  desc: '闇を統べる賢者。',
});
cls({
  id: 'sorcerer', name: '魔導将', tier: 2, mode: 'mage', mov: 6,
  weapons: { dark: 'S', anima: 'B' }, skills: ['nihil'],
  bases: { hp: 30, str: 0, mag: 11, skl: 7, spd: 6, lck: 4, def: 8, res: 9 },
  growths: { hp: 75, str: 5, mag: 55, skl: 40, spd: 38, lck: 28, def: 30, res: 42 },
  desc: '生命を吸う闇の権化。固く、しぶとい。',
});
cls({
  id: 'valkyrie', name: '聖女', tier: 2, mode: 'ride', mov: 8,
  weapons: { staff: 'A', light: 'B' }, skills: ['miracle'],
  bases: { hp: 24, str: 0, mag: 9, skl: 7, spd: 8, lck: 8, def: 5, res: 11 },
  growths: { hp: 65, str: 5, mag: 50, skl: 45, spd: 50, lck: 55, def: 18, res: 50 },
  desc: '馬上から癒し、光を放つ。',
});
cls({
  id: 'assassin', name: '暗殺者', tier: 2, mode: 'foot', mov: 7,
  weapons: { sword: 'A', dagger: 'A' }, skills: ['lethality', 'steal', 'lockpick'],
  bases: { hp: 26, str: 7, mag: 0, skl: 11, spd: 12, lck: 5, def: 5, res: 4 },
  growths: { hp: 70, str: 40, mag: 5, skl: 60, spd: 65, lck: 40, def: 22, res: 22 },
  desc: '影の極み。時に一撃で命を絶つ。',
});
cls({
  id: 'rogue', name: '盗賊頭', tier: 2, mode: 'foot', mov: 7,
  weapons: { sword: 'A', dagger: 'A' }, skills: ['steal', 'lockpick', 'pickpocket'],
  bases: { hp: 26, str: 6, mag: 0, skl: 9, spd: 11, lck: 6, def: 5, res: 4 },
  growths: { hp: 70, str: 38, mag: 5, skl: 55, spd: 60, lck: 50, def: 22, res: 24 },
  desc: '盗みの達人。鍵いらずで宝を開ける。',
});

/* ---- 敵専用・特殊 ---- */
cls({
  id: 'brigand', name: '盗賊団', tier: 1, mode: 'foot', mov: 6,
  weapons: { axe: 'C' }, skills: [],
  bases: { hp: 21, str: 6, mag: 0, skl: 3, spd: 4, lck: 1, def: 3, res: 0 },
  growths: { hp: 80, str: 55, mag: 0, skl: 35, spd: 40, lck: 15, def: 22, res: 8 },
  desc: '村を襲う山賊。', enemyOnly: true,
});
cls({
  id: 'revenant', name: '屍兵', tier: 1, mode: 'foot', mov: 4,
  weapons: { fist: 'C' }, skills: [], tags: ['undead'],
  bases: { hp: 24, str: 6, mag: 0, skl: 2, spd: 2, lck: 0, def: 4, res: 0 },
  growths: { hp: 80, str: 50, mag: 0, skl: 20, spd: 20, lck: 5, def: 25, res: 5 },
  desc: '蘇った亡骸。光に弱い。', enemyOnly: true,
});
cls({
  id: 'gargoyle', name: '魔物・翼', tier: 1, mode: 'fly', mov: 7,
  weapons: { lance: 'C' }, skills: [], tags: ['monster', 'fly'],
  bases: { hp: 22, str: 7, mag: 0, skl: 5, spd: 6, lck: 1, def: 6, res: 2 },
  growths: { hp: 75, str: 55, mag: 0, skl: 40, spd: 45, lck: 10, def: 35, res: 12 },
  desc: '空をゆく魔物。', enemyOnly: true,
});
cls({
  id: 'mogall', name: '魔眼', tier: 1, mode: 'fly', mov: 6,
  weapons: { dark: 'C' }, skills: [], tags: ['monster', 'fly'],
  bases: { hp: 20, str: 0, mag: 6, skl: 4, spd: 4, lck: 1, def: 2, res: 6 },
  growths: { hp: 70, str: 0, mag: 50, skl: 35, spd: 35, lck: 8, def: 12, res: 40 },
  desc: '宙に浮く巨大な眼。闇を放つ。', enemyOnly: true,
});
cls({
  id: 'commander', name: '隊長', tier: 2, mode: 'foot', mov: 5,
  weapons: { lance: 'A', sword: 'B' }, skills: ['wary'],
  bases: { hp: 34, str: 10, mag: 0, skl: 8, spd: 7, lck: 4, def: 11, res: 5 },
  growths: { hp: 90, str: 55, mag: 5, skl: 45, spd: 40, lck: 30, def: 45, res: 25 },
  desc: '敵軍を率いる将。', enemyOnly: true,
});

/* ---- 主人公・専用職 ---- */
cls({
  id: 'lord', name: '君主', tier: 1, mode: 'foot', mov: 5,
  weapons: { sword: 'C' }, skills: ['rally'],
  bases: { hp: 20, str: 5, mag: 1, skl: 6, spd: 6, lck: 6, def: 5, res: 2 },
  growths: { hp: 80, str: 50, mag: 15, skl: 55, spd: 55, lck: 60, def: 35, res: 25 },
  promotesTo: ['greatlord'], desc: 'いくさを率いる若き主。仲間を鼓舞する。',
});
cls({
  id: 'greatlord', name: '大公', tier: 2, mode: 'foot', mov: 6,
  weapons: { sword: 'A', lance: 'B' }, skills: ['rally', 'aether'],
  bases: { hp: 30, str: 9, mag: 2, skl: 10, spd: 10, lck: 9, def: 9, res: 5 },
  growths: { hp: 85, str: 50, mag: 15, skl: 55, spd: 55, lck: 60, def: 40, res: 30 },
  desc: '民を導く器。剣と槍、そして天空の一撃。',
});

export const CLASS_LIST = Object.values(CLASSES);
export function classDef(id) { return CLASSES[id]; }
export function defaultCaps() {
  return { hp: 80, str: 28, mag: 28, skl: 29, spd: 28, lck: 30, def: 27, res: 27 };
}
/* 職の上限（既定＋職ごとの上書き） */
export function classCaps(id) {
  const base = defaultCaps();
  const c = CLASSES[id];
  if (c && c.caps) for (const k in c.caps) base[k] = c.caps[k];
  // 二段はやや高い
  if (c && c.tier === 2) for (const k in base) base[k] += 2;
  base.hp = c && c.tier === 2 ? 80 : 60;
  return base;
}
