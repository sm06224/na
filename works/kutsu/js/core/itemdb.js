/* ============================================================
   窟 — 品物の名鑑。武器・防具・薬・巻物・杖・指輪・食料。

   薬や巻物は正体を伏せ、潜行ごとに「見た目」を種で入れ替える
   （青い薬が回復とは限らない）。見た目の素材はここに溜める。
   ============================================================ */

const DB = {};
function add(key, def) { DB[key] = { key, ...def }; }

/* ===== 武器（slot: weapon） ===== */
add('dagger', { category: 'weapon', name: '短剣', glyph: ')', color: '#cfd6e0', slot: 'weapon', damage: '1d4', acc: 2, weight: 1, enchantable: true, depth: 1, rarity: 6 });
add('shortsword', { category: 'weapon', name: '短剣身', glyph: ')', color: '#d9dde6', slot: 'weapon', damage: '1d6', acc: 1, weight: 2, enchantable: true, depth: 1, rarity: 6 });
add('mace', { category: 'weapon', name: '鎚矛', glyph: ')', color: '#c2bca8', slot: 'weapon', damage: '1d6+1', acc: 0, weight: 3, enchantable: true, depth: 2, rarity: 5 });
add('longsword', { category: 'weapon', name: '長剣', glyph: ')', color: '#e0e4ee', slot: 'weapon', damage: '1d8', acc: 1, weight: 3, enchantable: true, depth: 3, rarity: 4 });
add('spear', { category: 'weapon', name: '槍', glyph: ')', color: '#cabf9a', slot: 'weapon', damage: '1d8', acc: 2, weight: 3, reach: true, enchantable: true, depth: 3, rarity: 4 });
add('battleaxe', { category: 'weapon', name: '戦斧', glyph: ')', color: '#c9c2b0', slot: 'weapon', damage: '1d10', acc: -1, weight: 5, twoHanded: true, enchantable: true, depth: 5, rarity: 3 });
add('warhammer', { category: 'weapon', name: '戦鎚', glyph: ')', color: '#b8b09c', slot: 'weapon', damage: '2d6', acc: -2, weight: 6, twoHanded: true, enchantable: true, depth: 7, rarity: 2 });
add('rapier', { category: 'weapon', name: '細剣', glyph: ')', color: '#e6ecf6', slot: 'weapon', damage: '1d7', acc: 4, weight: 1, enchantable: true, depth: 4, rarity: 3 });
add('greatsword', { category: 'weapon', name: '大剣', glyph: ')', color: '#eef2fb', slot: 'weapon', damage: '2d8', acc: 0, weight: 7, twoHanded: true, enchantable: true, depth: 9, rarity: 2 });

/* ===== 防具 ===== */
add('robe', { category: 'armor', name: 'ローブ', glyph: '[', color: '#8a7fb0', slot: 'armor', defense: 1, weight: 1, enchantable: true, depth: 1, rarity: 5 });
add('leather', { category: 'armor', name: '革鎧', glyph: '[', color: '#9a6f44', slot: 'armor', defense: 2, weight: 2, enchantable: true, depth: 1, rarity: 6 });
add('ringmail', { category: 'armor', name: '鎖帷子', glyph: '[', color: '#9aa0aa', slot: 'armor', defense: 4, weight: 4, enchantable: true, depth: 3, rarity: 4 });
add('chainmail', { category: 'armor', name: '鎖鎧', glyph: '[', color: '#aab0bb', slot: 'armor', defense: 5, weight: 5, eva: -1, enchantable: true, depth: 5, rarity: 3 });
add('platemail', { category: 'armor', name: '板金鎧', glyph: '[', color: '#c2c8d4', slot: 'armor', defense: 8, weight: 9, eva: -2, enchantable: true, depth: 8, rarity: 2 });
add('buckler', { category: 'armor', name: '小盾', glyph: '[', color: '#b08040', slot: 'shield', defense: 1, weight: 2, enchantable: true, depth: 2, rarity: 4 });
add('kiteshield', { category: 'armor', name: '凧盾', glyph: '[', color: '#c79456', slot: 'shield', defense: 3, weight: 4, eva: -1, enchantable: true, depth: 5, rarity: 3 });
add('cap', { category: 'armor', name: '革帽', glyph: '[', color: '#9a6f44', slot: 'helm', defense: 1, weight: 1, enchantable: true, depth: 1, rarity: 4 });
add('helm', { category: 'armor', name: '兜', glyph: '[', color: '#aab0bb', slot: 'helm', defense: 2, weight: 2, enchantable: true, depth: 4, rarity: 3 });
add('boots', { category: 'armor', name: '革靴', glyph: '[', color: '#9a6f44', slot: 'boots', defense: 1, weight: 1, enchantable: true, depth: 2, rarity: 3 });
add('cloak', { category: 'armor', name: '外套', glyph: '[', color: '#5f6f5a', slot: 'cloak', defense: 1, eva: 1, weight: 1, enchantable: true, depth: 3, rarity: 3 });

