/* ============================================================
   陣 — 第三幕の「星（せい）」の得物。
   星々の力を宿した、終幕の輝かしき武器と、星の恵みの能力品。
   流星のごとき一撃、天弓の遠射、星霜の理（ことわり）——みな終局の名品。
   すべて値があり、店に並ぶ。既存の登録に重ねるだけ。
   ============================================================ */

import { ITEMS } from './items.js';

function def(o) { ITEMS[o.id] = o; return o; }

/* ---- 星の剣 ---- */
def({ id: 'star_breaker_sword', name: '星砕きの剣', kind: 'weapon', wtype: 'sword', rank: 'S', mt: 15, hit: 85, crit: 10, wt: 11, min: 1, max: 1, price: 7200, desc: '振れば星をも砕くという、終幕の大剣。' });
def({ id: 'star_meteor_blade', name: '流星刃', kind: 'weapon', wtype: 'sword', rank: 'A', mt: 12, hit: 90, crit: 20, wt: 8, min: 1, max: 1, price: 4800, desc: '一閃が流星のごとく走る、会心の刃。' });
def({ id: 'star_dragon_sword', name: '星竜剣アステリオン', kind: 'weapon', wtype: 'sword', rank: 'S', mt: 13, hit: 85, crit: 10, wt: 10, min: 1, max: 1, eff: ['dragon'], price: 6800, desc: '星辰を宿す刃。竜に特効。' });

/* ---- 星の槍 ---- */
def({ id: 'star_comet_lance', name: '流星の槍', kind: 'weapon', wtype: 'lance', rank: 'S', mt: 14, hit: 80, crit: 5, wt: 12, min: 1, max: 2, price: 6400, desc: '彗星のごとく遠近を貫く名槍。' });
def({ id: 'star_brave_lance', name: '星輝槍ステラルクス', kind: 'weapon', wtype: 'lance', rank: 'S', mt: 12, hit: 80, crit: 5, wt: 13, min: 1, max: 1, brave: true, price: 7600, desc: '星の輝きを纏い、一手で二度突く。' });
def({ id: 'star_dragon_lance', name: '天竜槍コメート', kind: 'weapon', wtype: 'lance', rank: 'A', mt: 13, hit: 80, crit: 0, wt: 12, min: 1, max: 1, eff: ['dragon'], price: 6000, desc: '天空の竜を穿つ星の槍。' });

/* ---- 星の斧 ---- */
def({ id: 'star_nova_axe', name: '星滅の斧ノヴァ', kind: 'weapon', wtype: 'axe', rank: 'S', mt: 16, hit: 75, crit: 5, wt: 15, min: 1, max: 1, price: 6600, desc: '超新星の爆ぜるごとき一撃を放つ大斧。' });
def({ id: 'star_falling_axe', name: '隕星斧', kind: 'weapon', wtype: 'axe', rank: 'A', mt: 14, hit: 70, crit: 0, wt: 14, min: 1, max: 2, price: 5200, desc: '落ちる星のごとく遠近を打つ。' });

/* ---- 星の弓 ---- */
def({ id: 'star_stella_bow', name: '天弓ステラ', kind: 'weapon', wtype: 'bow', rank: 'S', mt: 14, hit: 85, crit: 10, wt: 9, min: 2, max: 2, eff: ['fly'], price: 6800, desc: '星座を辿る天の弓。飛行に特効。' });
def({ id: 'star_arc_bow', name: '星霜弓アークトス', kind: 'weapon', wtype: 'bow', rank: 'A', mt: 11, hit: 80, crit: 0, wt: 10, min: 2, max: 3, eff: ['fly'], price: 5400, desc: '遠く三間まで届く、星巡りの長弓。' });

/* ---- 理（アニマ）の星 ---- */
def({ id: 'star_seisou_tome', name: '星霜の書', kind: 'weapon', wtype: 'anima', rank: 'S', mt: 15, hit: 80, crit: 5, wt: 14, min: 1, max: 2, magic: true, price: 6200, desc: '星々の運行を綴る理（ことわり）の禁書。' });
def({ id: 'star_galaxy_tome', name: 'ギャラクシー', kind: 'weapon', wtype: 'anima', rank: 'A', mt: 13, hit: 75, crit: 0, wt: 13, min: 1, max: 3, magic: true, price: 5600, desc: '銀河を呼び寄せ、遠き敵を撃つ理。' });

