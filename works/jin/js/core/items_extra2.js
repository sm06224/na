/* ============================================================
   陣 — 第二幕・竜の終章の至宝。
   王権の遺物たる伝説の武具（S ランク・銘あり・高威力高必殺）、
   竜・魔物・屍者に特効を帯びた神器、聖と闇の秘伝書、神杖、
   勇者の風格を持つ大業物、強力な装飾、稀少な薬と恒久の宝。
   すべて終盤の品として釣り合いを保つ（値 3000〜20000）。
   既存の登録に重ねるのみ。 id はすべて新規。
   ============================================================ */

import { ITEMS } from './items.js';

function def(o) { ITEMS[o.id] = o; return o; }

/* ---- 剣：王権の遺物・竜殺し ---- */
def({ id: 'tyrfing_jp', name: '神剣テュルヴィング', kind: 'weapon', wtype: 'sword', rank: 'S', mt: 16, hit: 90, crit: 15, wt: 9, min: 1, max: 1, price: 14000, desc: '王家に伝わる神剣。魔防をも厚く守ると伝わる。' });
def({ id: 'falchion_jp', name: '竜断剣ファルシオン', kind: 'weapon', wtype: 'sword', rank: 'S', mt: 16, hit: 95, crit: 10, wt: 8, min: 1, max: 1, price: 16000, eff: ['dragon'], desc: '竜を断つ聖王の御剣。竜族に特効。' });
def({ id: 'ragnell_jp', name: '黄金剣ラグネル', kind: 'weapon', wtype: 'sword', rank: 'S', mt: 18, hit: 90, crit: 5, wt: 12, min: 1, max: 2, price: 17000, desc: '遠近を断つ黄金の聖剣。守りも固める。' });
def({ id: 'dragonbane_sword', name: '竜牙剣', kind: 'weapon', wtype: 'sword', rank: 'S', mt: 15, hit: 90, crit: 15, wt: 9, min: 1, max: 1, price: 13000, eff: ['dragon'], desc: '竜の牙より鍛えし剣。竜に深く突き立つ。' });
def({ id: 'wyrmslayer_jp', name: '殺竜の刃', kind: 'weapon', wtype: 'sword', rank: 'A', mt: 9, hit: 90, crit: 10, wt: 7, min: 1, max: 1, price: 4000, eff: ['dragon'], desc: '竜鱗の隙を突く軽き刃。竜に特効。' });
def({ id: 'demon_breaker', name: '破魔の太刀', kind: 'weapon', wtype: 'sword', rank: 'A', mt: 14, hit: 85, crit: 10, wt: 9, min: 1, max: 1, price: 5000, eff: ['monster'], desc: '魔物を祓う清めの太刀。' });

/* ---- 槍：竜の終章の名槍 ---- */
def({ id: 'gradivus_jp', name: '魔槍グラディウス', kind: 'weapon', wtype: 'lance', rank: 'S', mt: 17, hit: 85, crit: 10, wt: 12, min: 1, max: 2, price: 14000, desc: '遠近を貫く不滅の魔槍。' });
def({ id: 'wyrmlance_jp', name: '竜殺しの槍', kind: 'weapon', wtype: 'lance', rank: 'S', mt: 16, hit: 80, crit: 5, wt: 12, min: 1, max: 1, price: 13000, eff: ['dragon'], desc: '竜の心臓を狙う伝説の槍。竜に特効。' });
def({ id: 'vidofnir_jp', name: '聖槍ヴィドフニル', kind: 'weapon', wtype: 'lance', rank: 'S', mt: 15, hit: 85, crit: 5, wt: 11, min: 1, max: 1, price: 12000, desc: '物理の刃を弾く加護を帯びた聖槍。' });
def({ id: 'monster_lance', name: '退魔の槍', kind: 'weapon', wtype: 'lance', rank: 'A', mt: 13, hit: 80, crit: 5, wt: 11, min: 1, max: 1, price: 4500, eff: ['monster'], desc: '異形を貫く清めの槍。魔物に特効。' });