/* ===== 薬（potion・効果は effects.js） ===== */
add('p_heal', { category: 'potion', name: '回復の薬', glyph: '!', effect: 'heal', power: '2d8', stackable: true, depth: 1, rarity: 8, good: true });
add('p_fullheal', { category: 'potion', name: '全快の薬', glyph: '!', effect: 'fullheal', stackable: true, depth: 4, rarity: 3, good: true });
add('p_strength', { category: 'potion', name: '力の薬', glyph: '!', effect: 'strength', stackable: true, depth: 2, rarity: 4, good: true });
add('p_haste', { category: 'potion', name: '俊足の薬', glyph: '!', effect: 'haste', power: 20, stackable: true, depth: 3, rarity: 4, good: true });
add('p_might', { category: 'potion', name: '剛力の薬', glyph: '!', effect: 'might', power: 24, stackable: true, depth: 4, rarity: 3, good: true });
add('p_cure', { category: 'potion', name: '治癒の薬', glyph: '!', effect: 'cure', stackable: true, depth: 2, rarity: 5, good: true });
add('p_levit', { category: 'potion', name: '浮遊の薬', glyph: '!', effect: 'levitation', power: 30, stackable: true, depth: 3, rarity: 3, good: true });
add('p_vision', { category: 'potion', name: '千里眼の薬', glyph: '!', effect: 'telepathy', power: 40, stackable: true, depth: 4, rarity: 3, good: true });
add('p_poison', { category: 'potion', name: '毒の薬', glyph: '!', effect: 'poison', power: 12, stackable: true, depth: 1, rarity: 3, good: false });
add('p_confuse', { category: 'potion', name: '混乱の薬', glyph: '!', effect: 'confuse', power: 12, stackable: true, depth: 2, rarity: 3, good: false });
add('p_para', { category: 'potion', name: '麻痺の薬', glyph: '!', effect: 'paralyze', power: 6, stackable: true, depth: 3, rarity: 2, good: false });
add('p_xp', { category: 'potion', name: '叡智の薬', glyph: '!', effect: 'experience', stackable: true, depth: 5, rarity: 2, good: true });

