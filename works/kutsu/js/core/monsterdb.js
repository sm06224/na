/* ============================================================
   窟 — 魔物の名鑑。深さ帯ごとに棲むものが変わる。
   stats・行動型（ai）・特殊（毒・遠隔・盗み・召喚…）をデータで持つ。
   ============================================================ */

const DB = {};
function add(key, def) { DB[key] = { key, ...def }; }

/* depth: [最浅, 最深]、rarity: 出やすさ、ai: 行動型、damage: 噛み付き
   特殊: ranged(遠隔), status(命中時の状態異常), regen, packMin/packMax(群れ), drops */

/* ---- 浅層（1-3） ---- */
add('rat', { name: 'どぶ鼠', glyph: 'r', color: '#9a8a6a', hp: 4, str: 1, def: 0, acc: 2, eva: 2, speed: 100, ai: 'pack', sight: 6, damage: '1d3', xp: 1, depth: [1, 4], rarity: 9, tags: ['animal'], packMin: 2, packMax: 5 });
add('bat', { name: '洞窟蝙蝠', glyph: 'b', color: '#7a6f8a', hp: 5, str: 1, def: 0, acc: 3, eva: 5, speed: 140, ai: 'erratic', sight: 7, damage: '1d3', xp: 2, depth: [1, 5], rarity: 7, tags: ['animal', 'flying'] });
add('kobold', { name: 'コボルド', glyph: 'k', color: '#6f9a5a', hp: 6, str: 2, def: 1, acc: 3, eva: 2, speed: 100, ai: 'melee', sight: 7, damage: '1d5', xp: 3, depth: [1, 5], rarity: 8, tags: ['humanoid'], drops: 'low' });
add('snake', { name: '蝮', glyph: 's', color: '#7a9a4a', hp: 7, str: 2, def: 0, acc: 4, eva: 3, speed: 90, ai: 'melee', sight: 5, damage: '1d4', xp: 4, depth: [2, 6], rarity: 6, tags: ['animal'], status: { type: 'poison', turns: 5, power: 1, chance: 0.5 } });
add('jackal', { name: '山犬', glyph: 'j', color: '#b08040', hp: 6, str: 2, def: 0, acc: 4, eva: 3, speed: 130, ai: 'pack', sight: 8, damage: '1d4', xp: 3, depth: [1, 5], rarity: 7, tags: ['animal'], packMin: 2, packMax: 4 });
add('goblin', { name: 'ゴブリン', glyph: 'g', color: '#5a9a5a', hp: 9, str: 3, def: 1, acc: 4, eva: 2, speed: 100, ai: 'melee', sight: 7, damage: '1d6', xp: 5, depth: [2, 6], rarity: 8, tags: ['humanoid'], drops: 'low' });
add('spider', { name: '洞蜘蛛', glyph: 'a', color: '#8a6f5a', hp: 7, str: 2, def: 1, acc: 4, eva: 4, speed: 110, ai: 'melee', sight: 6, damage: '1d4', xp: 4, depth: [2, 7], rarity: 6, tags: ['animal'], status: { type: 'poison', turns: 6, power: 1, chance: 0.4 }, special: 'web' });

