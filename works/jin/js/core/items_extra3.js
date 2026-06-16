/* ============================================================
   陣 — 連射（ブレイブ）の得物と、さらなる名品。
   ブレイブ（勇者）武器は一手で二撃——速さによらず続けて打つ（brave: true）。
   ほかに会心の刃・特効槍・吸収の魔・状態異常の短剣・能力の雫を加える。
   すべて値があり、店に並ぶ。既存の登録に重ねるだけ。
   ============================================================ */

import { ITEMS } from './items.js';

function def(o) { ITEMS[o.id] = o; return o; }

/* ---- 連射（ブレイブ）武器：一手で二撃 ---- */
def({ id: 'brave_sword', name: '勇者の剣', kind: 'weapon', wtype: 'sword', rank: 'A', mt: 9, hit: 80, crit: 0, wt: 12, min: 1, max: 1, brave: true, price: 3200, desc: '一手で二度斬る、英雄の剣。' });
def({ id: 'brave_lance', name: '勇者の槍', kind: 'weapon', wtype: 'lance', rank: 'A', mt: 10, hit: 75, crit: 0, wt: 13, min: 1, max: 1, brave: true, price: 3200, desc: '一手で二度突く、英雄の槍。' });
def({ id: 'brave_axe',  name: '勇者の斧', kind: 'weapon', wtype: 'axe',  rank: 'A', mt: 11, hit: 70, crit: 0, wt: 14, min: 1, max: 1, brave: true, price: 3200, desc: '一手で二度振る、英雄の斧。' });
def({ id: 'brave_bow',  name: '勇者の弓', kind: 'weapon', wtype: 'bow',  rank: 'A', mt: 9,  hit: 80, crit: 0, wt: 11, min: 2, max: 2, brave: true, eff: ['fly'], price: 3300, desc: '一手で二度射る、英雄の弓。飛行に特効。' });

/* ---- 会心・特効の名品 ---- */
def({ id: 'rune_sword', name: '魔剣ルーン', kind: 'weapon', wtype: 'sword', rank: 'A', mt: 11, hit: 80, crit: 10, wt: 9, min: 1, max: 2, magic: true, drain: true, price: 3000, desc: '遠近を断ち、傷を糧とする魔の剣。' });
def({ id: 'spear', name: 'スピア', kind: 'weapon', wtype: 'lance', rank: 'A', mt: 12, hit: 75, crit: 5, wt: 10, min: 1, max: 2, price: 2600, desc: '投げても突いても届く、騎兵の誉れ。' });
def({ id: 'tomahawk', name: 'トマホーク', kind: 'weapon', wtype: 'axe', rank: 'A', mt: 13, hit: 65, crit: 0, wt: 14, min: 1, max: 2, price: 2600, desc: '遠近を撃つ大斧。' });
def({ id: 'wyrmslayer', name: '竜殺し', kind: 'weapon', wtype: 'sword', rank: 'C', mt: 8, hit: 85, crit: 10, wt: 7, min: 1, max: 1, eff: ['dragon'], price: 2400, desc: '竜に特効の細身の刃。' });
def({ id: 'longbow', name: 'ロングボウ', kind: 'weapon', wtype: 'bow', rank: 'B', mt: 6, hit: 80, crit: 0, wt: 9, min: 2, max: 3, eff: ['fly'], price: 1800, desc: '間合いの長い弓。飛行に特効。' });

/* ---- 状態異常の短剣・闇の魔 ---- */
def({ id: 'venom_dagger', name: '毒の短剣', kind: 'weapon', wtype: 'dagger', rank: 'C', mt: 5, hit: 90, crit: 5, wt: 3, min: 1, max: 2, inflict: { id: 'poison', chance: 60, turns: 4 }, price: 1600, desc: '掠めれば毒がまわる。' });
def({ id: 'hexblade', name: '呪刃', kind: 'weapon', wtype: 'dagger', rank: 'B', mt: 6, hit: 85, crit: 0, wt: 4, min: 1, max: 2, debuff: { def: -3, res: -3 }, price: 2000, desc: '斬られた者は守りを削がれる。' });
def({ id: 'eclipse', name: 'エクリプス', kind: 'weapon', wtype: 'dark', rank: 'A', mt: 14, hit: 70, crit: 0, wt: 14, min: 1, max: 2, magic: true, price: 3400, desc: '相手の生命を大きく奪う禁呪。' });

/* ---- 能力の雫・消耗品 ---- */
def({ id: 'spirit_dust', name: '魔力の雫', kind: 'booster', stat: 'mag', amount: 2, price: 8000, desc: '魔力が永続して 2 上がる。' });
def({ id: 'secret_book', name: '極意の書', kind: 'booster', stat: 'skl', amount: 2, price: 8000, desc: '技が永続して 2 上がる。' });
def({ id: 'talisman', name: 'タリスマン', kind: 'booster', stat: 'res', amount: 2, price: 8000, desc: '魔防が永続して 2 上がる。' });
def({ id: 'boots', name: 'ブーツ', kind: 'booster', stat: 'mov', amount: 1, price: 10000, desc: '移動が永続して 1 上がる。' });
def({ id: 'antitoxin', name: '解毒薬', kind: 'consumable', use: 'cure', uses: 1, price: 300, desc: '毒や状態異常を癒す。' });
def({ id: 'pure_water', name: '聖水', kind: 'consumable', use: 'res_up', uses: 3, price: 900, desc: '数ターン、魔防を上げる。' });
