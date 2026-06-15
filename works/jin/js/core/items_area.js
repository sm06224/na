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

export const AREA_WEAPONS = ['meteor', 'blizzard', 'maelstrom', 'aura_rain', 'cataclysm'];
export default true;