/* ---- 中層（4-8） ---- */
add('orc', { name: 'オーク', glyph: 'o', color: '#6a8a4a', hp: 14, str: 4, def: 2, acc: 5, eva: 2, speed: 100, ai: 'melee', sight: 7, damage: '1d8', xp: 8, depth: [4, 9], rarity: 8, tags: ['humanoid'], drops: 'mid', packMin: 1, packMax: 3 });
add('orc_archer', { name: 'オーク射手', glyph: 'o', color: '#8a9a4a', hp: 11, str: 3, def: 1, acc: 6, eva: 2, speed: 100, ai: 'ranged', sight: 9, damage: '1d6', xp: 9, depth: [4, 9], rarity: 5, tags: ['humanoid'], ranged: { damage: '1d6', range: 6, name: '矢' }, drops: 'mid' });
add('zombie', { name: '屍鬼', glyph: 'z', color: '#7a8a6a', hp: 18, str: 4, def: 1, acc: 3, eva: 0, speed: 70, ai: 'melee', sight: 5, damage: '1d8', xp: 9, depth: [4, 10], rarity: 6, tags: ['undead'] });
add('skeleton', { name: '骸骨兵', glyph: 'z', color: '#d8d2c0', hp: 13, str: 4, def: 3, acc: 5, eva: 2, speed: 100, ai: 'melee', sight: 7, damage: '1d7', xp: 9, depth: [4, 10], rarity: 6, tags: ['undead'], resist: { poison: 1 }, drops: 'mid' });
add('gnoll', { name: 'グノール', glyph: 'g', color: '#a07a3a', hp: 16, str: 5, def: 2, acc: 5, eva: 2, speed: 110, ai: 'pack', sight: 8, damage: '1d8+1', xp: 11, depth: [5, 10], rarity: 6, tags: ['humanoid'], packMin: 2, packMax: 3, drops: 'mid' });
add('ogre', { name: '人喰い鬼', glyph: 'O', color: '#9a6f4a', hp: 30, str: 7, def: 2, acc: 4, eva: 0, speed: 90, ai: 'melee', sight: 6, damage: '2d6', xp: 18, depth: [6, 12], rarity: 4, tags: ['giant'], drops: 'mid' });
add('cultist', { name: '邪教徒', glyph: 'c', color: '#9a4a7a', hp: 14, str: 3, def: 1, acc: 5, eva: 2, speed: 100, ai: 'caster', sight: 8, damage: '1d6', xp: 12, depth: [5, 11], rarity: 4, tags: ['humanoid'], spell: 'firebolt', spellPower: '2d4', spellRange: 6, drops: 'mid' });
add('imp', { name: '小鬼', glyph: 'i', color: '#c54e4e', hp: 10, str: 3, def: 1, acc: 6, eva: 5, speed: 120, ai: 'caster', sight: 8, damage: '1d5', xp: 11, depth: [5, 11], rarity: 4, tags: ['demon', 'flying'], spell: 'magicmissile', spellPower: '1d6', spellRange: 7 });
add('thief', { name: '盗賊', glyph: 't', color: '#c8b04a', hp: 12, str: 3, def: 1, acc: 6, eva: 6, speed: 120, ai: 'thief', sight: 8, damage: '1d5', xp: 10, depth: [4, 10], rarity: 3, tags: ['humanoid'], special: 'steal' });
add('mimic', { name: '擬態', glyph: 'm', color: '#b08040', hp: 20, str: 5, def: 3, acc: 5, eva: 0, speed: 100, ai: 'mimic', sight: 3, damage: '1d8', xp: 12, depth: [4, 11], rarity: 3, tags: [], special: 'mimic' });
add('wraith', { name: '怨霊', glyph: 'W', color: '#8a8ab0', hp: 16, str: 4, def: 2, acc: 6, eva: 4, speed: 110, ai: 'melee', sight: 8, damage: '1d8', xp: 14, depth: [7, 13], rarity: 4, tags: ['undead', 'flying'], status: { type: 'drain', turns: 1, power: 1, chance: 0.4 } });

/* ---- 深層（9-15） ---- */
add('troll', { name: 'トロル', glyph: 'T', color: '#5a8a5a', hp: 42, str: 8, def: 3, acc: 5, eva: 1, speed: 100, ai: 'melee', sight: 7, damage: '2d6+2', xp: 28, depth: [9, 15], rarity: 4, tags: ['giant'], regen: 2, drops: 'high' });
add('vampire', { name: '吸血鬼', glyph: 'V', color: '#b03a5a', hp: 36, str: 7, def: 4, acc: 7, eva: 4, speed: 110, ai: 'caster', sight: 9, damage: '1d10', xp: 30, depth: [10, 15], rarity: 3, tags: ['undead'], status: { type: 'drain', turns: 1, power: 2, chance: 0.6 }, spell: 'frostbolt', spellPower: '2d6', spellRange: 7, drops: 'high' });
add('drake', { name: '火竜の仔', glyph: 'D', color: '#d3532a', hp: 40, str: 7, def: 4, acc: 6, eva: 2, speed: 100, ai: 'ranged', sight: 9, damage: '2d6', xp: 32, depth: [9, 15], rarity: 3, tags: ['dragon'], ranged: { damage: '3d4', range: 6, name: '火炎', element: 'fire' }, resist: { fire: 0.5 }, drops: 'high' });
add('lich', { name: 'リッチ', glyph: 'L', color: '#9a6fc8', hp: 38, str: 5, def: 4, acc: 7, eva: 3, speed: 100, ai: 'caster', sight: 10, damage: '1d8', xp: 40, depth: [11, 15], rarity: 2, tags: ['undead'], spell: 'lightning', spellPower: '3d5', spellRange: 8, special: 'summon', resist: { poison: 1, frost: 0.5 }, drops: 'high' });
add('demon', { name: '大鬼', glyph: '&', color: '#c53a3a', hp: 55, str: 9, def: 5, acc: 7, eva: 2, speed: 110, ai: 'melee', sight: 8, damage: '2d8', xp: 50, depth: [12, 15], rarity: 2, tags: ['demon'], resist: { fire: 0.5 }, drops: 'high' });
add('golem', { name: '石像兵', glyph: '8', color: '#9a9486', hp: 60, str: 8, def: 7, acc: 5, eva: 0, speed: 80, ai: 'melee', sight: 6, damage: '2d6', xp: 38, depth: [10, 15], rarity: 2, tags: ['construct'], resist: { poison: 1, frost: 0.5 } });

