/* ============================================================
   陣 — 「古（いにしえ）の遺物」の得物。
   廃墟や古墳より掘り起こされし、忘れられた時代の武具と道具。
   錆びてなお威を失わぬ刃、滅びし王国の杖、古（ふる）き理（ことわり）の力——みな遺跡の名品。
   星の得物とは別系統の、中〜高位の一群。すべて値があり、店に並ぶ。
   既存の登録に重ねるだけ。
   ============================================================ */

import { ITEMS } from './items.js';

function def(o) { ITEMS[o.id] = o; return o; }

/* ---- 遺物の剣 ---- */
def({ id: 'relic_ruin_sword', name: '遺跡の長剣', kind: 'weapon', wtype: 'sword', rank: 'B', mt: 11, hit: 85, crit: 5, wt: 9, min: 1, max: 1, price: 3000, desc: '古き廃墟より掘り出された、いまだ鋭き長剣。' });
def({ id: 'relic_tomb_blade', name: '墳墓の刃グラディウス', kind: 'weapon', wtype: 'sword', rank: 'A', mt: 13, hit: 85, crit: 10, wt: 10, min: 1, max: 1, price: 4600, desc: '王の墳墓に眠りし、いにしえの名剣。' });
def({ id: 'relic_dragonbane', name: '古竜断ちウルズ', kind: 'weapon', wtype: 'sword', rank: 'A', mt: 12, hit: 80, crit: 5, wt: 11, min: 1, max: 1, eff: ['dragon'], price: 5400, desc: '太古の竜を屠るため鍛えられた刃。竜に特効。' });

/* ---- 遺物の槍 ---- */
def({ id: 'relic_pillar_lance', name: '神殿柱の槍', kind: 'weapon', wtype: 'lance', rank: 'B', mt: 12, hit: 80, crit: 0, wt: 12, min: 1, max: 2, price: 3400, desc: '崩れた神殿の柱より削り出された、遠近を貫く槍。' });
def({ id: 'relic_knight_lance', name: '古騎士槍ランツァ', kind: 'weapon', wtype: 'lance', rank: 'A', mt: 13, hit: 80, crit: 5, wt: 13, min: 1, max: 1, eff: ['armor'], price: 5000, desc: 'いにしえの重騎士が手にした槍。重装に特効。' });

/* ---- 遺物の斧 ---- */
def({ id: 'relic_buried_axe', name: '埋もれた戦斧', kind: 'weapon', wtype: 'axe', rank: 'B', mt: 13, hit: 70, crit: 5, wt: 14, min: 1, max: 1, price: 3200, desc: '土砂の下に長く眠っていた、無骨な戦斧。' });
def({ id: 'relic_gravelord_axe', name: '墓守斧モルド', kind: 'weapon', wtype: 'axe', rank: 'A', mt: 15, hit: 70, crit: 0, wt: 15, min: 1, max: 2, price: 5200, desc: '墓所を守りし巨人の大斧。遠近を打つ。' });

/* ---- 遺物の弓 ---- */
def({ id: 'relic_dust_bow', name: '塵積もる弓', kind: 'weapon', wtype: 'bow', rank: 'B', mt: 10, hit: 80, crit: 5, wt: 9, min: 2, max: 2, price: 3000, desc: '埃の積もった遺物庫に眠っていた、なお弾む弓。' });
def({ id: 'relic_skyhunter_bow', name: '天狩りの古弓', kind: 'weapon', wtype: 'bow', rank: 'A', mt: 12, hit: 80, crit: 5, wt: 10, min: 2, max: 3, eff: ['fly'], price: 5400, desc: '古の狩人が天翔ける獣を射た長弓。飛行に特効。' });

/* ---- 理（アニマ）の遺物 ---- */
def({ id: 'relic_quake_tome', name: '地割れの古書', kind: 'weapon', wtype: 'anima', rank: 'A', mt: 13, hit: 75, crit: 0, wt: 13, min: 1, max: 3, magic: true, price: 5200, desc: '大地を裂く古の魔を綴った、遠射の禁書。' });

/* ---- 光の遺物 ---- */
def({ id: 'relic_dawnlight', name: '黎明の遺光', kind: 'weapon', wtype: 'light', rank: 'A', mt: 12, hit: 85, crit: 5, wt: 11, min: 1, max: 2, magic: true, eff: ['dragon'], price: 5600, desc: '黎明の世に灯された古き光。竜に特効。' });

