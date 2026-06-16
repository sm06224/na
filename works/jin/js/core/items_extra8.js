/* ============================================================
   陣 — 「異邦の珍品（いほうのちんぴん）」の得物。
   海を越えて渡り来た、異国の珍奇なる武具と品々。
   南蛮の刀剣、西方の弓、遠つ国の魔導書——交易の港に並ぶ舶来の逸品。
   星・遺物・銘品とは別系統の、中〜低位の一群。すべて値があり、店に並ぶ。
   既存の登録に重ねるだけ。
   ============================================================ */

import { ITEMS } from './items.js';

function def(o) { ITEMS[o.id] = o; return o; }

/* ---- 異邦の剣 ---- */
def({ id: 'exotic_sabel_sword', name: '南蛮のサーベル', kind: 'weapon', wtype: 'sword', rank: 'C', mt: 8, hit: 90, crit: 10, wt: 6, min: 1, max: 1, price: 1400, desc: '異国の騎士が佩いた、反りの浅い片刃の剣。' });
def({ id: 'exotic_rapier_thorn', name: '西方の細身剣', kind: 'weapon', wtype: 'sword', rank: 'B', mt: 10, hit: 95, crit: 10, wt: 5, min: 1, max: 1, eff: ['horse', 'armor'], price: 2600, desc: '遠つ国渡りの細身剣。馬上と重装の鎧を貫く。' });

/* ---- 異邦の槍 ---- */
def({ id: 'exotic_pike_long', name: '異邦の長柄槍', kind: 'weapon', wtype: 'lance', rank: 'C', mt: 9, hit: 80, crit: 0, wt: 10, min: 1, max: 2, price: 1500, desc: '海の彼方の兵が並べ構えた、長き柄の槍。' });
def({ id: 'exotic_trident_brine', name: '潮鳴りの三叉戟', kind: 'weapon', wtype: 'lance', rank: 'B', mt: 11, hit: 80, crit: 5, wt: 11, min: 1, max: 2, eff: ['horse'], price: 2800, desc: '南海の漁師が用いた三叉の戟。騎馬を打ち落とす。' });

/* ---- 異邦の斧 ---- */
def({ id: 'exotic_broadaxe_north', name: '北蛮の広刃斧', kind: 'weapon', wtype: 'axe', rank: 'C', mt: 11, hit: 70, crit: 5, wt: 12, min: 1, max: 1, price: 1500, desc: '極北の戦士が振るった、刃の広い猛々しき斧。' });
def({ id: 'exotic_cleaver_isle', name: '島渡りの鉈斧', kind: 'weapon', wtype: 'axe', rank: 'B', mt: 13, hit: 70, crit: 5, wt: 13, min: 1, max: 1, eff: ['armor'], price: 2700, desc: '南の島々から渡った重き鉈斧。重装に特効。' });

/* ---- 異邦の弓 ---- */
def({ id: 'exotic_shortbow_steppe', name: '草原の騎射弓', kind: 'weapon', wtype: 'bow', rank: 'C', mt: 7, hit: 85, crit: 10, wt: 5, min: 2, max: 2, price: 1500, desc: '草原の遊牧の民が馬上から放った、しなやかな弓。' });
def({ id: 'exotic_crossbow_west', name: '西国の弩弓', kind: 'weapon', wtype: 'bow', rank: 'B', mt: 10, hit: 80, crit: 5, wt: 9, min: 2, max: 3, eff: ['fly'], price: 2800, desc: '西の国から渡った機巧の弩。空飛ぶ敵を射落とす。' });

/* ---- 理（アニマ）の異邦品 ---- */
def({ id: 'exotic_storm_codex', name: '潮風の嵐書', kind: 'weapon', wtype: 'anima', rank: 'B', mt: 11, hit: 80, crit: 5, wt: 11, min: 1, max: 2, magic: true, inflict: { id: 'slow', chance: 30, turns: 2 }, price: 3000, desc: '海の彼方で編まれた、嵐を起こす書。風が敵を鈍らせる。' });

/* ---- 光の異邦品 ---- */
def({ id: 'exotic_sun_scripture', name: '日輪の聖典', kind: 'weapon', wtype: 'light', rank: 'B', mt: 10, hit: 90, crit: 5, wt: 10, min: 1, max: 2, magic: true, eff: ['dragon'], price: 3000, desc: '日輪を崇める異邦の聖典。竜の血を退ける光を放つ。' });