/* ===== 巻物（scroll） ===== */
add('s_identify', { category: 'scroll', name: '鑑定の巻物', glyph: '?', effect: 'identify', stackable: true, depth: 1, rarity: 9, good: true });
add('s_teleport', { category: 'scroll', name: '瞬間移動の巻物', glyph: '?', effect: 'teleport', stackable: true, depth: 2, rarity: 6, good: true });
add('s_map', { category: 'scroll', name: '地図の巻物', glyph: '?', effect: 'magicmap', stackable: true, depth: 2, rarity: 5, good: true });
add('s_enchant', { category: 'scroll', name: '付呪の巻物', glyph: '?', effect: 'enchant', stackable: true, depth: 3, rarity: 5, good: true });
add('s_remove', { category: 'scroll', name: '解呪の巻物', glyph: '?', effect: 'remove_curse', stackable: true, depth: 3, rarity: 4, good: true });
add('s_light', { category: 'scroll', name: '光の巻物', glyph: '?', effect: 'light', stackable: true, depth: 1, rarity: 4, good: true });
add('s_detect', { category: 'scroll', name: '宝探知の巻物', glyph: '?', effect: 'detect_items', stackable: true, depth: 2, rarity: 3, good: true });
add('s_fear', { category: 'scroll', name: '恐慌の巻物', glyph: '?', effect: 'aggravate_or_fear', stackable: true, depth: 4, rarity: 3, good: true });
add('s_summon', { category: 'scroll', name: '召喚の巻物', glyph: '?', effect: 'summon', stackable: true, depth: 3, rarity: 2, good: false });
add('s_curse', { category: 'scroll', name: '呪詛の巻物', glyph: '?', effect: 'curse', stackable: true, depth: 2, rarity: 2, good: false });

/* ===== 杖（wand・遠隔） ===== */
add('w_fire', { category: 'wand', name: '火炎の杖', glyph: '/', effect: 'firebolt', power: '3d4', range: 7, charges: [3, 7], depth: 3, rarity: 4 });
add('w_frost', { category: 'wand', name: '氷結の杖', glyph: '/', effect: 'frostbolt', power: '2d5', range: 7, charges: [3, 7], depth: 4, rarity: 4 });
add('w_lightning', { category: 'wand', name: '雷撃の杖', glyph: '/', effect: 'lightning', power: '3d5', range: 8, charges: [2, 6], depth: 6, rarity: 3 });
add('w_magic', { category: 'wand', name: '魔法矢の杖', glyph: '/', effect: 'magicmissile', power: '2d4', range: 9, charges: [4, 9], depth: 2, rarity: 5 });
add('w_slow', { category: 'wand', name: '鈍化の杖', glyph: '/', effect: 'wand_slow', power: 20, range: 7, charges: [3, 6], depth: 3, rarity: 3 });
add('w_polymorph', { category: 'wand', name: '変身の杖', glyph: '/', effect: 'polymorph', range: 7, charges: [2, 5], depth: 5, rarity: 2 });
add('w_teleport', { category: 'wand', name: '転送の杖', glyph: '/', effect: 'wand_teleport', range: 8, charges: [3, 6], depth: 4, rarity: 3 });
add('w_dig', { category: 'wand', name: '掘削の杖', glyph: '/', effect: 'dig', range: 6, charges: [2, 5], depth: 4, rarity: 3 });

/* ===== 指輪（ring・常時効果） ===== */
add('r_protection', { category: 'ring', name: '守りの指輪', glyph: '=', slot: 'ring', passive: { def: 2 }, enchantable: true, depth: 3, rarity: 3 });
add('r_strength', { category: 'ring', name: '力の指輪', glyph: '=', slot: 'ring', passive: { str: 2 }, enchantable: true, depth: 4, rarity: 3 });
add('r_accuracy', { category: 'ring', name: '正確の指輪', glyph: '=', slot: 'ring', passive: { acc: 3 }, enchantable: true, depth: 3, rarity: 3 });
add('r_evasion', { category: 'ring', name: '回避の指輪', glyph: '=', slot: 'ring', passive: { eva: 3 }, enchantable: true, depth: 4, rarity: 3 });
add('r_regen', { category: 'ring', name: '再生の指輪', glyph: '=', slot: 'ring', passive: { regen: 1 }, depth: 5, rarity: 2 });
add('r_fire', { category: 'ring', name: '耐火の指輪', glyph: '=', slot: 'ring', passive: { resistFire: 0.5 }, depth: 5, rarity: 2 });

