/* ============================================================
   陣 — 武器・道具・装飾。
   武器には三すくみ（剣>斧>槍>剣）と、魔法の三色（理>光>闇>理）。
   弓は飛行に強く、特効は刺さる。重い武器は速さを削ぐ。
   品は会得した武器ランク（E〜S）で持てる。すべて値があり、店に並ぶ。
   ============================================================ */

export const WTYPE = {
  sword: '剣', lance: '槍', axe: '斧', bow: '弓',
  anima: '理', light: '光', dark: '闇', staff: '杖',
  fist: '拳', dagger: '短剣',
};
export const WRANKS = ['E', 'D', 'C', 'B', 'A', 'S'];
export const rankValue = r => WRANKS.indexOf(r);
/* 武器熟練度（WEXP）の閾値：E D C B A S。使うほど貯まり、段が上がる。 */
export const WEXP_THRESHOLDS = [0, 21, 50, 90, 140, 201];
export function rankFromWexp(n) {
  let r = 0;
  for (let i = 0; i < WEXP_THRESHOLDS.length; i++) if ((n | 0) >= WEXP_THRESHOLDS[i]) r = i;
  return WRANKS[r];
}
export const wexpForRank = letter => WEXP_THRESHOLDS[Math.max(0, rankValue(letter))] || 0;

/* 三すくみ：攻撃側が有利なら +1 威力 / +15 命中、不利なら逆 */
const PHYS_BEAT = { sword: 'axe', axe: 'lance', lance: 'sword' };
const MAG_BEAT = { anima: 'light', light: 'dark', dark: 'anima' };
export function triangle(aType, dType) {
  if (PHYS_BEAT[aType] === dType || MAG_BEAT[aType] === dType) return { atk: 1, hit: 15 };
  if (PHYS_BEAT[dType] === aType || MAG_BEAT[dType] === aType) return { atk: -1, hit: -15 };
  return { atk: 0, hit: 0 };
}
export const isMagicType = t => t === 'anima' || t === 'light' || t === 'dark';

export const ITEMS = {};
function def(o) { ITEMS[o.id] = o; return o; }

/* ---- 剣 ---- */
def({ id: 'iron_sword', name: '鉄の剣', kind: 'weapon', wtype: 'sword', rank: 'E', mt: 5, hit: 90, crit: 0, wt: 5, min: 1, max: 1, price: 460, desc: '基本の剣。軽く扱いやすい。' });
def({ id: 'steel_sword', name: '鋼の剣', kind: 'weapon', wtype: 'sword', rank: 'D', mt: 8, hit: 85, crit: 0, wt: 9, min: 1, max: 1, price: 600, desc: '重いが威力がある。' });
def({ id: 'slim_sword', name: '細身の剣', kind: 'weapon', wtype: 'sword', rank: 'E', mt: 3, hit: 100, crit: 5, wt: 2, min: 1, max: 1, price: 480, desc: '軽く、よく当たり、急所を突く。' });
def({ id: 'killing_edge', name: 'キルソード', kind: 'weapon', wtype: 'sword', rank: 'C', mt: 9, hit: 85, crit: 30, wt: 7, min: 1, max: 1, price: 1300, desc: '会心を呼ぶ刃。' });
def({ id: 'armorslayer', name: 'アーマーキラー', kind: 'weapon', wtype: 'sword', rank: 'D', mt: 8, hit: 80, crit: 0, wt: 11, min: 1, max: 1, price: 1260, eff: ['armor'], desc: '重装に特効。' });
def({ id: 'wo_dao', name: '倭刀', kind: 'weapon', wtype: 'sword', rank: 'C', mt: 8, hit: 85, crit: 35, wt: 8, min: 1, max: 1, price: 1500, desc: '異国の刀。会心に長ける。' });
def({ id: 'levin_sword', name: '雷の剣', kind: 'weapon', wtype: 'sword', rank: 'B', mt: 9, hit: 75, crit: 5, wt: 11, min: 1, max: 2, magic: true, price: 2000, desc: '遠近を断つ、魔を帯びた剣（守でなく魔防を抜く）。' });
def({ id: 'silver_sword', name: '銀の剣', kind: 'weapon', wtype: 'sword', rank: 'A', mt: 13, hit: 80, crit: 0, wt: 10, min: 1, max: 1, price: 1800, desc: '最高級の剣。' });