/* ---- 光の星 ---- */
def({ id: 'star_halo_light', name: '光輪の書', kind: 'weapon', wtype: 'light', rank: 'S', mt: 13, hit: 90, crit: 10, wt: 12, min: 1, max: 2, magic: true, price: 6400, desc: '星の光輪をかたどる聖なる魔法。' });
def({ id: 'star_constellation', name: '星座シリウス', kind: 'weapon', wtype: 'light', rank: 'A', mt: 11, hit: 85, crit: 5, wt: 11, min: 1, max: 3, magic: true, eff: ['dragon'], price: 5800, desc: '天狼の光を放つ遠射の光。竜に特効。' });

/* ---- 闇の星 ---- */
def({ id: 'star_voidcall', name: '虚空招来', kind: 'weapon', wtype: 'dark', rank: 'S', mt: 15, hit: 75, crit: 0, wt: 14, min: 1, max: 2, magic: true, drain: true, price: 6600, desc: '星間の虚（うろ）を開き、命を吸い上げる闇。' });
def({ id: 'star_blackhole', name: 'ブラックホール', kind: 'weapon', wtype: 'dark', rank: 'A', mt: 13, hit: 70, crit: 0, wt: 13, min: 1, max: 2, magic: true, price: 5400, desc: '万物を呑む暗黒の渦を生む禁呪。' });

/* ---- 杖の星 ---- */
def({ id: 'star_ring_staff', name: '光輪の杖', kind: 'weapon', wtype: 'staff', rank: 'A', mt: 0, hit: 100, crit: 0, wt: 7, min: 1, max: 10, staff: 'heal', power: 30, price: 4200, desc: '星の光で遠くの傷を大きく癒す杖。' });

/* ---- 拳の星 ---- */
def({ id: 'star_nebula_fist', name: '星雲の拳', kind: 'weapon', wtype: 'fist', rank: 'A', mt: 12, hit: 85, crit: 15, wt: 6, min: 1, max: 1, price: 4600, desc: '星雲の渦を打ち込む、速き連打。' });

/* ---- 短剣の星 ---- */
def({ id: 'star_eclipse_dagger', name: '星蝕の短剣', kind: 'weapon', wtype: 'dagger', rank: 'A', mt: 8, hit: 95, crit: 10, wt: 4, min: 1, max: 2, inflict: { id: 'sleep', chance: 50, turns: 3 }, price: 4400, desc: '星の蝕を写し、斬られた者を眠りに落とす。' });
def({ id: 'star_twinkle_edge', name: '煌めきの刃', kind: 'weapon', wtype: 'dagger', rank: 'A', mt: 9, hit: 95, crit: 25, wt: 4, min: 1, max: 2, price: 4000, desc: '星の煌めきのごとき会心の短剣。' });

/* ---- 星の能力品（恒久ブースター） ---- */
def({ id: 'star_dust', name: '星の砂', kind: 'booster', stat: 'mag', amount: 3, price: 9000, desc: '魔 +3（永続）。星の砂を浴びし者の力。' });
def({ id: 'star_fragment', name: '星のかけら', kind: 'booster', stat: 'str', amount: 3, price: 9000, desc: '力 +3（永続）。落ちた星の欠片。' });
def({ id: 'star_feather', name: '星の羽根', kind: 'booster', stat: 'spd', amount: 3, price: 9000, desc: '速さ +3（永続）。流星の速さを宿す。' });
def({ id: 'star_tear', name: '星の雫', kind: 'booster', stat: 'res', amount: 3, price: 9000, desc: '魔防 +3（永続）。星天の涙。' });

/* ---- 星の装飾（装備中つねに効果） ---- */
def({ id: 'star_power_ring', name: '星辰の指輪', kind: 'accessory', stat: 'str', amount: 3, price: 6000, desc: '着ける者の力を 3 高める。' });
def({ id: 'star_speed_ring', name: '流星の指輪', kind: 'accessory', stat: 'spd', amount: 3, price: 6000, desc: '着ける者の速さを 3 高める。' });
def({ id: 'star_guard_ring', name: '星盾の指輪', kind: 'accessory', stat: 'def', amount: 3, price: 6000, desc: '着ける者の守りを 3 高める。' });
def({ id: 'star_mage_ring', name: '星詠みの指輪', kind: 'accessory', stat: 'mag', amount: 3, price: 6000, desc: '着ける者の魔を 3 高める。' });
