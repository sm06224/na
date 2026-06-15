/* ============================================================
   陣 — 追加の武器・道具・装飾。
   既存の登録（items.js）に重ねて、より多くの品を陣に加える。
   伝説の名品、上位の鋼・銀、リーバー（逆三すくみ／説明上の妙）、
   勇者（ここでは普通の武器）、更なる魔道書・杖・短剣・拳、
   消耗品・能力上昇・装飾を揃える。すべて値があり、店に並ぶ。
   ============================================================ */

import { ITEMS } from './items.js';

function def(o) { ITEMS[o.id] = o; return o; }

/* ---- 剣：上位・名剣 ---- */
def({ id: 'mithril_sword', name: '銀光の剣', kind: 'weapon', wtype: 'sword', rank: 'B', mt: 11, hit: 80, crit: 0, wt: 9, min: 1, max: 1, price: 1500, desc: '銀に次ぐ輝きの剣。' });
def({ id: 'brave_sword', name: '勇者の剣', kind: 'weapon', wtype: 'sword', rank: 'A', mt: 9, hit: 75, crit: 0, wt: 12, min: 1, max: 1, price: 3000, desc: '一閃が二度走るという名剣（ここでは重き業物）。' });
def({ id: 'zanbato', name: '斬馬刀', kind: 'weapon', wtype: 'sword', rank: 'C', mt: 9, hit: 75, crit: 0, wt: 13, min: 1, max: 1, price: 1300, eff: ['ride'], desc: '騎馬を断つ長刀。' });
def({ id: 'reaver_blade', name: '逆刃の剣', kind: 'weapon', wtype: 'sword', rank: 'C', mt: 10, hit: 75, crit: 0, wt: 12, min: 1, max: 1, price: 1700, desc: '三すくみが逆しまに働く呪いの刃。' });
def({ id: 'sol_katti', name: '陽炎丸', kind: 'weapon', wtype: 'sword', rank: 'S', mt: 12, hit: 90, crit: 20, wt: 6, min: 1, max: 1, price: 12000, desc: '陽の御剣。軽く、よく当たり、傷を癒すと伝わる。' });
def({ id: 'durandal_jp', name: '焔帝刀', kind: 'weapon', wtype: 'sword', rank: 'S', mt: 17, hit: 90, crit: 10, wt: 11, min: 1, max: 1, price: 13000, eff: ['armor'], desc: '炎を宿す帝の剣。重装を断つ。' });
def({ id: 'rapier_jp', name: '麗刃', kind: 'weapon', wtype: 'sword', rank: 'E', mt: 7, hit: 95, crit: 10, wt: 5, min: 1, max: 1, price: 1300, eff: ['armor', 'ride'], desc: '貴き細剣。重装と騎馬に特効。' });

/* ---- 槍：上位・名槍 ---- */
def({ id: 'mithril_lance', name: '銀光の槍', kind: 'weapon', wtype: 'lance', rank: 'B', mt: 12, hit: 70, crit: 0, wt: 11, min: 1, max: 1, price: 1300, desc: '銀に次ぐ輝きの槍。' });
def({ id: 'brave_lance', name: '勇者の槍', kind: 'weapon', wtype: 'lance', rank: 'A', mt: 10, hit: 70, crit: 0, wt: 14, min: 1, max: 1, price: 3000, desc: '連撃を呼ぶ名槍（ここでは重き業物）。' });
def({ id: 'killer_lance', name: 'キラーランス', kind: 'weapon', wtype: 'lance', rank: 'C', mt: 10, hit: 75, crit: 30, wt: 9, min: 1, max: 1, price: 1400, desc: '会心を呼ぶ槍。' });
def({ id: 'reaver_lance', name: '逆刃の槍', kind: 'weapon', wtype: 'lance', rank: 'C', mt: 11, hit: 65, crit: 0, wt: 14, min: 1, max: 1, price: 1600, desc: '三すくみが逆しまに働く呪いの槍。' });
def({ id: 'heavy_spear', name: '重盾槍', kind: 'weapon', wtype: 'lance', rank: 'D', mt: 9, hit: 70, crit: 0, wt: 13, min: 1, max: 1, price: 1100, eff: ['armor'], desc: '重装を貫く太槍。' });
def({ id: 'gae_bolg', name: '紅蓮槍', kind: 'weapon', wtype: 'lance', rank: 'S', mt: 19, hit: 80, crit: 5, wt: 13, min: 1, max: 2, price: 13000, eff: ['ride'], desc: '紅蓮を放つ伝説の槍。遠近を断ち、騎馬に特効。' });