/* ---- 槍 ---- */
def({ id: 'iron_lance', name: '鉄の槍', kind: 'weapon', wtype: 'lance', rank: 'E', mt: 7, hit: 80, crit: 0, wt: 8, min: 1, max: 1, price: 360, desc: '基本の槍。' });
def({ id: 'steel_lance', name: '鋼の槍', kind: 'weapon', wtype: 'lance', rank: 'D', mt: 10, hit: 70, crit: 0, wt: 13, min: 1, max: 1, price: 480, desc: '重く力強い。' });
def({ id: 'javelin', name: '手槍', kind: 'weapon', wtype: 'lance', rank: 'E', mt: 6, hit: 65, crit: 0, wt: 11, min: 1, max: 2, price: 400, desc: '投げて遠間を打つ。' });
def({ id: 'horseslayer', name: 'ホースキラー', kind: 'weapon', wtype: 'lance', rank: 'D', mt: 7, hit: 70, crit: 0, wt: 12, min: 1, max: 1, price: 1040, eff: ['ride'], desc: '騎馬に特効。' });
def({ id: 'spear', name: 'スピア', kind: 'weapon', wtype: 'lance', rank: 'B', mt: 12, hit: 70, crit: 5, wt: 12, min: 1, max: 2, price: 2000, desc: '遠近両用の名槍。' });
def({ id: 'silver_lance', name: '銀の槍', kind: 'weapon', wtype: 'lance', rank: 'A', mt: 14, hit: 75, crit: 0, wt: 12, min: 1, max: 1, price: 1600, desc: '最高級の槍。' });

/* ---- 斧 ---- */
def({ id: 'iron_axe', name: '鉄の斧', kind: 'weapon', wtype: 'axe', rank: 'E', mt: 8, hit: 75, crit: 0, wt: 10, min: 1, max: 1, price: 270, desc: '基本の斧。重く当てにくいが痛い。' });
def({ id: 'steel_axe', name: '鋼の斧', kind: 'weapon', wtype: 'axe', rank: 'D', mt: 11, hit: 65, crit: 0, wt: 15, min: 1, max: 1, price: 360, desc: 'さらに重い斧。' });
def({ id: 'hand_axe', name: '手斧', kind: 'weapon', wtype: 'axe', rank: 'E', mt: 7, hit: 60, crit: 0, wt: 12, min: 1, max: 2, price: 300, desc: '投げて遠間を打つ斧。' });
def({ id: 'hammer', name: 'ハンマー', kind: 'weapon', wtype: 'axe', rank: 'D', mt: 10, hit: 65, crit: 0, wt: 16, min: 1, max: 1, price: 660, eff: ['armor'], desc: '重装を打ち砕く。' });
def({ id: 'devil_axe', name: '魔斧', kind: 'weapon', wtype: 'axe', rank: 'D', mt: 18, hit: 55, crit: 0, wt: 18, min: 1, max: 1, price: 900, backfire: 0.15, desc: '凄まじい威力。だが時に己を傷つける。' });
def({ id: 'silver_axe', name: '銀の斧', kind: 'weapon', wtype: 'axe', rank: 'A', mt: 15, hit: 70, crit: 0, wt: 14, min: 1, max: 1, price: 1400, desc: '最高級の斧。' });

/* ---- 弓 ---- */
def({ id: 'iron_bow', name: '鉄の弓', kind: 'weapon', wtype: 'bow', rank: 'E', mt: 6, hit: 85, crit: 0, wt: 5, min: 2, max: 2, price: 540, eff: ['fly'], desc: '飛行に特効。間合いは二。' });
def({ id: 'steel_bow', name: '鋼の弓', kind: 'weapon', wtype: 'bow', rank: 'D', mt: 9, hit: 80, crit: 0, wt: 9, min: 2, max: 2, price: 720, eff: ['fly'], desc: '重く強い弓。' });
def({ id: 'longbow', name: '剛弓', kind: 'weapon', wtype: 'bow', rank: 'C', mt: 5, hit: 65, crit: 0, wt: 10, min: 2, max: 3, price: 2000, eff: ['fly'], desc: '遠く三間まで届く。' });
def({ id: 'killer_bow', name: 'キラーボウ', kind: 'weapon', wtype: 'bow', rank: 'C', mt: 9, hit: 75, crit: 30, wt: 7, min: 2, max: 2, price: 1400, eff: ['fly'], desc: '会心を呼ぶ弓。' });
def({ id: 'silver_bow', name: '銀の弓', kind: 'weapon', wtype: 'bow', rank: 'A', mt: 13, hit: 75, crit: 0, wt: 9, min: 2, max: 2, price: 1700, eff: ['fly'], desc: '最高級の弓。' });

