/* ============================================================
   陣 — 状態を与える得物（鈍足・盲目）と、さらなる品。
   砂や霧をまとう武器は目を眩ませ、重き縛鎖は足を鈍らせる。
   既存の inflict 機構（命中時に状態を付与）をそのまま使う。店に並ぶ。
   ============================================================ */

import { ITEMS } from './items.js';

function def(o) { ITEMS[o.id] = o; return o; }

/* ---- 鈍足を与える ---- */
def({ id: 'shackle_lance', name: '縛鎖の槍', kind: 'weapon', wtype: 'lance', rank: 'C', mt: 7, hit: 80, crit: 0, wt: 11, min: 1, max: 1, inflict: { id: 'slow', chance: 50, turns: 3 }, price: 1700, desc: '突いた相手の足を鎖が縛る。攻速を奪う。' });
def({ id: 'tar_hammer', name: '粘土の槌', kind: 'weapon', wtype: 'axe', rank: 'D', mt: 9, hit: 70, crit: 0, wt: 13, min: 1, max: 1, inflict: { id: 'slow', chance: 45, turns: 3 }, price: 1500, desc: '重き一撃が、相手の動きを澱ませる。' });

/* ---- 盲目を与える ---- */
def({ id: 'sand_dagger', name: '砂の短剣', kind: 'weapon', wtype: 'dagger', rank: 'C', mt: 4, hit: 95, crit: 5, wt: 2, min: 1, max: 2, inflict: { id: 'blind', chance: 55, turns: 2 }, price: 1600, desc: '砂を撒き、相手の目を眩ます。' });
def({ id: 'flash_tome', name: '閃光の書', kind: 'weapon', wtype: 'light', rank: 'B', mt: 8, hit: 85, crit: 0, wt: 8, min: 1, max: 2, magic: true, inflict: { id: 'blind', chance: 50, turns: 2 }, price: 2100, desc: '眩い光が、敵の視を奪う光魔。' });

/* ---- そのほかの名品 ---- */
def({ id: 'short_spear', name: 'ショートスピア', kind: 'weapon', wtype: 'lance', rank: 'D', mt: 7, hit: 80, crit: 0, wt: 9, min: 1, max: 2, price: 900, desc: '軽く投げられる槍。間合いを選ばぬ。' });
def({ id: 'great_bow', name: 'グレートボウ', kind: 'weapon', wtype: 'bow', rank: 'A', mt: 12, hit: 70, crit: 0, wt: 13, min: 2, max: 3, eff: ['fly'], price: 2400, desc: '遠く重き矢。飛行を射落とす。' });
def({ id: 'guard_ring', name: '守りの指輪', kind: 'accessory', stat: 'def', amount: 2, price: 5000, desc: '着ける者の守りを 2 高める。' });
def({ id: 'speed_ring', name: '速さの指輪', kind: 'accessory', stat: 'spd', amount: 2, price: 5000, desc: '着ける者の速さを 2 高める。' });