/* ---- 斧：上位・名斧 ---- */
def({ id: 'mithril_axe', name: '銀光の斧', kind: 'weapon', wtype: 'axe', rank: 'B', mt: 13, hit: 65, crit: 0, wt: 13, min: 1, max: 1, price: 1100, desc: '銀に次ぐ輝きの斧。' });
def({ id: 'brave_axe', name: '勇者の斧', kind: 'weapon', wtype: 'axe', rank: 'A', mt: 11, hit: 65, crit: 0, wt: 16, min: 1, max: 1, price: 3000, desc: '連撃を呼ぶ名斧（ここでは重き業物）。' });
def({ id: 'killer_axe', name: 'キラーアクス', kind: 'weapon', wtype: 'axe', rank: 'C', mt: 11, hit: 65, crit: 30, wt: 12, min: 1, max: 1, price: 1300, desc: '会心を呼ぶ斧。' });
def({ id: 'reaver_axe', name: '逆刃の斧', kind: 'weapon', wtype: 'axe', rank: 'C', mt: 13, hit: 60, crit: 0, wt: 16, min: 1, max: 1, price: 1500, desc: '三すくみが逆しまに働く呪いの斧。' });
def({ id: 'tomahawk', name: '飛斧トマホーク', kind: 'weapon', wtype: 'axe', rank: 'B', mt: 13, hit: 65, crit: 0, wt: 14, min: 1, max: 2, price: 2400, desc: '遠近を打つ業物の投げ斧。' });
def({ id: 'armads_jp', name: '雷鳴斧', kind: 'weapon', wtype: 'axe', rank: 'S', mt: 18, hit: 85, crit: 0, wt: 16, min: 1, max: 1, price: 12000, desc: '雷鳴を呼ぶ伝説の大斧。守りも固める。' });

/* ---- 弓：上位・名弓 ---- */
def({ id: 'mithril_bow', name: '銀光の弓', kind: 'weapon', wtype: 'bow', rank: 'B', mt: 11, hit: 75, crit: 0, wt: 8, min: 2, max: 2, price: 1300, eff: ['fly'], desc: '銀に次ぐ輝きの弓。' });
def({ id: 'brave_bow', name: '勇者の弓', kind: 'weapon', wtype: 'bow', rank: 'A', mt: 9, hit: 70, crit: 0, wt: 12, min: 2, max: 2, price: 3000, eff: ['fly'], desc: '連射を呼ぶ名弓（ここでは重き業物）。' });
def({ id: 'short_bow', name: '小弓', kind: 'weapon', wtype: 'bow', rank: 'E', mt: 5, hit: 90, crit: 5, wt: 4, min: 2, max: 2, price: 700, eff: ['fly'], desc: '取り回しのよい小ぶりの弓。' });
def({ id: 'rienfleche', name: '蒼天弓', kind: 'weapon', wtype: 'bow', rank: 'S', mt: 15, hit: 85, crit: 10, wt: 10, min: 2, max: 3, price: 12000, eff: ['fly'], desc: '蒼天を裂く伝説の弓。飛行を射落とす。' });

/* ---- 理（アニマ）：上位・名書 ---- */
def({ id: 'elthunder', name: 'エルサンダー', kind: 'weapon', wtype: 'anima', rank: 'C', mt: 11, hit: 80, crit: 5, wt: 8, min: 1, max: 2, magic: true, price: 1300, desc: '強き雷の魔道書。' });
def({ id: 'fimbulvetr', name: 'フィンブル', kind: 'weapon', wtype: 'anima', rank: 'B', mt: 13, hit: 80, crit: 0, wt: 11, min: 1, max: 2, magic: true, price: 2200, desc: '吹雪を呼ぶ理の書。' });
def({ id: 'meteor', name: 'メティオ', kind: 'weapon', wtype: 'anima', rank: 'A', mt: 14, hit: 70, crit: 0, wt: 15, min: 1, max: 3, magic: true, price: 2700, desc: '隕石を降らす長射程の理。' });
def({ id: 'forblaze', name: '業火書', kind: 'weapon', wtype: 'anima', rank: 'S', mt: 15, hit: 90, crit: 10, wt: 12, min: 1, max: 2, magic: true, price: 12000, desc: '業火を巻き起こす伝説の理書。' });