/* ---- 理（アニマ） ---- */
def({ id: 'fire', name: 'ファイアー', kind: 'weapon', wtype: 'anima', rank: 'E', mt: 5, hit: 90, crit: 0, wt: 4, min: 1, max: 2, magic: true, price: 560, desc: '炎の魔道書。魔防を抜く。' });
def({ id: 'thunder', name: 'サンダー', kind: 'weapon', wtype: 'anima', rank: 'D', mt: 8, hit: 80, crit: 5, wt: 6, min: 1, max: 2, magic: true, price: 950, desc: '雷の魔道書。' });
def({ id: 'elfire', name: 'エルファイアー', kind: 'weapon', wtype: 'anima', rank: 'C', mt: 10, hit: 85, crit: 0, wt: 8, min: 1, max: 2, magic: true, price: 1200, desc: '強き炎。' });
def({ id: 'bolting', name: 'ボルガノン', kind: 'weapon', wtype: 'anima', rank: 'A', mt: 12, hit: 75, crit: 0, wt: 14, min: 1, max: 3, magic: true, price: 2500, desc: '遠雷を落とす長射程の理。' });

/* ---- 光 ---- */
def({ id: 'lightning', name: 'ライトニング', kind: 'weapon', wtype: 'light', rank: 'E', mt: 4, hit: 95, crit: 5, wt: 4, min: 1, max: 2, magic: true, price: 600, desc: '光の魔法。良く当たる。' });
def({ id: 'shine', name: 'シャイン', kind: 'weapon', wtype: 'light', rank: 'D', mt: 7, hit: 90, crit: 8, wt: 5, min: 1, max: 2, magic: true, price: 1100, desc: '清き光。' });
def({ id: 'purge', name: 'パージ', kind: 'weapon', wtype: 'light', rank: 'A', mt: 10, hit: 80, crit: 10, wt: 13, min: 1, max: 3, magic: true, price: 2400, eff: ['undead'], desc: '遠き浄化の光。屍者に特効。' });

/* ---- 闇 ---- */
def({ id: 'flux', name: 'フラックス', kind: 'weapon', wtype: 'dark', rank: 'D', mt: 7, hit: 80, crit: 0, wt: 7, min: 1, max: 2, magic: true, price: 990, desc: '渦巻く闇。' });
def({ id: 'nosferatu', name: 'ノスフェラトゥ', kind: 'weapon', wtype: 'dark', rank: 'C', mt: 8, hit: 70, crit: 0, wt: 10, min: 1, max: 2, magic: true, drain: true, price: 2300, desc: '与えた傷ぶん、己を癒す闇。' });

/* ---- 杖 ---- */
def({ id: 'heal', name: 'ライブ', kind: 'weapon', wtype: 'staff', rank: 'E', mt: 0, hit: 100, crit: 0, wt: 2, min: 1, max: 1, staff: 'heal', power: 10, price: 600, desc: '傷を癒す杖。' });
def({ id: 'mend', name: 'リライブ', kind: 'weapon', wtype: 'staff', rank: 'D', mt: 0, hit: 100, crit: 0, wt: 3, min: 1, max: 1, staff: 'heal', power: 20, price: 1000, desc: 'よく癒す杖。' });
def({ id: 'recover', name: 'リカバー', kind: 'weapon', wtype: 'staff', rank: 'C', mt: 0, hit: 100, crit: 0, wt: 8, min: 1, max: 1, staff: 'heal', power: 99, price: 2250, desc: '傷をすべて癒す。' });
def({ id: 'physic', name: 'リブロー', kind: 'weapon', wtype: 'staff', rank: 'C', mt: 0, hit: 100, crit: 0, wt: 4, min: 1, max: 8, staff: 'heal', power: 15, price: 2000, desc: '遠くの傷を癒す。' });
def({ id: 'restore', name: 'リワープ', kind: 'weapon', wtype: 'staff', rank: 'C', mt: 0, hit: 100, crit: 0, wt: 4, min: 1, max: 5, staff: 'restore', price: 3000, desc: '状態異常を解く。' });