/* ---- 闇の遺物 ---- */
def({ id: 'relic_crypt_tome', name: '地下墓の呪書', kind: 'weapon', wtype: 'dark', rank: 'B', mt: 12, hit: 75, crit: 0, wt: 13, min: 1, max: 2, magic: true, price: 3800, desc: '地下墓所に封じられた、生者を蝕む呪いの書。' });
def({ id: 'relic_soulripper', name: '古魂喰らいネクロ', kind: 'weapon', wtype: 'dark', rank: 'A', mt: 13, hit: 75, crit: 0, wt: 14, min: 1, max: 2, magic: true, drain: true, price: 5600, desc: '古の死霊術師の禁書。敵の生命を吸い上げる。' });

/* ---- 拳の遺物 ---- */
def({ id: 'relic_stone_fist', name: '石守りの篭手', kind: 'weapon', wtype: 'fist', rank: 'A', mt: 11, hit: 85, crit: 10, wt: 6, min: 1, max: 1, price: 4200, desc: '遺跡を守りし石像の篭手。重く速き一撃。' });

/* ---- 短剣の遺物 ---- */
def({ id: 'relic_grave_dagger', name: '墓荒らしの短剣', kind: 'weapon', wtype: 'dagger', rank: 'B', mt: 7, hit: 90, crit: 10, wt: 4, min: 1, max: 2, inflict: { id: 'poison', chance: 40, turns: 3 }, price: 3400, desc: '墓を暴く者が用いた、毒を塗りし古き刃。' });
def({ id: 'relic_silent_edge', name: '静寂の古刃', kind: 'weapon', wtype: 'dagger', rank: 'A', mt: 8, hit: 95, crit: 10, wt: 4, min: 1, max: 2, inflict: { id: 'sleep', chance: 45, turns: 2 }, price: 4400, desc: '遺跡の静寂を宿し、斬られた者を眠りに誘う短剣。' });

/* ---- 杖の遺物 ---- */
def({ id: 'relic_sage_staff', name: '古賢者の杖', kind: 'weapon', wtype: 'staff', rank: 'B', mt: 0, hit: 100, crit: 0, wt: 6, min: 1, max: 7, staff: 'heal', power: 18, price: 2800, desc: '古き賢者が遺した、傷を癒す慈愛の杖。' });
def({ id: 'relic_relief_staff', name: '遺跡の癒し杖', kind: 'weapon', wtype: 'staff', rank: 'A', mt: 0, hit: 100, crit: 0, wt: 7, min: 1, max: 9, staff: 'mend', power: 24, price: 3800, desc: '遺跡より出でし、遠くまで届く治癒の杖。' });
def({ id: 'relic_oracle_staff', name: '神託の古杖', kind: 'weapon', wtype: 'staff', rank: 'A', mt: 0, hit: 100, crit: 0, wt: 8, min: 1, max: 8, staff: 'physic', power: 22, price: 4000, desc: '神託を伝えし巫女の杖。遠き味方を癒す。' });
def({ id: 'relic_ancient_recover', name: '甦りの秘杖', kind: 'weapon', wtype: 'staff', rank: 'A', mt: 0, hit: 100, crit: 0, wt: 9, min: 1, max: 5, staff: 'recover', power: 30, price: 5200, desc: '古代の秘術を秘めた、大いなる治癒の杖。' });

/* ---- 遺物の能力品（恒久ブースター） ---- */
def({ id: 'relic_war_drum', name: '古の戦太鼓', kind: 'booster', stat: 'str', amount: 3, price: 8000, desc: '力 +3（永続）。いにしえの戦を鼓舞せし太鼓。' });
def({ id: 'relic_rune_stone', name: '古代の刻印石', kind: 'booster', stat: 'mag', amount: 3, price: 8000, desc: '魔 +3（永続）。理の刻まれた古き石。' });
def({ id: 'relic_iron_amulet', name: '古鉄の護符', kind: 'booster', stat: 'def', amount: 3, price: 8000, desc: '守り +3（永続）。古鉄に宿る堅守の力。' });

/* ---- 遺物の装飾（装備中つねに効果） ---- */
def({ id: 'relic_signet_ring', name: '古王の印環', kind: 'accessory', def: 2, res: 2, price: 5400, desc: '滅びし王の印環。守りと魔防をわずかに高める。' });
def({ id: 'relic_swift_anklet', name: '俊足の古足環', kind: 'accessory', spd: 3, price: 5000, desc: '古き俊足の戦士が着けた足環。速さを高める。' });
def({ id: 'relic_lucky_charm', name: '幸運の古護符', kind: 'accessory', lck: 4, price: 4600, desc: '遺跡より出でし、幸運を呼ぶ古き護符。' });