/* ===== 食料 ===== */
add('f_ration', { category: 'food', name: '携帯食', glyph: '%', color: '#b58b50', nutrition: 800, stackable: true, depth: 1, rarity: 7 });
add('f_apple', { category: 'food', name: '林檎', glyph: '%', color: '#c54e4e', nutrition: 200, stackable: true, depth: 1, rarity: 4 });
add('f_meat', { category: 'food', name: '干し肉', glyph: '%', color: '#a85c3a', nutrition: 500, stackable: true, depth: 2, rarity: 4 });
add('f_mushroom', { category: 'food', name: '茸', glyph: '%', color: '#c8b0c8', nutrition: 120, stackable: true, depth: 1, rarity: 3 });

/* ===== 護符（amulet・ゴール） ===== */
add('amulet', { category: 'amulet', name: '窟の護符', glyph: '"', color: '#ffd24a', goal: true, depth: 99, rarity: 0 });

/* ===== 追補：武器 ===== */
add('club', { category: 'weapon', name: '棍棒', glyph: ')', color: '#9a7a4a', slot: 'weapon', damage: '1d5', acc: 0, weight: 2, enchantable: true, depth: 1, rarity: 5 });
add('flail', { category: 'weapon', name: '連接棍', glyph: ')', color: '#bcb4a0', slot: 'weapon', damage: '1d8+1', acc: -1, weight: 4, enchantable: true, depth: 4, rarity: 4 });
add('katana', { category: 'weapon', name: '打刀', glyph: ')', color: '#e8eef8', slot: 'weapon', damage: '1d9', acc: 3, weight: 2, enchantable: true, depth: 6, rarity: 2 });
add('halberd', { category: 'weapon', name: '矛槍', glyph: ')', color: '#cabf9a', slot: 'weapon', damage: '1d10+1', acc: 0, weight: 6, twoHanded: true, reach: true, enchantable: true, depth: 6, rarity: 3 });
add('whip', { category: 'weapon', name: '鞭', glyph: ')', color: '#a06a3a', slot: 'weapon', damage: '1d4', acc: 3, weight: 1, reach: true, enchantable: true, depth: 3, rarity: 3 });
add('morningstar', { category: 'weapon', name: '星球棍', glyph: ')', color: '#c2bca8', slot: 'weapon', damage: '1d9', acc: -1, weight: 4, enchantable: true, depth: 5, rarity: 3 });

/* ===== 追補：防具 ===== */
add('studded', { category: 'armor', name: '鋲革鎧', glyph: '[', color: '#9a6f44', slot: 'armor', defense: 3, weight: 3, enchantable: true, depth: 2, rarity: 5 });
add('scalemail', { category: 'armor', name: '鱗鎧', glyph: '[', color: '#9aa6a0', slot: 'armor', defense: 6, weight: 6, eva: -1, enchantable: true, depth: 6, rarity: 3 });
add('splintmail', { category: 'armor', name: '札鎧', glyph: '[', color: '#b2b8c2', slot: 'armor', defense: 7, weight: 8, eva: -2, enchantable: true, depth: 7, rarity: 2 });
add('towershield', { category: 'armor', name: '大盾', glyph: '[', color: '#b8a070', slot: 'shield', defense: 4, weight: 6, eva: -2, enchantable: true, depth: 7, rarity: 2 });
add('greathelm', { category: 'armor', name: '大兜', glyph: '[', color: '#b2b8c2', slot: 'helm', defense: 3, weight: 3, eva: -1, enchantable: true, depth: 7, rarity: 2 });
add('greaves', { category: 'armor', name: '具足', glyph: '[', color: '#aab0bb', slot: 'boots', defense: 2, weight: 2, enchantable: true, depth: 5, rarity: 3 });

