/* ============================================================
   陣 — 外伝・其の四、四度目の遠征。地の果てに眠る八つの戦記。
   題と物語、小ボスと目標だけを携えた純然たるデータ群。
   キャンペーンの保存には触れぬ——同じ種なら、何度でも同じ一戦。
   ============================================================ */

/* なおも続く外伝シナリオ（純粋なデータ）。 */
export const EXTRA_GAIDEN4 = [
  { id: 'mosswell', title: '外伝・苔生す泉', biome: 'green', size: 'small', level: 6, objective: 'rout',
    boss: { classId: 'brigand', name: '泉荒らしのバルク', level: 9, items: ['hand_axe'] },
    intro: '苔むす聖泉を野盗が囲い、水を求める村人から銅貨を絞り取っている。',
    outro: '盗賊は散り、泉は再び誰のものでもない清らかな水を湛えた。' },

  { id: 'duneveil', title: '外伝・砂帷の塔', biome: 'desert', size: 'medium', level: 8, objective: 'seize',
    boss: { classId: 'sentinel', name: '砂塵のハーグ', level: 11, items: ['steel_lance'] },
    intro: '舞い上がる砂が帷をなす隊商路の見張塔を、傭兵が占め、商隊を足止めしている。',
    outro: '塔は明け渡され、砂帷の向こうへ再び荷駄の列が伸びていった。' },

  { id: 'gravetide', title: '外伝・墓潮の渚', biome: 'ruins', size: 'medium', level: 11, objective: 'defeat_boss', monster: true,
    boss: { classId: 'mogall', name: '潮目のヴィヌ', level: 14 },
    intro: '満ち引きのたび古き水葬墓が露わになる渚で、漂う眼の眷属が骸を漁っている。',
    outro: '漂う眼は弾け、墓潮の渚はまた静かに満ち、また静かに引いた。' },

  { id: 'ashreach', title: '外伝・灰届く野', biome: 'volcano', size: 'large', level: 13, objective: 'defeat_boss',
    boss: { classId: 'berserker', name: '焦土のドラグ', level: 17, items: ['silver_axe'] },
    intro: '降り積もる灰が地平まで覆う焼け野で、戦狂いが流民の隊列を狩り立てている。',
    outro: '戦狂いは斃れ、灰の野にようやく逃れる者の足跡が刻まれた。' },

  { id: 'rimegale', title: '外伝・霜嵐の砦', biome: 'snow', size: 'medium', level: 15, objective: 'seize',
    boss: { classId: 'general', name: '氷壁のオーレン', level: 19, items: ['silver_lance'] },
    intro: '吹き荒ぶ霜の嵐に守られた山砦が峠を閉ざし、越境の道を断っている。',
    outro: '砦は陥ち、霜嵐の峠に久方ぶりの旗印がはためいた。' },

  { id: 'gildspire', title: '外伝・金鍍の祭壇', biome: 'desert', size: 'large', level: 17, objective: 'defeat_boss',
    boss: { classId: 'bishop', name: '黄金のセラフィム', level: 21, items: ['light'] },
    intro: '金鍍の祭壇に偽神が祀られ、狂信の司教が捧げ物と称し旅人を屠っている。',
    outro: '偽神の光は潰え、剥がれた金鍍が砂に紛れて消えていった。' },

  { id: 'hexbriar', title: '外伝・呪棘の藪', biome: 'green', size: 'medium', level: 19, objective: 'rout', monster: true,
    boss: { classId: 'gargoyle', name: '棘冠のクェル', level: 23 },
    intro: '呪を帯びた棘の藪が獣道を食い荒らし、翼ある眷属が枝陰から群れ襲う。',
    outro: '藪は焼き払われ、呪棘の道に二度と影が群れることはなかった。' },

  { id: 'shardmaw', title: '外伝・硝子顎の宮', biome: 'ruins', size: 'large', level: 22, objective: 'defeat_boss',
    boss: { classId: 'sage', name: '硝子のアズレル', level: 27, items: ['fimbulvetr'] },
    intro: '硝子の柱が顎のごとく連なる古宮の奥で、賢者が砕けし氷を糧に術を練る。',
    outro: '硝子の顎は崩れ落ち、古宮には澄んだ静寂だけが満ちた。' },
];
