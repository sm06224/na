/* ============================================================
   陣 — 外伝・其の八、八度目の遠征。涯の向こうに残る八つの戦記。
   題と物語、小ボスと目標だけを携えた純然たるデータ群。
   キャンペーンの保存には触れぬ——同じ種なら、何度でも同じ一戦。
   ============================================================ */

/* なおも続く外伝シナリオ（純粋なデータ）。 */
export const EXTRA_GAIDEN8 = [
  { id: 'larkmoor', title: '外伝・雲雀の荒野', biome: 'green', size: 'small', level: 6, objective: 'rout',
    boss: { classId: 'fighter', name: '荒野のドゥボ', level: 9, items: ['hand_axe'] },
    intro: '雲雀の囀る広き荒野に野伏せが屯し、街道を行く荷馬車を片端から襲う。',
    outro: '野伏せは草に伏し、荒野には再び雲雀の声と穏やかな車輪の音が戻った。' },

  { id: 'glimmerfen', title: '外伝・燐火の湿原', biome: 'green', size: 'medium', level: 10, objective: 'defeat_boss', monster: true,
    boss: { classId: 'mogall', name: '燐眼のヴェル', level: 13 },
    intro: '燐火の漂う湿原の奥で、漂う眼の魔物が惑いの光を放ち迷い込む者を呑む。',
    outro: '燐眼は弾け、湿原を覆っていた青白き火がひとつ残らず消え失せた。' },

  { id: 'sunderpass', title: '外伝・裂け路の関', biome: 'snow', size: 'medium', level: 13, objective: 'seize',
    boss: { classId: 'halberdier', name: '雪関のグレル', level: 16, items: ['steel_lance'] },
    intro: '雪に裂けた峠の関を傭兵団が押さえ、越えんとする隊から法外な通行料を奪う。',
    outro: '関は取り戻され、裂け路の雪道にようやく自由な足跡が刻まれていった。' },

  { id: 'cairnglass', title: '外伝・玻璃塚の宮', biome: 'ruins', size: 'large', level: 16, objective: 'defeat_boss',
    boss: { classId: 'sage', name: '玻璃のイレネ', level: 20, items: ['fimbulvetr'] },
    intro: '砕けた玻璃の積もる古宮で、賢者が硝子の塚を盾に近づく者を氷の刃で貫く。',
    outro: '賢者は玻璃の上に倒れ、宮を満たしていた冷気がゆるやかに溶けていった。' },

  { id: 'ashforge', title: '外伝・灰鍛の溶窟', biome: 'volcano', size: 'medium', level: 18, objective: 'defeat_boss',
    boss: { classId: 'berserker', name: '灰鎚のボルガ', level: 22, items: ['silver_axe'] },
    intro: '灰の降る溶窟に狂戦士が陣取り、熔けた鉄を鎚に変えて坑夫を炎ごと薙ぎ払う。',
    outro: '狂戦士は溶岩に沈み、灰鍛の窟にまた正しき鞴の風が通い始めた。' },

  { id: 'mirewatch', title: '外伝・泥番の砦', biome: 'desert', size: 'large', level: 20, objective: 'seize',
    boss: { classId: 'general', name: '砂壁のターロ', level: 24, items: ['silver_lance'] },
    intro: '砂泥に半ば埋もれた古砦を将が固め、渇いた隊商を厚き砂壁の外に締め出す。',
    outro: '砦は奪い返され、砂壁の井戸に渇いた者らのための水音がまた湧いた。' },

  { id: 'wyrmrest', title: '外伝・龍臥の岩窟', biome: 'snow', size: 'large', level: 23, objective: 'defeat_boss', monster: true,
    boss: { classId: 'gargoyle', name: '霜翼のドラク', level: 27 },
    intro: '雪の岩窟に石龍が臥し、巣に踏み入る者を霜の翼で凍てつかせ砕き散らす。',
    outro: '石翼は氷ごと砕け、龍臥の窟にはただ静かな雪明かりが残された。' },

  { id: 'duskthrone', title: '外伝・薄暮の玉座', biome: 'ruins', size: 'large', level: 27, objective: 'seize',
    boss: { classId: 'sorcerer', name: '昏冥のヴェクト', level: 30, items: ['flux'] },
    intro: '薄暮に沈む朽ちた玉座に術士が君臨し、闇の帳を張りて宮を昏き冥府と化す。',
    outro: '玉座は奪い返され、晴れゆく帳の隙にようやく一筋の薄明が差し込んだ。' },
];