/* ===== 追補：薬・巻物・杖・指輪・食料 ===== */
add('p_invisible', { category: 'potion', name: '透明の薬', glyph: '!', effect: 'invisible', power: 24, stackable: true, depth: 5, rarity: 3, good: true });
add('p_clarity', { category: 'potion', name: '澄明の薬', glyph: '!', effect: 'cure', stackable: true, depth: 3, rarity: 4, good: true });
add('s_recharge', { category: 'scroll', name: '充填の巻物', glyph: '?', effect: 'recharge', stackable: true, depth: 4, rarity: 3, good: true });
add('s_deepdescent', { category: 'scroll', name: '転落の巻物', glyph: '?', effect: 'deep_descent', stackable: true, depth: 4, rarity: 2, good: true });
add('w_confuse', { category: 'wand', name: '惑乱の杖', glyph: '/', effect: 'wand_confuse', power: 12, range: 7, charges: [3, 6], depth: 3, rarity: 3 });
add('w_drain', { category: 'wand', name: '吸命の杖', glyph: '/', effect: 'wand_drain', power: '2d5', range: 7, charges: [2, 5], depth: 6, rarity: 2 });
add('r_might', { category: 'ring', name: '剛力の指輪', glyph: '=', slot: 'ring', passive: { str: 3 }, enchantable: true, depth: 6, rarity: 2 });
add('r_guard', { category: 'ring', name: '堅守の指輪', glyph: '=', slot: 'ring', passive: { def: 3 }, enchantable: true, depth: 6, rarity: 2 });
add('r_keen', { category: 'ring', name: '冴えの指輪', glyph: '=', slot: 'ring', passive: { acc: 2, eva: 2 }, enchantable: true, depth: 5, rarity: 2 });
add('f_jerky', { category: 'food', name: '干物', glyph: '%', color: '#a86b3a', nutrition: 350, stackable: true, depth: 2, rarity: 4 });
add('f_bread', { category: 'food', name: '堅麺麭', glyph: '%', color: '#c8a060', nutrition: 400, stackable: true, depth: 1, rarity: 5 });