/* ---- 斧：雷神・竜砕き ---- */
def({ id: 'helswath_jp', name: '冥斧ヘルスワス', kind: 'weapon', wtype: 'axe', rank: 'S', mt: 19, hit: 80, crit: 5, wt: 16, min: 1, max: 2, price: 14000, desc: '冥府の力を宿す遠近の大斧。' });
def({ id: 'urvan_jp', name: '守斧ウルヴァン', kind: 'weapon', wtype: 'axe', rank: 'S', mt: 17, hit: 85, crit: 0, wt: 15, min: 1, max: 1, price: 12000, desc: '連撃を弾き返すと伝わる堅守の聖斧。' });
def({ id: 'dragon_axe', name: '竜砕きの斧', kind: 'weapon', wtype: 'axe', rank: 'S', mt: 18, hit: 80, crit: 5, wt: 16, min: 1, max: 1, price: 13000, eff: ['dragon'], desc: '竜の鱗を打ち砕く伝説の大斧。竜に特効。' });
def({ id: 'undead_axe', name: '浄めの戦斧', kind: 'weapon', wtype: 'axe', rank: 'A', mt: 14, hit: 75, crit: 5, wt: 15, min: 1, max: 1, price: 4500, eff: ['undead'], desc: '屍者を打ち砕く清めの戦斧。' });

/* ---- 弓：竜を射る神弓 ---- */
def({ id: 'nidhogg_jp', name: '神弓ニーズヘッグ', kind: 'weapon', wtype: 'bow', rank: 'S', mt: 16, hit: 85, crit: 10, wt: 10, min: 2, max: 2, price: 13000, eff: ['fly'], desc: '大蛇を象る神弓。空をゆく者を射落とす。' });
def({ id: 'dragon_bow', name: '竜殺しの弓', kind: 'weapon', wtype: 'bow', rank: 'S', mt: 15, hit: 85, crit: 10, wt: 9, min: 2, max: 2, price: 13000, eff: ['dragon', 'fly'], desc: '竜と飛行を射抜く伝説の弓。' });
def({ id: 'monster_bow', name: '退魔の弓', kind: 'weapon', wtype: 'bow', rank: 'A', mt: 12, hit: 80, crit: 5, wt: 8, min: 2, max: 2, price: 4000, eff: ['monster', 'fly'], desc: '異形を射貫く清めの弓。' });

/* ---- 理（アニマ）：滅竜の秘伝書 ---- */
def({ id: 'excalibur_jp', name: '風神エクスカリバー', kind: 'weapon', wtype: 'anima', rank: 'S', mt: 15, hit: 95, crit: 20, wt: 11, min: 1, max: 2, magic: true, eff: ['fly'], price: 14000, desc: '風の神威を宿す秘伝の理。飛行に特効。' });
def({ id: 'ragnarok_jp', name: '滅炎ラグナロク', kind: 'weapon', wtype: 'anima', rank: 'S', mt: 18, hit: 90, crit: 10, wt: 13, min: 1, max: 2, magic: true, backfire: 0.1, price: 13000, desc: '万物を焼く滅びの炎。時に術者をも焦がす。' });
def({ id: 'gleipnir_jp', name: '縛竜グレイプニル', kind: 'weapon', wtype: 'anima', rank: 'S', mt: 16, hit: 85, crit: 5, wt: 12, min: 1, max: 2, magic: true, eff: ['dragon'], price: 13000, desc: '竜をも縛る秘理。竜族に特効。' });

/* ---- 光：神威の聖典 ---- */
def({ id: 'naga_jp', name: '神竜の理ナーガ', kind: 'weapon', wtype: 'light', rank: 'S', mt: 16, hit: 95, crit: 10, wt: 11, min: 1, max: 2, magic: true, eff: ['dragon'], price: 16000, desc: '神竜の加護を宿す至高の聖典。竜に特効。' });
def({ id: 'ivaldi_jp', name: '聖典イーヴァルディ', kind: 'weapon', wtype: 'light', rank: 'S', mt: 15, hit: 90, crit: 10, wt: 11, min: 1, max: 2, magic: true, eff: ['undead'], price: 13000, desc: '守りを照らす聖光の書。屍者に特効。' });
def({ id: 'starlight_jp', name: '星辰の書', kind: 'weapon', wtype: 'light', rank: 'S', mt: 14, hit: 95, crit: 5, wt: 10, min: 1, max: 2, magic: true, eff: ['dark'], price: 12000, desc: '闇を祓う星の光。闇に深く刺さる。' });

