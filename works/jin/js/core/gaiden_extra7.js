/* ============================================================
   陣 — 外伝・其の七、七度目の遠征。なお遠き涯に眠る八つの戦記。
   題と物語、小ボスと目標だけを携えた純然たるデータ群。
   キャンペーンの保存には触れぬ——同じ種なら、何度でも同じ一戦。
   ============================================================ */

/* なおも続く外伝シナリオ（純粋なデータ）。 */
export const EXTRA_GAIDEN7 = [
  { id: 'reedmarsh', title: '外伝・葦沼の渡し', biome: 'green', size: 'small', level: 7, objective: 'rout',
    boss: { classId: 'brigand', name: '沼渡りのカジャ', level: 10, items: ['hand_axe'] },
    intro: '葦の生い茂る沼の渡し場を野盗が押さえ、舟を出す者から渡り賃を奪い取る。',
    outro: '盗賊は葦の中に沈み、渡しにはまた静かな櫂の音が戻った。' },

  { id: 'cinquefoil', title: '外伝・五葉の毒苑', biome: 'green', size: 'medium', level: 11, objective: 'defeat_boss', monster: true,
    boss: { classId: 'gargoyle', name: '苑番のスカル', level: 14 },
    intro: '五葉の毒草が咲き乱れる古き苑で、石の魔物が翼を広げ立ち入る者を裂く。',
    outro: '石翼は砕け、毒苑に淀んでいた瘴気がゆるやかに薄れていった。' },

  { id: 'tallowpit', title: '外伝・獣脂の坑', biome: 'volcano', size: 'medium', level: 13, objective: 'seize',
    boss: { classId: 'warrior', name: '脂火のドラグ', level: 17, items: ['steel_axe'] },
    intro: '獣脂の燃ゆる暗き坑を山賊団が奪い、掘り出した脂を炎に変えて坑道を焼く。',
    outro: '坑は取り戻され、煤けた坑道に再び正しき鶴嘴の音が響いた。' },

  { id: 'hoarstone', title: '外伝・霜石の砦', biome: 'snow', size: 'large', level: 16, objective: 'defeat_boss',
    boss: { classId: 'greatknight', name: '凍鎧のヘルガ', level: 20, items: ['silver_lance'] },
    intro: '霜に覆われた石砦に重騎士が陣を据え、雪原を越えんとする隊をことごとく阻む。',
    outro: '重騎士は霜石に倒れ、砦を越える雪道にようやく旅人の影が戻った。' },

  { id: 'mirageford', title: '外伝・蜃気の渡', biome: 'desert', size: 'medium', level: 18, objective: 'seize',
    boss: { classId: 'sorcerer', name: '蜃楼のザミル', level: 22, items: ['flux'] },
    intro: '蜃気楼の揺らぐ砂中の渡し場で、術士が偽りの水辺を描き隊商を熱砂に沈める。',
    outro: '渡は奪い返され、偽りの水は消えて遠き本流の輝きだけが道を示した。' },

  { id: 'ravenkeep', title: '外伝・烏羽の楼', biome: 'ruins', size: 'large', level: 21, objective: 'defeat_boss',
    boss: { classId: 'assassin', name: '夜烏のセラ', level: 26, items: ['killing_edge'] },
    intro: '烏の巣食う朽ちた高楼で、暗殺者が闇に紛れ楼へ近づく者の喉を音もなく断つ。',
    outro: '暗殺者は楼上に斃れ、烏は散じ、廃楼にはただ夜風が通うのみとなった。' },

  { id: 'tombwick', title: '外伝・墓燭の地廊', biome: 'ruins', size: 'small', level: 23, objective: 'defeat_boss', monster: true,
    boss: { classId: 'revenant', name: '燭守のモル', level: 27 },
    intro: '墓燭のゆらめく地下の廊で、朽ちぬ屍が消えぬ蝋を抱え弔われぬ骸を呼び起こす。',
    outro: '墓燭は燃え尽き、地廊に満ちていた死の気配が静かに土へ還った。' },

  { id: 'pyrethrone', title: '外伝・炎座の宝宮', biome: 'volcano', size: 'large', level: 27, objective: 'seize',
    boss: { classId: 'wyvernlord', name: '焦翼のガロン', level: 30, items: ['silver_axe'] },
    intro: '燃え盛る炎の玉座に竜将が君臨し、火口の宝宮を熔けた壁で固く閉ざしている。',
    outro: '宝宮は奪い返され、鎮まりゆく炎の座にようやく静かな灰が降り積もった。' },
];
