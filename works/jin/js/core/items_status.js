/* ============================================================
   陣 — 状態異常を与える得物。命中時に、眠り・毒・沈黙を相手へ。
   既存の登録簿へ追記（combat の weapon.inflict が効かせる）。
   ============================================================ */

import { ITEMS } from './items.js';
function def(o) { ITEMS[o.id] = o; return o; }

def({ id: 'sleep_tome', name: '眠りの書', kind: 'weapon', wtype: 'anima', rank: 'C', mt: 4, hit: 80, crit: 0, wt: 7, min: 1, max: 2, magic: true, price: 2200, inflict: { id: 'sleep', chance: 60, turns: 2 }, desc: '当てると相手を眠らせる理。威力は低い。' });
def({ id: 'nightmare', name: '悪夢の書', kind: 'weapon', wtype: 'dark', rank: 'B', mt: 7, hit: 75, crit: 0, wt: 9, min: 1, max: 2, magic: true, price: 2600, inflict: { id: 'sleep', chance: 45, turns: 2 }, desc: '闇で意識を沈める。傷も眠りも。' });
def({ id: 'venin_edge', name: '毒の刃', kind: 'weapon', wtype: 'sword', rank: 'D', mt: 5, hit: 90, crit: 0, wt: 6, min: 1, max: 1, price: 1200, inflict: { id: 'poison', chance: 70, turns: 5 }, desc: '塗られた毒が、傷から回る。' });
def({ id: 'venin_lance', name: '毒の槍', kind: 'weapon', wtype: 'lance', rank: 'D', mt: 6, hit: 80, crit: 0, wt: 9, min: 1, max: 2, price: 1300, inflict: { id: 'poison', chance: 70, turns: 5 }, desc: '間合いの外から毒を刺す。' });
def({ id: 'hush_dagger', name: '沈黙の短剣', kind: 'weapon', wtype: 'dagger', rank: 'C', mt: 5, hit: 90, crit: 5, wt: 4, min: 1, max: 2, price: 2000, inflict: { id: 'silence', chance: 55, turns: 3 }, debuff: { res: -3 }, desc: '当てると魔と杖を封じる影の刃。' });
def({ id: 'venin_bow', name: '毒の弓', kind: 'weapon', wtype: 'bow', rank: 'D', mt: 5, hit: 80, crit: 0, wt: 7, min: 2, max: 2, eff: ['fly'], price: 1400, inflict: { id: 'poison', chance: 65, turns: 5 }, desc: '毒矢。飛ぶ者をも蝕む。' });

export const STATUS_WEAPONS = ['sleep_tome', 'nightmare', 'venin_edge', 'venin_lance', 'hush_dagger', 'venin_bow'];
export default true;