/* ---- 主（各深層のヌシ・まれ） ---- */
add('king_kobold', { name: 'コボルドの王', glyph: 'K', color: '#9aff7a', hp: 22, str: 5, def: 3, acc: 6, eva: 3, speed: 110, ai: 'melee', sight: 8, damage: '1d8+1', xp: 20, depth: [3, 6], rarity: 1, tags: ['humanoid', 'unique'], drops: 'high', boss: true });
add('spider_queen', { name: '蜘蛛の女王', glyph: 'A', color: '#c87a9a', hp: 34, str: 6, def: 3, acc: 6, eva: 4, speed: 110, ai: 'caster', sight: 8, damage: '1d8', xp: 30, depth: [6, 10], rarity: 1, tags: ['animal', 'unique'], status: { type: 'poison', turns: 8, power: 2, chance: 0.6 }, special: 'summon', summonKey: 'spider', boss: true, drops: 'high' });

/* ---- 追補（浅層 1-4） ---- */
add('giant_rat', { name: '大鼠', glyph: 'r', color: '#b09a6a', hp: 8, str: 2, def: 0, acc: 3, eva: 2, speed: 110, ai: 'pack', sight: 6, damage: '1d4', xp: 3, depth: [2, 6], rarity: 6, tags: ['animal'], packMin: 2, packMax: 4 });
add('green_mold', { name: '緑カビ', glyph: 'F', color: '#6f9a4a', hp: 12, str: 3, def: 2, acc: 3, eva: 0, speed: 60, ai: 'stationary', sight: 2, damage: '1d4', xp: 4, depth: [1, 6], rarity: 4, tags: ['plant'], status: { type: 'poison', turns: 5, power: 1, chance: 0.5 } });
add('frog', { name: '毒蛙', glyph: 'f', color: '#7ab04a', hp: 6, str: 2, def: 0, acc: 4, eva: 4, speed: 110, ai: 'erratic', sight: 5, damage: '1d3', xp: 3, depth: [1, 5], rarity: 5, tags: ['animal'], status: { type: 'poison', turns: 4, power: 1, chance: 0.4 } });
add('mudling', { name: '泥人形', glyph: 'P', color: '#8a7a5a', hp: 14, str: 3, def: 2, acc: 3, eva: 0, speed: 70, ai: 'melee', sight: 5, damage: '1d6', xp: 5, depth: [2, 7], rarity: 4, tags: ['construct'], resist: { poison: 1 } });
add('wisp', { name: '火の粉', glyph: 'w', color: '#f5c84a', hp: 7, str: 2, def: 1, acc: 5, eva: 6, speed: 120, ai: 'ranged', sight: 8, damage: '1d4', xp: 6, depth: [3, 8], rarity: 3, tags: ['flying'], ranged: { damage: '1d6', range: 5, name: '火花', element: 'fire' } });
add('ant', { name: '大蟻', glyph: 'a', color: '#a05a3a', hp: 9, str: 3, def: 3, acc: 4, eva: 2, speed: 100, ai: 'pack', sight: 6, damage: '1d5', xp: 4, depth: [2, 7], rarity: 5, tags: ['animal'], packMin: 2, packMax: 4 });
add('centipede', { name: '大百足', glyph: 'c', color: '#b07a4a', hp: 7, str: 2, def: 1, acc: 5, eva: 3, speed: 110, ai: 'melee', sight: 5, damage: '1d4', xp: 4, depth: [2, 6], rarity: 4, tags: ['animal'], status: { type: 'poison', turns: 6, power: 1, chance: 0.5 } });