/* ---- 闇：禁断の魔導書 ---- */
def({ id: 'loptous_jp', name: '邪竜の書ロプトウス', kind: 'weapon', wtype: 'dark', rank: 'S', mt: 17, hit: 85, crit: 10, wt: 13, min: 1, max: 2, magic: true, drain: true, eff: ['dragon'], price: 15000, desc: '邪竜の力を宿す禁書。竜を侵し、傷を吸う。' });
def({ id: 'gespenst_jp', name: '深淵の書', kind: 'weapon', wtype: 'dark', rank: 'S', mt: 16, hit: 90, crit: 5, wt: 12, min: 1, max: 2, magic: true, price: 12000, desc: '深淵を覗く禁断の魔導書。' });
def({ id: 'soul_eater', name: '喰魂の書', kind: 'weapon', wtype: 'dark', rank: 'A', mt: 12, hit: 80, crit: 5, wt: 12, min: 1, max: 2, magic: true, drain: true, eff: ['monster'], price: 5000, desc: '魔物の魂を喰らい、術者を癒す闇。' });

/* ---- 拳：龍神の業 ---- */
def({ id: 'dragon_claw', name: '龍神爪', kind: 'weapon', wtype: 'fist', rank: 'S', mt: 14, hit: 90, crit: 25, wt: 5, min: 1, max: 1, price: 12000, eff: ['dragon'], desc: '龍神の気を爪に込めた伝説の拳。竜に特効。' });
def({ id: 'tiger_fist', name: '虎牙拳', kind: 'weapon', wtype: 'fist', rank: 'S', mt: 16, hit: 85, crit: 15, wt: 7, min: 1, max: 1, price: 11000, desc: '虎の牙のごとき必殺の連打。' });

/* ---- 短剣：闇に紛れる暗器 ---- */
def({ id: 'baselard_jp', name: '黒曜の暗器', kind: 'weapon', wtype: 'dagger', rank: 'S', mt: 11, hit: 95, crit: 20, wt: 5, min: 1, max: 2, price: 11000, debuff: { def: -6, res: -6 }, desc: '闇に紛れて守りを大きく削る至高の暗器。' });
def({ id: 'dragon_dagger', name: '竜鱗削り', kind: 'weapon', wtype: 'dagger', rank: 'A', mt: 7, hit: 95, crit: 10, wt: 4, min: 1, max: 2, price: 4000, eff: ['dragon'], debuff: { def: -4, res: -4 }, desc: '竜鱗を削ぎ落とす暗器。竜に特効。' });

/* ---- 杖：神威の癒し ---- */
def({ id: 'aum_staff', name: 'オーム', kind: 'weapon', wtype: 'staff', rank: 'S', mt: 0, hit: 100, crit: 0, wt: 10, min: 1, max: 1, staff: 'heal', power: 99, price: 18000, desc: '生命を呼び戻すと伝わる神杖。傷をすべて癒す。' });
def({ id: 'sublime_fortify', name: '聖癒の杖', kind: 'weapon', wtype: 'staff', rank: 'S', mt: 0, hit: 100, crit: 0, wt: 9, min: 1, max: 4, staff: 'healAll', power: 30, price: 16000, desc: '広く味方を癒す神威の杖。' });
def({ id: 'matrona_staff', name: 'リミット', kind: 'weapon', wtype: 'staff', rank: 'A', mt: 0, hit: 100, crit: 0, wt: 5, min: 1, max: 10, staff: 'heal', power: 99, price: 12000, desc: '遠く離れた味方の傷をすべて癒す。' });