/* ---- 光：上位・名書 ---- */
def({ id: 'divine', name: 'ディバイン', kind: 'weapon', wtype: 'light', rank: 'B', mt: 11, hit: 85, crit: 10, wt: 9, min: 1, max: 2, magic: true, price: 2000, desc: '神威の光。' });
def({ id: 'aura', name: 'オーラ', kind: 'weapon', wtype: 'light', rank: 'A', mt: 13, hit: 85, crit: 15, wt: 12, min: 1, max: 2, magic: true, price: 2600, desc: '荘厳な光の魔法。' });
def({ id: 'aureola_jp', name: '聖環', kind: 'weapon', wtype: 'light', rank: 'S', mt: 14, hit: 90, crit: 10, wt: 11, min: 1, max: 2, magic: true, eff: ['undead'], price: 12000, desc: '聖なる環の光。屍者に特効。' });

/* ---- 闇：上位・名書 ---- */
def({ id: 'luna_jp', name: 'ルナ', kind: 'weapon', wtype: 'dark', rank: 'C', mt: 0, hit: 95, crit: 0, wt: 8, min: 1, max: 2, magic: true, price: 2200, desc: '魔防を無視して刺す闇（ここでは低威力高命中）。' });
def({ id: 'eclipse', name: 'エクリプス', kind: 'weapon', wtype: 'dark', rank: 'A', mt: 12, hit: 65, crit: 0, wt: 14, min: 1, max: 3, magic: true, price: 2800, desc: '皆既の闇を遠く放つ。' });
def({ id: 'apocalypse_jp', name: '滅びの書', kind: 'weapon', wtype: 'dark', rank: 'S', mt: 16, hit: 85, crit: 10, wt: 13, min: 1, max: 2, magic: true, drain: true, price: 12000, desc: '万象を蝕む禁書。傷を吸う。' });
def({ id: 'fenrir', name: 'フェンリル', kind: 'weapon', wtype: 'dark', rank: 'A', mt: 15, hit: 70, crit: 0, wt: 15, min: 1, max: 3, magic: true, price: 2700, desc: '狼を象る遠き闇。' });

/* ---- 杖：癒し・補助・状態 ---- */
def({ id: 'fortify', name: 'リザイア', kind: 'weapon', wtype: 'staff', rank: 'A', mt: 0, hit: 100, crit: 0, wt: 8, min: 1, max: 3, staff: 'healAll', power: 20, price: 8000, desc: '周囲の味方をまとめて癒す。' });
def({ id: 'warp_staff', name: 'ワープ', kind: 'weapon', wtype: 'staff', rank: 'B', mt: 0, hit: 100, crit: 0, wt: 5, min: 1, max: 8, staff: 'warp', price: 5000, desc: '味方を遠くへ転送する。' });
def({ id: 'rescue_staff', name: 'リターン', kind: 'weapon', wtype: 'staff', rank: 'C', mt: 0, hit: 100, crit: 0, wt: 6, min: 1, max: 8, staff: 'rescue', price: 4000, desc: '遠くの味方を手元へ引き寄せる。' });
def({ id: 'barrier_staff', name: 'バリア', kind: 'weapon', wtype: 'staff', rank: 'C', mt: 0, hit: 100, crit: 0, wt: 4, min: 1, max: 5, staff: 'barrier', power: 7, price: 2500, desc: '味方の魔防を一時的に高める。' });
def({ id: 'sleep_staff', name: 'スリープ', kind: 'weapon', wtype: 'staff', rank: 'B', mt: 0, hit: 75, crit: 0, wt: 7, min: 1, max: 10, staff: 'status', debuff: { sleep: 5 }, price: 3500, desc: '敵を眠りに誘う杖。' });
def({ id: 'silence_staff', name: 'サイレス', kind: 'weapon', wtype: 'staff', rank: 'B', mt: 0, hit: 75, crit: 0, wt: 7, min: 1, max: 10, staff: 'status', debuff: { silence: 5 }, price: 3500, desc: '敵の魔を封じる杖。' });
def({ id: 'berserk_staff', name: 'バーサク', kind: 'weapon', wtype: 'staff', rank: 'A', mt: 0, hit: 70, crit: 0, wt: 8, min: 1, max: 10, staff: 'status', debuff: { berserk: 3 }, price: 4500, desc: '敵を狂乱させ、敵味方の別を失わせる。' });
def({ id: 'hammerne', name: 'ハンマーン', kind: 'weapon', wtype: 'staff', rank: 'A', mt: 0, hit: 100, crit: 0, wt: 6, min: 1, max: 1, staff: 'repair', price: 10000, desc: '武器の使用回数を蘇らせる。' });