/* ---- 闇の異邦品 ---- */
def({ id: 'exotic_voodoo_tome', name: '呪術師の蠱書', kind: 'weapon', wtype: 'dark', rank: 'C', mt: 8, hit: 75, crit: 0, wt: 10, min: 1, max: 2, magic: true, inflict: { id: 'sleep', chance: 25, turns: 1 }, price: 1900, desc: '遠つ国の呪術師が記した蠱の書。眠りの呪いを宿す。' });
def({ id: 'exotic_eclipse_grimoire', name: '蝕の異教書', kind: 'weapon', wtype: 'dark', rank: 'B', mt: 11, hit: 80, crit: 0, wt: 12, min: 1, max: 2, magic: true, drain: true, price: 3200, desc: '異教徒が崇めた蝕の書。敵の生命を吸い取る。' });

/* ---- 拳の異邦品 ---- */
def({ id: 'exotic_tiger_claw', name: '異国の虎爪', kind: 'weapon', wtype: 'fist', rank: 'C', mt: 7, hit: 90, crit: 10, wt: 4, min: 1, max: 1, price: 1300, desc: '南方の拳法家が用いた、虎の爪を象った鉄の得物。' });
def({ id: 'exotic_brass_knuckle', name: '南蛮の真鍮拳', kind: 'weapon', wtype: 'fist', rank: 'B', mt: 9, hit: 90, crit: 15, wt: 5, min: 1, max: 1, price: 2500, desc: '南蛮渡りの真鍮の篭手。鋭く重き拳を打ち込む。' });

/* ---- 短剣の異邦品 ---- */
def({ id: 'exotic_kris_wave', name: '波文の短剣クリス', kind: 'weapon', wtype: 'dagger', rank: 'C', mt: 6, hit: 90, crit: 10, wt: 3, min: 1, max: 2, price: 1300, desc: '波打つ刃を持つ、南海の島より渡りし短剣。' });
def({ id: 'exotic_scimitar_short', name: '砂漠の曲刀子', kind: 'weapon', wtype: 'dagger', rank: 'B', mt: 8, hit: 90, crit: 15, wt: 4, min: 1, max: 2, price: 2400, desc: '熱砂の隊商が懐に忍ばせた、反り深き小さな曲刀。' });

/* ---- 異邦の杖 ---- */
def({ id: 'exotic_coral_staff', name: '珊瑚の癒し杖', kind: 'weapon', wtype: 'staff', rank: 'C', mt: 0, hit: 100, crit: 0, wt: 5, min: 1, max: 7, staff: 'heal', power: 14, price: 1200, desc: '南海の珊瑚を削り出した、傷を癒す異国の杖。' });
def({ id: 'exotic_ivory_staff', name: '象牙の治癒杖', kind: 'weapon', wtype: 'staff', rank: 'B', mt: 0, hit: 100, crit: 0, wt: 7, min: 1, max: 9, staff: 'mend', power: 20, price: 2400, desc: '異国の象牙を磨いた、遠くまで届く治癒の杖。' });
def({ id: 'exotic_jade_staff', name: '翡翠の遠癒杖', kind: 'weapon', wtype: 'staff', rank: 'B', mt: 0, hit: 100, crit: 0, wt: 8, min: 1, max: 8, staff: 'physic', power: 18, price: 2600, desc: '遠つ国の翡翠で誂えた杖。離れた味方を癒す。' });
def({ id: 'exotic_amber_staff', name: '琥珀の秘癒杖', kind: 'weapon', wtype: 'staff', rank: 'A', mt: 0, hit: 100, crit: 0, wt: 9, min: 1, max: 6, staff: 'recover', power: 26, price: 3600, desc: '異邦の琥珀を芯に据えた、大いなる治癒の秘杖。' });

/* ---- 異邦の能力品（恒久ブースター） ---- */
def({ id: 'exotic_dragon_pepper', name: '竜舌の辛香', kind: 'booster', stat: 'str', amount: 2, price: 5000, desc: '力 +2（永続）。舌を焼く異国の香辛料。' });
def({ id: 'exotic_lotus_incense', name: '蓮の異香', kind: 'booster', stat: 'mag', amount: 2, price: 5000, desc: '魔力 +2（永続）。心を澄ます遠つ国の薫香。' });
def({ id: 'exotic_wind_powder', name: '疾風の異粉', kind: 'booster', stat: 'spd', amount: 2, price: 5000, desc: '速さ +2（永続）。身を軽くする異邦の秘薬。' });

/* ---- 異邦の装飾（装備中つねに効果） ---- */
def({ id: 'exotic_jade_amulet', name: '翡翠の護符', kind: 'accessory', res: 2, price: 2800, desc: '異国の翡翠を彫った護符。魔の力を退ける。' });
def({ id: 'exotic_silk_sash', name: '南蛮の絹帯', kind: 'accessory', avo: 5, price: 2600, desc: '海を渡った滑らかな絹の帯。身のこなしを軽くする。' });
def({ id: 'exotic_coral_charm', name: '珊瑚の幸守り', kind: 'accessory', lck: 3, price: 2400, desc: '南海の珊瑚で作られた、幸を呼ぶと伝わる守り。' });