/* ---- 追補（中層 5-9） ---- */
add('wolf', { name: '狼', glyph: 'd', color: '#9aa0aa', hp: 16, str: 5, def: 1, acc: 5, eva: 4, speed: 130, ai: 'pack', sight: 9, damage: '1d8', xp: 10, depth: [4, 9], rarity: 6, tags: ['animal'], packMin: 2, packMax: 4 });
add('bear', { name: '熊', glyph: 'q', color: '#8a6a4a', hp: 34, str: 7, def: 2, acc: 5, eva: 1, speed: 100, ai: 'melee', sight: 7, damage: '2d5', xp: 18, depth: [5, 10], rarity: 3, tags: ['animal'] });
add('lizardman', { name: 'リザードマン', glyph: 'l', color: '#5a9a6a', hp: 18, str: 5, def: 3, acc: 5, eva: 3, speed: 100, ai: 'melee', sight: 7, damage: '1d8', xp: 12, depth: [5, 10], rarity: 6, tags: ['humanoid'], drops: 'mid', packMin: 1, packMax: 3 });
add('lizard_archer', { name: 'リザード弓', glyph: 'l', color: '#7aba6a', hp: 14, str: 4, def: 2, acc: 6, eva: 3, speed: 100, ai: 'ranged', sight: 9, damage: '1d6', xp: 12, depth: [5, 10], rarity: 4, tags: ['humanoid'], ranged: { damage: '1d8', range: 6, name: '矢' }, drops: 'mid' });
add('sahuagin', { name: 'サハギン', glyph: 'S', color: '#4a8aa0', hp: 18, str: 5, def: 2, acc: 5, eva: 4, speed: 110, ai: 'melee', sight: 7, damage: '1d8', xp: 13, depth: [4, 9], rarity: 4, tags: ['humanoid'] });
add('fire_lizard', { name: '火トカゲ', glyph: 'l', color: '#d3672a', hp: 20, str: 5, def: 3, acc: 5, eva: 3, speed: 100, ai: 'ranged', sight: 8, damage: '1d8', xp: 15, depth: [6, 11], rarity: 3, tags: ['animal'], ranged: { damage: '2d4', range: 5, name: '火炎', element: 'fire' }, resist: { fire: 0.5 } });
add('shadow', { name: '影', glyph: 'S', color: '#5a5a7a', hp: 16, str: 4, def: 2, acc: 6, eva: 6, speed: 110, ai: 'melee', sight: 8, damage: '1d8', xp: 14, depth: [6, 12], rarity: 3, tags: ['undead'], status: { type: 'drain', turns: 1, power: 1, chance: 0.3 } });
add('gargoyle', { name: 'ガーゴイル', glyph: 'G', color: '#8a8475', hp: 26, str: 6, def: 6, acc: 5, eva: 2, speed: 90, ai: 'melee', sight: 7, damage: '1d10', xp: 18, depth: [7, 12], rarity: 3, tags: ['construct', 'flying'], resist: { poison: 1 } });
add('harpy', { name: 'ハーピー', glyph: 'H', color: '#b09a6a', hp: 18, str: 4, def: 2, acc: 6, eva: 5, speed: 130, ai: 'ranged', sight: 9, damage: '1d6', xp: 14, depth: [6, 11], rarity: 3, tags: ['flying'], ranged: { damage: '1d6', range: 5, name: '羽根' } });
add('mummy', { name: 'ミイラ', glyph: 'M', color: '#c8b88a', hp: 28, str: 6, def: 3, acc: 5, eva: 0, speed: 80, ai: 'melee', sight: 6, damage: '1d10', xp: 20, depth: [7, 13], rarity: 3, tags: ['undead'], status: { type: 'slow', turns: 6, chance: 0.3 }, resist: { poison: 1 } });
add('rustmonster', { name: '錆喰い', glyph: 'R', color: '#a07a4a', hp: 20, str: 3, def: 4, acc: 5, eva: 3, speed: 100, ai: 'melee', sight: 6, damage: '1d4', xp: 12, depth: [5, 10], rarity: 2, tags: ['animal'], special: 'corrode' });