/* ---- 短剣 ---- */
def({ id: 'steel_dagger', name: '鋼の短剣', kind: 'weapon', wtype: 'dagger', rank: 'D', mt: 6, hit: 90, crit: 5, wt: 5, min: 1, max: 2, price: 700, debuff: { def: -4, res: -4 }, desc: '重く、相手の守りをより削る。' });
def({ id: 'killing_dagger', name: '殺しの短剣', kind: 'weapon', wtype: 'dagger', rank: 'C', mt: 6, hit: 90, crit: 30, wt: 4, min: 1, max: 2, price: 1300, debuff: { def: -3, res: -3 }, desc: '会心を呼ぶ暗器。' });
def({ id: 'poison_dagger', name: '毒の短剣', kind: 'weapon', wtype: 'dagger', rank: 'D', mt: 3, hit: 95, crit: 0, wt: 3, min: 1, max: 2, price: 800, debuff: { poison: 3 }, desc: '当てると毒を刻む。' });
def({ id: 'silver_dagger', name: '銀の短剣', kind: 'weapon', wtype: 'dagger', rank: 'A', mt: 9, hit: 95, crit: 10, wt: 5, min: 1, max: 2, price: 1800, debuff: { def: -5, res: -5 }, desc: '最高級の暗器。守りを大きく削る。' });

/* ---- 拳 ---- */
def({ id: 'iron_knuckle', name: '鉄の拳', kind: 'weapon', wtype: 'fist', rank: 'E', mt: 4, hit: 90, crit: 5, wt: 2, min: 1, max: 1, price: 500, desc: '基本の拳。素早い打。' });
def({ id: 'killer_knuckle', name: '殺しの拳', kind: 'weapon', wtype: 'fist', rank: 'C', mt: 7, hit: 85, crit: 30, wt: 5, min: 1, max: 1, price: 1300, desc: '急所を突く連打。' });
def({ id: 'silver_knuckle', name: '銀の拳', kind: 'weapon', wtype: 'fist', rank: 'A', mt: 11, hit: 85, crit: 10, wt: 6, min: 1, max: 1, price: 1500, desc: '最高級の拳。' });
def({ id: 'dragon_fist', name: '龍掌', kind: 'weapon', wtype: 'fist', rank: 'S', mt: 13, hit: 90, crit: 20, wt: 5, min: 1, max: 1, price: 11000, desc: '龍の気を宿す伝説の拳。' });