/* ---- 短剣・拳 ---- */
def({ id: 'iron_dagger', name: '鉄の短剣', kind: 'weapon', wtype: 'dagger', rank: 'E', mt: 4, hit: 95, crit: 5, wt: 3, min: 1, max: 2, price: 500, debuff: { def: -3, res: -3 }, desc: '当てると相手の守りを削る。' });
def({ id: 'steel_knuckle', name: '鋼の拳', kind: 'weapon', wtype: 'fist', rank: 'D', mt: 6, hit: 85, crit: 10, wt: 4, min: 1, max: 1, price: 700, desc: '速き連打。' });

/* ---- 消耗品 ---- */
def({ id: 'vulnerary', name: '傷薬', kind: 'consumable', use: 'heal', power: 10, uses: 3, price: 300, desc: 'HP を 10 回復（3 回）。' });
def({ id: 'concoction', name: '上薬', kind: 'consumable', use: 'heal', power: 20, uses: 3, price: 600, desc: 'HP を 20 回復（3 回）。' });
def({ id: 'elixir', name: '秘薬', kind: 'consumable', use: 'healFull', uses: 3, price: 3000, desc: 'HP を全快（3 回）。' });
def({ id: 'antitoxin', name: '毒消し', kind: 'consumable', use: 'cure', uses: 3, price: 450, desc: '状態異常を解く（3 回）。' });
def({ id: 'pure_water', name: '聖水', kind: 'consumable', use: 'buffRes', power: 7, uses: 3, price: 900, desc: '魔防を一時的に +7（3 ターン）。' });
def({ id: 'torch', name: 'たいまつ', kind: 'consumable', use: 'light', uses: 5, price: 500, desc: '視界を照らす。' });

/* ---- 能力上昇アイテム（恒久） ---- */
def({ id: 'energy_drop', name: '力の雫', kind: 'booster', stat: 'str', amount: 2, price: 5000, desc: '力 +2（永続）。' });
def({ id: 'spirit_dust', name: '魔力の雫', kind: 'booster', stat: 'mag', amount: 2, price: 5000, desc: '魔 +2（永続）。' });
def({ id: 'secret_book', name: '秘伝の書', kind: 'booster', stat: 'skl', amount: 2, price: 5000, desc: '技 +2（永続）。' });
def({ id: 'speedwing', name: '速さの翼', kind: 'booster', stat: 'spd', amount: 2, price: 5000, desc: '速さ +2（永続）。' });
def({ id: 'goddess_icon', name: '女神の像', kind: 'booster', stat: 'lck', amount: 2, price: 5000, desc: '運 +2（永続）。' });
def({ id: 'dragonshield', name: '竜の盾', kind: 'booster', stat: 'def', amount: 2, price: 5000, desc: '守 +2（永続）。' });
def({ id: 'talisman', name: '魔除け', kind: 'booster', stat: 'res', amount: 2, price: 5000, desc: '魔防 +2（永続）。' });

/* ---- 装飾（装備中つねに効果） ---- */
def({ id: 'iron_rune', name: '鉄の護符', kind: 'accessory', bonus: { def: 2 }, price: 2500, desc: '守 +2。' });
def({ id: 'angelic_robe', name: '天使の衣', kind: 'booster', stat: 'hp', amount: 7, price: 8000, desc: '最大 HP +7（永続）。' });
def({ id: 'speed_ring', name: '速さの指輪', kind: 'accessory', bonus: { spd: 3 }, price: 4000, desc: '速さ +3。' });
def({ id: 'power_ring', name: '力の指輪', kind: 'accessory', bonus: { str: 3 }, price: 4000, desc: '力 +3。' });
def({ id: 'barrier_ring', name: '魔よけの指輪', kind: 'accessory', bonus: { res: 5 }, price: 5000, desc: '魔防 +5。' });

export const ITEM_LIST = Object.values(ITEMS);
export function item(id) { return ITEMS[id]; }
export function isWeapon(it) { return it && it.kind === 'weapon'; }
export function isStaff(it) { return it && it.wtype === 'staff'; }
