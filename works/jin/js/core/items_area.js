/* ============================================================
   陣 — マップ攻撃（範囲）の得物。遠く着弾点を指し、その周りを巻き込む。
   反撃は起きない（遠距離の一方的な砲撃）。combat の resolveArea が効かせる。
   aoe: 着弾点からの巻き込み半径（マンハッタン）。min/max: 撃てる間合い。
   ============================================================ */

import { ITEMS } from './items.js';
function def(o) { ITEMS[o.id] = o; return o; }

def({ id: 'meteor', name: 'メテオ', kind: 'weapon', wtype: 'anima', rank: 'A', mt: 9, hit: 70, crit: 0, wt: 16, min: 3, max: 10, magic: true, aoe: 1, price: 6000, desc: '遥か遠くへ星を落とす。着弾点と周囲を焼く範囲魔法。' });
def({ id: 'blizzard', name: 'ブリザード', kind: 'weapon', wtype: 'anima', rank: 'A', mt: 8, hit: 75, crit: 0, wt: 15, min: 3, max: 9, magic: true, aoe: 1, price: 5600, inflict: { id: 'freeze', chance: 25, turns: 1 }, desc: '吹雪が一帯を凍てつかせる。まれに凍結。' });
def({ id: 'maelstrom', name: '災いの渦', kind: 'weapon', wtype: 'dark', rank: 'A', mt: 10, hit: 70, crit: 0, wt: 17, min: 2, max: 8, magic: true, aoe: 1, price: 6400, desc: '闇の渦が、巻き込んだ者を等しく蝕む。' });
def({ id: 'aura_rain', name: '光の雨', kind: 'weapon', wtype: 'light', rank: 'A', mt: 9, hit: 80, crit: 5, wt: 14, min: 2, max: 8, magic: true, aoe: 1, eff: ['undead'], price: 6200, desc: '降り注ぐ光。屍者の群れを一掃する範囲の浄化。' });
def({ id: 'cataclysm', name: 'カタストロフ', kind: 'weapon', wtype: 'dark', rank: 'S', mt: 12, hit: 70, crit: 0, wt: 20, min: 3, max: 9, magic: true, aoe: 2, price: 12000, desc: '世界を割る終焉の理。広い範囲をまとめて飲み込む。' });

/* ---- 特殊な形の範囲 ---- */
def({ id: 'crossfire', name: '十字砲火', kind: 'weapon', wtype: 'anima', rank: 'A', mt: 9, hit: 75, crit: 0, wt: 15, min: 2, max: 8, magic: true, aoe: 2, shape: 'cross', price: 6200, desc: '着弾点から縦横へ走る十字の炎。一列をまとめて薙ぐ。' });
def({ id: 'ringblast', name: '環の衝撃', kind: 'weapon', wtype: 'anima', rank: 'A', mt: 8, hit: 78, crit: 0, wt: 15, min: 2, max: 7, magic: true, aoe: 2, shape: 'ring', price: 6000, desc: '着弾点の周りに輪を描いて爆ぜる。囲みを一掃する。' });
def({ id: 'starfall', name: '星屑', kind: 'weapon', wtype: 'light', rank: 'A', mt: 8, hit: 80, crit: 5, wt: 14, min: 2, max: 8, magic: true, aoe: 2, shape: 'x', eff: ['undead'], price: 6400, desc: '斜めへ降り注ぐ光の十字。' });
def({ id: 'quake', name: '大地の怒り', kind: 'weapon', wtype: 'dark', rank: 'S', mt: 11, hit: 75, crit: 0, wt: 18, min: 1, max: 6, magic: true, aoe: 2, shape: 'square', price: 11000, desc: '一帯（角まで）を揺るがす大震。最も広い破壊。' });

export const AREA_WEAPONS = ['meteor', 'blizzard', 'maelstrom', 'aura_rain', 'cataclysm', 'crossfire', 'ringblast', 'starfall', 'quake'];
export default true;
