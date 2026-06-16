/* ============================================================
   陣 — 外伝・続。本筋の隙間に滲み出た、もう八つの戦記。
   題と物語、小ボスと目標だけを携えた純然たるデータ群。
   キャンペーンの保存には触れぬ——同じ種なら、何度でも同じ一戦。
   ============================================================ */

/* 追加の外伝シナリオ（純粋なデータ）。 */
export const EXTRA_GAIDEN = [
  { id: 'beacon', title: '外伝・狼煙の丘', biome: 'green', size: 'small', level: 7, objective: 'seize',
    boss: { classId: 'soldier', name: '丘番のドルク', level: 10, items: ['steel_lance'] },
    intro: '丘の狼煙が消えて三日。誰かが砦を奪い、灯を絶やしたままだ。砦を取り戻せ。',
    outro: '狼煙がまた立ちのぼり、谷の村々が安堵の息をついた。' },

  { id: 'mire', title: '外伝・沼の囁き', biome: 'green', size: 'medium', level: 9, objective: 'rout', monster: true,
    boss: { classId: 'revenant', name: '泥に沈みし者', level: 12 },
    intro: '霧立つ沼に、死にきれぬ屍が囁きながら這い寄る。', outro: '泥は静まり、囁きは水底へ還っていった。' },

  { id: 'saltpan', title: '外伝・塩の道', biome: 'desert', size: 'medium', level: 12, objective: 'defeat_boss',
    boss: { classId: 'swordmaster', name: '塩刃のヤズィル', level: 16, items: ['killer_bow'] },
    intro: '白く灼ける塩の道を、剣士が独り占めにしている。通る者は皆、刃で止められた。',
    outro: '塩の道はふたたび旅人に開かれ、駱駝の列が静かに過ぎていった。' },

  { id: 'reliquary', title: '外伝・聖遺の祭壇', biome: 'ruins', size: 'medium', level: 15, objective: 'seize',
    boss: { classId: 'bishop', name: '祭壇守ミレナ', level: 19, items: ['light'] },
    intro: '崩れた聖堂の奥、祭壇に聖遺が眠る。祈りを盾とする守人が、誰も近づけぬ。祭壇を制せ。',
    outro: '祭壇に手が触れ、長き祈りがようやく報われた。' },

  { id: 'thornwood', title: '外伝・棘の森', biome: 'green', size: 'medium', level: 17, objective: 'defeat_boss',
    boss: { classId: 'griffon', name: '森番ライガ', level: 21, items: ['silver_sword'] },
    intro: '棘の森に分け入る者を、空翔ける番人が見逃さぬ。', outro: '番人は翼を畳み、森は来訪者に道を譲った。' },

  { id: 'glacier', title: '外伝・氷河の咆哮', biome: 'snow', size: 'large', level: 20, objective: 'rout', monster: true,
    boss: { classId: 'gargoyle', name: '氷牙のグルム', level: 24 },
    intro: '氷河の裂け目から、凍てつく翼の群れが咆哮とともに溢れ出す。', outro: '咆哮は途絶え、氷河はもとの白い沈黙へ戻った。' },

  { id: 'cinderkeep', title: '外伝・燼の城砦', biome: 'volcano', size: 'large', level: 23, objective: 'seize',
    boss: { classId: 'general', name: '燼城のヴァロス', level: 27, items: ['steel_lance'] },
    intro: '溶岩に囲まれた城砦が、灰を撒きながら玉座を守る。熱を越え、玉座を制せ。',
    outro: '城砦の門が崩れ、燃え残りの旗が一枚、静かに落ちた。' },

  { id: 'voidgate', title: '外伝・虚の門', biome: 'ruins', size: 'large', level: 26, objective: 'defeat_boss',
    boss: { classId: 'druid', name: '門を開く者ザイン', level: 30, items: ['fimbulvetr'] },
    intro: '廃都の最奥、虚へ通じる門を開こうとする術師がいる。門が開けば、二度と閉じぬという。',
    outro: '門は閉ざされ、向こうの闇はもう何も囁かなかった。' },
];
