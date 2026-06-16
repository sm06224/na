/* ============================================================
   陣 — 「銘品（めいひん）」の得物。
   名匠・刀工の手によって鍛えられし、銘を刻まれた逸品の数々。
   ○○作の太刀、名工の槍、鍛冶神に捧げし斧——いずれも世に名高き作。
   星・遺物とは別系統の、中〜高位の一群。すべて値があり、店に並ぶ。
   既存の登録に重ねるだけ。
   ============================================================ */

import { ITEMS } from './items.js';

function def(o) { ITEMS[o.id] = o; return o; }

/* ---- 銘品の剣 ---- */
def({ id: 'forged_masamune_tachi', name: '正宗作の太刀', kind: 'weapon', wtype: 'sword', rank: 'A', mt: 13, hit: 90, crit: 10, wt: 9, min: 1, max: 1, price: 4800, desc: '名工・正宗が打ちし、澄み切った刃の太刀。' });
def({ id: 'forged_muramasa_blade', name: '村正作の妖刀', kind: 'weapon', wtype: 'sword', rank: 'A', mt: 14, hit: 85, crit: 20, wt: 10, min: 1, max: 1, price: 5200, desc: '村正の手による、血を欲すると噂される妖刀。' });
def({ id: 'forged_kotetsu_sword', name: '虎徹作の刀', kind: 'weapon', wtype: 'sword', rank: 'B', mt: 11, hit: 90, crit: 5, wt: 8, min: 1, max: 1, price: 3400, desc: '実戦の業物として名高い、虎徹の打ちし刀。' });

/* ---- 銘品の槍 ---- */
def({ id: 'forged_tonbo_lance', name: '蜻蛉切の名槍', kind: 'weapon', wtype: 'lance', rank: 'A', mt: 13, hit: 85, crit: 5, wt: 11, min: 1, max: 2, price: 5000, desc: '触れた蜻蛉さえ両断したと伝わる、天下の名槍。' });
def({ id: 'forged_smith_spear', name: '名工の槍', kind: 'weapon', wtype: 'lance', rank: 'B', mt: 11, hit: 80, crit: 5, wt: 11, min: 1, max: 2, price: 3400, desc: '名のある鍛冶が丹精込めて打った、遠近を貫く槍。' });

/* ---- 銘品の斧 ---- */
def({ id: 'forged_hammer_axe', name: '槌神作の戦斧', kind: 'weapon', wtype: 'axe', rank: 'A', mt: 15, hit: 75, crit: 5, wt: 14, min: 1, max: 1, price: 4800, desc: '鍛冶神に捧げられし、重き一撃を誇る戦斧。' });
def({ id: 'forged_giant_axe', name: '大鍛冶の巨斧', kind: 'weapon', wtype: 'axe', rank: 'B', mt: 14, hit: 70, crit: 0, wt: 15, min: 1, max: 1, eff: ['armor'], price: 3600, desc: '大鍛冶が鋼を惜しまず打った巨斧。重装に特効。' });

/* ---- 銘品の弓 ---- */
def({ id: 'forged_yumi_master', name: '弓師重藤の長弓', kind: 'weapon', wtype: 'bow', rank: 'A', mt: 12, hit: 85, crit: 10, wt: 9, min: 2, max: 2, price: 4600, desc: '名弓師・重藤が張りし、よく弾む見事な長弓。' });
def({ id: 'forged_hawk_bow', name: '鷹羽の銘弓', kind: 'weapon', wtype: 'bow', rank: 'B', mt: 10, hit: 80, crit: 5, wt: 9, min: 2, max: 3, eff: ['fly'], price: 3600, desc: '鷹の羽を矧いだ矢を放つ銘弓。飛行に特効。' });

/* ---- 理（アニマ）の銘品 ---- */
def({ id: 'forged_flame_tome', name: '炎工の魔導書', kind: 'weapon', wtype: 'anima', rank: 'A', mt: 13, hit: 80, crit: 5, wt: 12, min: 1, max: 2, magic: true, price: 5000, desc: '炎を綴じ込める術を究めた魔導士の名著。' });

/* ---- 光の銘品 ---- */
def({ id: 'forged_sacred_light', name: '聖匠の光書', kind: 'weapon', wtype: 'light', rank: 'A', mt: 12, hit: 90, crit: 5, wt: 11, min: 1, max: 2, magic: true, eff: ['dragon'], price: 5400, desc: '聖なる匠が記した、清き光を放つ書。竜に特効。' });