/* ===== さらなる品 ===== */
add('p_heroism', { category: 'potion', name: '英雄の薬', glyph: '!', effect: 'heroism', stackable: true, depth: 5, rarity: 3, good: true });
add('s_blink', { category: 'scroll', name: '瞬きの巻物', glyph: '?', effect: 'blink', stackable: true, depth: 2, rarity: 4, good: true });
add('glaive', { category: 'weapon', name: '薙刀', glyph: ')', color: '#d6dae6', slot: 'weapon', damage: '1d10', acc: 1, weight: 5, twoHanded: true, reach: true, enchantable: true, depth: 5, rarity: 3 });
add('sabre', { category: 'weapon', name: '曲刀', glyph: ')', color: '#dde2ee', slot: 'weapon', damage: '1d7', acc: 2, weight: 2, enchantable: true, depth: 3, rarity: 4 });
add('brigandine', { category: 'armor', name: '胴丸', glyph: '[', color: '#9a8470', slot: 'armor', defense: 5, weight: 5, enchantable: true, depth: 5, rarity: 3 });
add('f_feast', { category: 'food', name: 'ごちそう', glyph: '%', color: '#d8a040', nutrition: 700, stackable: true, depth: 3, rarity: 2 });
add('maul', { category: 'weapon', name: '大槌', glyph: ')', color: '#b8b09c', slot: 'weapon', damage: '2d6+1', acc: -2, weight: 8, twoHanded: true, enchantable: true, depth: 8, rarity: 2 });
add('pike', { category: 'weapon', name: '長柄槍', glyph: ')', color: '#cabf9a', slot: 'weapon', damage: '1d9', acc: 2, weight: 4, reach: true, enchantable: true, depth: 5, rarity: 3 });
add('banded', { category: 'armor', name: '帯金鎧', glyph: '[', color: '#a6acb8', slot: 'armor', defense: 6, weight: 6, eva: -1, enchantable: true, depth: 6, rarity: 3 });
add('p_antidote', { category: 'potion', name: '解毒の薬', glyph: '!', effect: 'cure', stackable: true, depth: 2, rarity: 4, good: true });
add('s_holyword', { category: 'scroll', name: '聖句の巻物', glyph: '?', effect: 'aggravate_or_fear', stackable: true, depth: 5, rarity: 2, good: true });
add('f_cheese', { category: 'food', name: '乾酪', glyph: '%', color: '#d8c060', nutrition: 300, stackable: true, depth: 1, rarity: 4 });
add('handaxe', { category: 'weapon', name: '手斧', glyph: ')', color: '#c9c2b0', slot: 'weapon', damage: '1d6', acc: 1, weight: 2, enchantable: true, depth: 2, rarity: 5 });
add('trident', { category: 'weapon', name: '三叉', glyph: ')', color: '#cbd2dd', slot: 'weapon', damage: '1d9', acc: 1, weight: 4, reach: true, enchantable: true, depth: 6, rarity: 3 });
add('lamellar', { category: 'armor', name: '小札鎧', glyph: '[', color: '#a08a6a', slot: 'armor', defense: 4, weight: 4, enchantable: true, depth: 4, rarity: 4 });
add('hood', { category: 'armor', name: '頭巾', glyph: '[', color: '#6a6a5a', slot: 'helm', defense: 1, eva: 1, weight: 1, enchantable: true, depth: 3, rarity: 3 });
add('r_warding', { category: 'ring', name: '結界の指輪', glyph: '=', slot: 'ring', passive: { def: 1, eva: 1 }, enchantable: true, depth: 4, rarity: 3 });
add('p_clairvoyance', { category: 'potion', name: '透視の薬', glyph: '!', effect: 'magicmap', stackable: true, depth: 4, rarity: 2, good: true });
add('falchion', { category: 'weapon', name: '青龍刀', glyph: ')', color: '#dde2ee', slot: 'weapon', damage: '1d8', acc: 1, weight: 3, enchantable: true, depth: 4, rarity: 4 });
add('estoc', { category: 'weapon', name: '刺突剣', glyph: ')', color: '#e6ecf6', slot: 'weapon', damage: '1d8', acc: 3, weight: 2, enchantable: true, depth: 6, rarity: 3 });
add('warpick', { category: 'weapon', name: '戦鶴嘴', glyph: ')', color: '#bcb4a0', slot: 'weapon', damage: '1d8+1', acc: 0, weight: 4, enchantable: true, depth: 5, rarity: 3 });
add('fieldplate', { category: 'armor', name: '騎士鎧', glyph: '[', color: '#c2c8d4', slot: 'armor', defense: 7, weight: 8, eva: -2, enchantable: true, depth: 8, rarity: 2 });
add('roundshield', { category: 'armor', name: '円盾', glyph: '[', color: '#b08040', slot: 'shield', defense: 2, weight: 3, enchantable: true, depth: 3, rarity: 4 });
add('sandals', { category: 'armor', name: '韋駄天の沓', glyph: '[', color: '#b89a6a', slot: 'boots', defense: 1, eva: 2, weight: 1, enchantable: true, depth: 4, rarity: 2 });
add('f_honey', { category: 'food', name: '蜂蜜', glyph: '%', color: '#e0b040', nutrition: 250, stackable: true, depth: 2, rarity: 3 });
add('f_roast', { category: 'food', name: '焼き肉', glyph: '%', color: '#b05a3a', nutrition: 600, stackable: true, depth: 4, rarity: 3 });
add('r_haleness', { category: 'ring', name: '健勝の指輪', glyph: '=', slot: 'ring', passive: { regen: 1, def: 1 }, depth: 6, rarity: 2 });
add('p_clarity2', { category: 'potion', name: '明察の薬', glyph: '!', effect: 'telepathy', power: 40, stackable: true, depth: 5, rarity: 2, good: true });