/* ---- 追補（深層 10-15） ---- */
add('wyvern', { name: 'ワイバーン', glyph: 'w', color: '#6a9a5a', hp: 44, str: 8, def: 4, acc: 6, eva: 3, speed: 120, ai: 'melee', sight: 9, damage: '2d6', xp: 30, depth: [10, 15], rarity: 3, tags: ['dragon', 'flying'], status: { type: 'poison', turns: 8, power: 2, chance: 0.4 }, drops: 'high' });
add('basilisk', { name: 'バジリスク', glyph: 'B', color: '#7a9a4a', hp: 38, str: 7, def: 5, acc: 6, eva: 2, speed: 90, ai: 'melee', sight: 7, damage: '1d10', xp: 34, depth: [11, 15], rarity: 2, tags: ['animal'], status: { type: 'paralyze', turns: 3, chance: 0.25 }, drops: 'high' });
add('mindflayer', { name: 'マインドフレイヤー', glyph: 'h', color: '#9a5ac8', hp: 34, str: 5, def: 4, acc: 7, eva: 4, speed: 100, ai: 'caster', sight: 9, damage: '1d8', xp: 38, depth: [11, 15], rarity: 2, tags: ['humanoid'], spell: 'lightning', spellPower: '2d6', spellRange: 7, status: { type: 'confuse', turns: 6, chance: 0.4 }, drops: 'high' });
add('necromancer', { name: '死霊術師', glyph: 'n', color: '#7a4a9a', hp: 30, str: 4, def: 3, acc: 6, eva: 3, speed: 100, ai: 'caster', sight: 9, damage: '1d6', xp: 36, depth: [10, 15], rarity: 2, tags: ['humanoid'], spell: 'frostbolt', spellPower: '2d5', spellRange: 7, special: 'summon', summonKey: 'skeleton', drops: 'high' });
add('iron_golem', { name: '鉄ゴーレム', glyph: '8', color: '#aab0bb', hp: 72, str: 9, def: 9, acc: 5, eva: 0, speed: 70, ai: 'melee', sight: 6, damage: '2d8', xp: 46, depth: [12, 15], rarity: 2, tags: ['construct'], resist: { poison: 1, frost: 0.5, fire: 0.5 } });
add('hellhound', { name: '地獄犬', glyph: 'd', color: '#c5402a', hp: 30, str: 6, def: 3, acc: 6, eva: 4, speed: 130, ai: 'pack', sight: 8, damage: '1d10', xp: 26, depth: [10, 15], rarity: 3, tags: ['demon'], ranged: { damage: '2d4', range: 4, name: '火息', element: 'fire' }, resist: { fire: 0.7 }, packMin: 1, packMax: 3 });
add('ent', { name: '古木', glyph: 'E', color: '#5a7a3a', hp: 60, str: 8, def: 6, acc: 4, eva: 0, speed: 70, ai: 'melee', sight: 6, damage: '2d6', xp: 38, depth: [11, 15], rarity: 2, tags: ['plant'], resist: { poison: 1 }, regen: 2 });
add('titan', { name: 'タイタン', glyph: 'T', color: '#c8c2a8', hp: 80, str: 11, def: 6, acc: 6, eva: 1, speed: 100, ai: 'melee', sight: 8, damage: '3d6', xp: 60, depth: [13, 15], rarity: 1, tags: ['giant'], drops: 'high' });

/* ---- ヌシ・最後の主 ---- */
add('dragon', { name: '古竜', glyph: 'D', color: '#d3532a', hp: 90, str: 10, def: 7, acc: 7, eva: 2, speed: 110, ai: 'ranged', sight: 10, damage: '2d8', xp: 80, depth: [12, 15], rarity: 1, tags: ['dragon', 'unique'], ranged: { damage: '4d5', range: 7, name: '劫火', element: 'fire' }, resist: { fire: 0.7 }, boss: true, drops: 'high' });
add('death_king', { name: '死の王', glyph: 'Ω', color: '#c89aff', hp: 120, str: 10, def: 8, acc: 8, eva: 3, speed: 110, ai: 'caster', sight: 11, damage: '2d8', xp: 120, depth: [14, 15], rarity: 1, tags: ['undead', 'unique'], spell: 'lightning', spellPower: '4d5', spellRange: 9, special: 'summon', summonKey: 'wraith', status: { type: 'drain', turns: 1, power: 2, chance: 0.5 }, resist: { poison: 1, frost: 0.5 }, boss: true, drops: 'high' });

export function getMonster(key) { return DB[key]; }
export function allMonsters() { return Object.values(DB); }

/* その深さで湧きうる魔物（boss は別枠） */
export function monstersForDepth(depth, includeBoss = false) {
  return Object.values(DB).filter(m => depth >= m.depth[0] && depth <= m.depth[1] && (includeBoss || !m.boss));
}