/* ---- 闇の銘品 ---- */
def({ id: 'forged_dusk_tome', name: '暗工の呪書', kind: 'weapon', wtype: 'dark', rank: 'B', mt: 11, hit: 80, crit: 0, wt: 12, min: 1, max: 2, magic: true, price: 3800, desc: '影の術者が綴じた、宵闇を呼ぶ呪いの書。' });
def({ id: 'forged_void_grimoire', name: '虚工の禁書', kind: 'weapon', wtype: 'dark', rank: 'A', mt: 13, hit: 80, crit: 0, wt: 13, min: 1, max: 2, magic: true, drain: true, price: 5400, desc: '虚無を識る術者の禁書。敵の生命を吸い取る。' });

/* ---- 拳の銘品 ---- */
def({ id: 'forged_iron_gauntlet', name: '鉄工の篭手', kind: 'weapon', wtype: 'fist', rank: 'A', mt: 11, hit: 90, crit: 10, wt: 6, min: 1, max: 1, price: 4200, desc: '名工が鍛えし鉄の篭手。速く重き一撃を放つ。' });

/* ---- 短剣の銘品 ---- */
def({ id: 'forged_venom_dagger', name: '毒匠の小刀', kind: 'weapon', wtype: 'dagger', rank: 'B', mt: 7, hit: 90, crit: 10, wt: 4, min: 1, max: 2, inflict: { id: 'poison', chance: 40, turns: 3 }, price: 3400, desc: '毒の扱いに長けた匠が打った、刃に毒を帯びる小刀。' });
def({ id: 'forged_mist_dagger', name: '霧匠の懐剣', kind: 'weapon', wtype: 'dagger', rank: 'A', mt: 8, hit: 95, crit: 15, wt: 4, min: 1, max: 2, inflict: { id: 'blind', chance: 40, turns: 2 }, price: 4400, desc: '霧を纏わせる業を秘めた懐剣。斬られた者の目を眩ます。' });

/* ---- 銘品の杖 ---- */
def({ id: 'forged_healer_staff', name: '名工の癒し杖', kind: 'weapon', wtype: 'staff', rank: 'B', mt: 0, hit: 100, crit: 0, wt: 6, min: 1, max: 7, staff: 'heal', power: 18, price: 2800, desc: '名工が削り出した、傷を癒す慈愛の杖。' });
def({ id: 'forged_mend_staff', name: '匠作の治癒杖', kind: 'weapon', wtype: 'staff', rank: 'A', mt: 0, hit: 100, crit: 0, wt: 7, min: 1, max: 9, staff: 'mend', power: 24, price: 3800, desc: '名匠の作による、遠くまで届く治癒の杖。' });
def({ id: 'forged_physic_staff', name: '銘杖アズサ', kind: 'weapon', wtype: 'staff', rank: 'A', mt: 0, hit: 100, crit: 0, wt: 8, min: 1, max: 8, staff: 'physic', power: 22, price: 4000, desc: '梓の銘を持つ杖。遠き味方を癒す。' });
def({ id: 'forged_recover_staff', name: '大匠の秘杖', kind: 'weapon', wtype: 'staff', rank: 'A', mt: 0, hit: 100, crit: 0, wt: 9, min: 1, max: 5, staff: 'recover', power: 30, price: 5200, desc: '大匠が生涯を懸けて作りし、大いなる治癒の杖。' });

/* ---- 銘品の能力品（恒久ブースター） ---- */
def({ id: 'forged_smith_whetstone', name: '名工の砥石', kind: 'booster', stat: 'str', amount: 3, price: 8000, desc: '力 +3（永続）。刃を研ぎ澄ます名工の砥石。' });
def({ id: 'forged_balance_charm', name: '匠の調子守り', kind: 'booster', stat: 'skl', amount: 3, price: 8000, desc: '技 +3（永続）。手の冴えを保つ匠の守り。' });
def({ id: 'forged_temper_plate', name: '焼入れの鋼板', kind: 'booster', stat: 'def', amount: 3, price: 8000, desc: '守り +3（永続）。幾度も焼き入れられた堅き鋼板。' });

/* ---- 銘品の装飾（装備中つねに効果） ---- */
def({ id: 'forged_smith_signet', name: '鍛冶師の印環', kind: 'accessory', def: 2, res: 2, price: 5400, desc: '名匠が遺した印環。守りと魔防をわずかに高める。' });
def({ id: 'forged_keen_band', name: '冴えの腕輪', kind: 'accessory', skl: 3, price: 5000, desc: '匠の冴えを宿す腕輪。技を高める。' });
def({ id: 'forged_fortune_bell', name: '招福の鈴', kind: 'accessory', lck: 4, price: 4600, desc: '名工が鋳た、福を招くと伝わる小さな鈴。' });