/* ===== 遺物（artifact・唯一・名のある品。見た目は隠さない） ===== */
add('art_yosuzume', { category: 'weapon', name: '銘刀「夜雀」', glyph: ')', color: '#bcd0ff', slot: 'weapon', damage: '1d8+1', acc: 3, weight: 2, artifact: true, unique: true, rarity: 0, depth: 6, passive: { eva: 2 }, brand: { status: { type: 'slow', turns: 6 }, chance: 0.4, element: 'frost' } });
add('art_kagutsuchi', { category: 'weapon', name: '火刀「カグツチ」', glyph: ')', color: '#ff9a4a', slot: 'weapon', damage: '1d9+1', acc: 2, weight: 3, artifact: true, unique: true, rarity: 0, depth: 9, passive: { str: 1 }, brand: { status: { type: 'burning', turns: 3, power: 2 }, chance: 0.45, element: 'fire' } });
add('art_kubikiri', { category: 'weapon', name: '大太刀「首切」', glyph: ')', color: '#eef2fb', slot: 'weapon', damage: '2d7', acc: 1, weight: 6, twoHanded: true, artifact: true, unique: true, rarity: 0, depth: 12, passive: { str: 2, acc: 1 } });
add('art_aegis', { category: 'armor', name: '古盾「アイギス」', glyph: '[', color: '#d8c878', slot: 'shield', defense: 5, weight: 4, artifact: true, unique: true, rarity: 0, depth: 8, passive: { def: 2, resistFire: 0.3 } });
add('art_oitamashii', { category: 'armor', name: '老鎧「負魂」', glyph: '[', color: '#9a8a6a', slot: 'armor', defense: 7, weight: 6, artifact: true, unique: true, rarity: 0, depth: 10, passive: { regen: 1, def: 1 } });
add('art_tsukikage', { category: 'armor', name: '月影の外套', glyph: '[', color: '#9aa0d8', slot: 'cloak', defense: 2, weight: 1, artifact: true, unique: true, rarity: 0, depth: 7, passive: { eva: 3 } });
add('art_homura', { category: 'ring', name: '焔石の指輪', glyph: '=', color: '#ff7a4a', slot: 'ring', artifact: true, unique: true, rarity: 0, depth: 8, passive: { resistFire: 0.6, str: 1 } });
add('art_inori', { category: 'ring', name: '祈りの指輪', glyph: '=', color: '#d8e0ff', slot: 'ring', artifact: true, unique: true, rarity: 0, depth: 9, passive: { regen: 2, def: 1 } });
add('art_kazeori', { category: 'ring', name: '風折の指輪', glyph: '=', color: '#9af0c0', slot: 'ring', artifact: true, unique: true, rarity: 0, depth: 7, passive: { eva: 3, acc: 2 } });

export function artifactDefs() { return Object.values(DB).filter(d => d.artifact); }
export function artifactsForDepth(depth) { return artifactDefs().filter(d => (d.depth || 1) <= depth); }

/* ----- 見た目（未鑑定の素材）。idStore が種でこれを役職に割り当てる ----- */
export const APPEARANCE = {
  potion: ['青', '赤', '緑', '黄', '紫', '橙', '桃', '黒', '白', '銀', '金', '濁った', '泡立つ', '光る', '澄んだ', '油状の', '虹色の', '灰の'],
  scroll: ['ゾフ', 'クネ', 'ガリ', 'ムベ', 'トロン', 'ヤヌ', 'ペシ', 'ウルカ', 'ネブ', 'ザザ', 'フム', 'リエン', 'ダグ', 'コホ'],
  wand: ['樫の', '鉄の', '骨の', '硝子の', '銀の', '黒檀の', '水晶の', '錆びた', '捻れた', '象牙の'],
  ring: ['翡翠の', '紅玉の', '鋼の', '真鍮の', '黒曜の', '瑪瑙の', '琥珀の', '真珠の', '青玉の', '金剛の', '紫水晶の'],
};

export function getItemDef(key) { return DB[key]; }
export function allItemDefs() { return Object.values(DB); }
export function itemKeysByCategory(cat) { return Object.values(DB).filter(d => d.category === cat && !d.artifact).map(d => d.key); }

/* ある深さで出うる品（落とし物テーブル用） */
export function itemsForDepth(depth) {
  return Object.values(DB).filter(d => d.depth && d.depth <= depth && d.rarity > 0 && !d.goal);
}