/* ---- 消耗品：稀少な秘薬 ---- */
def({ id: 'divine_elixir', name: '神々の秘薬', kind: 'consumable', use: 'healFull', uses: 5, price: 6000, desc: 'HP を全快（5 回）。' });
def({ id: 'phoenix_tear', name: '不死鳥の涙', kind: 'consumable', use: 'healFull', uses: 3, price: 4000, desc: 'HP を全快（3 回）。' });
def({ id: 'ambrosia', name: '神酒アンブロシア', kind: 'consumable', use: 'healFull', uses: 1, price: 3000, desc: 'HP を全快（1 回）。' });
def({ id: 'holy_water_plus', name: '大聖水', kind: 'consumable', use: 'buffRes', power: 12, uses: 3, price: 1500, desc: '魔防を一時的に +12（3 ターン）。' });
def({ id: 'dragon_balm', name: '竜血の霊薬', kind: 'consumable', use: 'buffDef', power: 12, uses: 3, price: 1500, desc: '守を一時的に +12（3 ターン）。' });
def({ id: 'master_seal_potion', name: '英雄の妙薬', kind: 'consumable', use: 'cure', uses: 10, price: 1500, desc: '状態異常を解く（10 回）。' });

/* ---- 能力上昇アイテム（恒久） ---- */
def({ id: 'dracoshield_great', name: '大竜の盾', kind: 'booster', stat: 'def', amount: 5, price: 14000, desc: '守 +5（永続）。' });
def({ id: 'great_talisman', name: '大魔除け', kind: 'booster', stat: 'res', amount: 5, price: 14000, desc: '魔防 +5（永続）。' });
def({ id: 'titan_drop', name: '剛力の雫', kind: 'booster', stat: 'str', amount: 5, price: 16000, desc: '力 +5（永続）。' });
def({ id: 'archsage_dust', name: '賢神の雫', kind: 'booster', stat: 'mag', amount: 5, price: 16000, desc: '魔 +5（永続）。' });
def({ id: 'fleet_boots', name: '神速の靴', kind: 'booster', stat: 'mov', amount: 2, price: 18000, desc: '移動 +2（永続）。' });
def({ id: 'celestial_robe', name: '天界の衣', kind: 'booster', stat: 'hp', amount: 15, price: 15000, desc: '最大 HP +15（永続）。' });
def({ id: 'star_speedwing', name: '流星の翼', kind: 'booster', stat: 'spd', amount: 5, price: 16000, desc: '速さ +5（永続）。' });

/* ---- 装飾（装備中つねに効果） ---- */
def({ id: 'dragon_ring', name: '竜鱗の指輪', kind: 'accessory', bonus: { def: 5, res: 5 }, price: 12000, desc: '守 +5、魔防 +5。' });
def({ id: 'aegis_ring', name: '聖盾の指輪', kind: 'accessory', bonus: { def: 7 }, price: 11000, desc: '守 +7。' });
def({ id: 'wyrmguard_ring', name: '護竜の指輪', kind: 'accessory', bonus: { res: 7 }, eff: ['dragon'], price: 13000, desc: '魔防 +7。竜の特効を退ける。' });
def({ id: 'champions_ring', name: '覇者の指輪', kind: 'accessory', bonus: { str: 4, spd: 4 }, price: 12000, desc: '力 +4、速さ +4。' });
def({ id: 'sages_crown', name: '賢神の冠', kind: 'accessory', bonus: { mag: 4, res: 4 }, price: 12000, desc: '魔 +4、魔防 +4。' });
def({ id: 'hawkeye_ring', name: '隼眼の指輪', kind: 'accessory', bonus: { hit: 25, crit: 15 }, price: 10000, desc: '命中 +25、必殺 +15。' });
def({ id: 'fortune_pendant', name: '幸運の護符', kind: 'accessory', bonus: { lck: 10 }, price: 9000, desc: '運 +10。' });

/* 追加した品の数 */
export const EXTRA2_ITEM_COUNT = 53;
export default true;