/* ---- 消耗品 ---- */
def({ id: 'mega_concoction', name: '特薬', kind: 'consumable', use: 'heal', power: 30, uses: 3, price: 1000, desc: 'HP を 30 回復（3 回）。' });
def({ id: 'angel_robe_potion', name: '命の雫', kind: 'consumable', use: 'healFull', uses: 1, price: 1500, desc: 'HP を全快（1 回）。' });
def({ id: 'antidote_plus', name: '万能薬', kind: 'consumable', use: 'cure', uses: 5, price: 800, desc: '状態異常を解く（5 回）。' });
def({ id: 'def_tonic', name: '守りの薬', kind: 'consumable', use: 'buffDef', power: 7, uses: 3, price: 900, desc: '守を一時的に +7（3 ターン）。' });
def({ id: 'spd_tonic', name: '俊足の薬', kind: 'consumable', use: 'buffSpd', power: 5, uses: 3, price: 900, desc: '速さを一時的に +5（3 ターン）。' });
def({ id: 'str_tonic', name: '力の薬', kind: 'consumable', use: 'buffStr', power: 5, uses: 3, price: 900, desc: '力を一時的に +5（3 ターン）。' });
def({ id: 'chest_key', name: '宝箱の鍵', kind: 'consumable', use: 'openChest', uses: 1, price: 300, desc: '宝箱を一つ開ける。' });
def({ id: 'door_key', name: '扉の鍵', kind: 'consumable', use: 'openDoor', uses: 1, price: 200, desc: '扉を一つ開ける。' });
def({ id: 'lockpick', name: '鍵開け', kind: 'consumable', use: 'pick', uses: 15, price: 1200, desc: '扉や宝箱を開ける（15 回）。' });

/* ---- 能力上昇アイテム（恒久） ---- */
def({ id: 'energy_ring_drop', name: '大力の雫', kind: 'booster', stat: 'str', amount: 3, price: 8000, desc: '力 +3（永続）。' });
def({ id: 'spirit_dust_plus', name: '大魔力の雫', kind: 'booster', stat: 'mag', amount: 3, price: 8000, desc: '魔 +3（永続）。' });
def({ id: 'boots', name: '韋駄天の靴', kind: 'booster', stat: 'mov', amount: 1, price: 10000, desc: '移動 +1（永続）。' });
def({ id: 'arms_scroll', name: '武の巻物', kind: 'booster', stat: 'wlv', amount: 1, price: 6000, desc: '武器ランクを一段上げる（永続）。' });
def({ id: 'def_drop', name: '守りの雫', kind: 'booster', stat: 'def', amount: 3, price: 8000, desc: '守 +3（永続）。' });
def({ id: 'res_drop', name: '魔防の雫', kind: 'booster', stat: 'res', amount: 3, price: 8000, desc: '魔防 +3（永続）。' });
def({ id: 'seraph_robe', name: '大天使の衣', kind: 'booster', stat: 'hp', amount: 10, price: 12000, desc: '最大 HP +10（永続）。' });

/* ---- 装飾（装備中つねに効果） ---- */
def({ id: 'def_ring', name: '守りの指輪', kind: 'accessory', bonus: { def: 3 }, price: 4000, desc: '守 +3。' });
def({ id: 'skill_ring', name: '技の指輪', kind: 'accessory', bonus: { skl: 3 }, price: 4000, desc: '技 +3。' });
def({ id: 'luck_ring', name: '幸運の指輪', kind: 'accessory', bonus: { lck: 5 }, price: 4000, desc: '運 +5。' });
def({ id: 'mage_ring', name: '魔の指輪', kind: 'accessory', bonus: { mag: 3 }, price: 4500, desc: '魔 +3。' });
def({ id: 'knight_crest_acc', name: '騎士の護符', kind: 'accessory', bonus: { def: 2, res: 2 }, price: 5000, desc: '守 +2、魔防 +2。' });
def({ id: 'silver_rune', name: '銀の護符', kind: 'accessory', bonus: { def: 3, res: 3 }, price: 6000, desc: '守 +3、魔防 +3。' });
def({ id: 'hero_crest_acc', name: '勇者の徽章', kind: 'accessory', bonus: { str: 2, spd: 2 }, price: 6000, desc: '力 +2、速さ +2。' });
def({ id: 'sage_pendant', name: '賢者の首飾り', kind: 'accessory', bonus: { mag: 2, res: 3 }, price: 6000, desc: '魔 +2、魔防 +3。' });
def({ id: 'eagle_eye', name: '鷹の目', kind: 'accessory', bonus: { hit: 15, crit: 5 }, price: 5500, desc: '命中 +15、必殺 +5。' });
def({ id: 'iote_shield', name: 'イオテの盾', kind: 'accessory', bonus: { def: 1 }, eff: ['fly'], price: 6000, desc: '弓の飛行特効を無効にする護りの盾。' });

/* 追加した品の数 */
export const EXTRA_ITEM_COUNT = 76;
export default true;
