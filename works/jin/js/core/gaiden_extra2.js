/* ============================================================
   陣 — 外伝・三たび。語られざる辺境に、さらなる八つの戦記。
   題と物語、小ボスと目標だけを携えた純然たるデータ群。
   キャンペーンの保存には触れぬ——同じ種なら、何度でも同じ一戦。
   ============================================================ */

/* さらなる外伝シナリオ（純粋なデータ）。 */
export const EXTRA_GAIDEN2 = [
  { id: 'windmill', title: '外伝・風車の野', biome: 'green', size: 'small', level: 6, objective: 'rout',
    boss: { classId: 'brigand', name: '麦盗りのガロ', level: 9, items: ['steel_axe'] },
    intro: '実りの野に風車が回る。だが収穫を待つのは農夫ではなく、麦を奪う野盗の一団だ。',
    outro: '盗賊は野を去り、風車はまた農夫のために麦を挽きはじめた。' },

  { id: 'tidepool', title: '外伝・潮溜まりの罠', biome: 'green', size: 'small', level: 8, objective: 'defeat_boss',
    boss: { classId: 'thief', name: '潮読みのセラ', level: 11, items: ['killing_edge'] },
    intro: '引き潮の岩場に隠れ財を狙う盗っ人がいる。満ち潮が来る前に、決着をつけねばならぬ。',
    outro: '潮が満ち、岩場の秘密は再び海の底へと沈んでいった。' },

  { id: 'ossuary', title: '外伝・骸の納堂', biome: 'ruins', size: 'medium', level: 10, objective: 'rout', monster: true,
    boss: { classId: 'mogall', name: '虚ろの眼イヴ', level: 13 },
    intro: '骨を積みし納堂の闇から、無数の眼が瞬き、漂いながらこちらを見据える。',
    outro: '眼はひとつまたひとつと閉じ、納堂は本来の静寂を取り戻した。' },

  { id: 'sandglass', title: '外伝・砂時計の宮', biome: 'desert', size: 'medium', level: 14, objective: 'seize',
    boss: { classId: 'sorcerer', name: '時を計る者ナハト', level: 18, items: ['flux'] },
    intro: '砂漠に埋もれし宮殿で、術師が時の流れを止めようと砂時計を握る。玉座を制し、砂を流せ。',
    outro: '砂は再び落ちはじめ、止まっていた時が宮殿にゆるやかに戻った。' },

  { id: 'gallowmoor', title: '外伝・絞首の荒野', biome: 'green', size: 'medium', level: 16, objective: 'defeat_boss',
    boss: { classId: 'sniper', name: '梢のヴェルナ', level: 20, items: ['silver_bow'] },
    intro: '枯れ木が絞首台のように並ぶ荒野で、姿なき射手が旅人を一人また一人と射抜いていく。',
    outro: '矢音は止み、荒野を吹き抜ける風だけが枯れ木を揺らしていた。' },

  { id: 'emberfall', title: '外伝・火粉の滝', biome: 'volcano', size: 'medium', level: 19, objective: 'seize',
    boss: { classId: 'wyvernlord', name: '火翼のドラゴス', level: 23, items: ['silver_lance'] },
    intro: '溶けた岩が滝となって落ちる崖の上、竜騎士が空を制し砦を見下ろす。火粉を越え、砦を奪え。',
    outro: '竜は咆哮を残して去り、火粉の滝のほとりに静けさが訪れた。' },

  { id: 'hollowmere', title: '外伝・虚湖の主', biome: 'snow', size: 'large', level: 22, objective: 'rout', monster: true,
    boss: { classId: 'gargoyle', name: '氷鱗のヴェズ', level: 26 },
    intro: '凍てつく湖の氷を割って、鱗持つ翼の眷属が群れをなして這い上がってくる。',
    outro: '湖は再び氷に閉ざされ、主の影は深い水底へと消えていった。' },

  { id: 'starforge', title: '外伝・星鍛の祭壇', biome: 'ruins', size: 'large', level: 25, objective: 'defeat_boss',
    boss: { classId: 'sage', name: '星を鍛つ者リューゲン', level: 29, items: ['fimbulvetr'] },
    intro: '廃都の天文台で、落星を兵器に鍛え直そうとする賢者がいる。星が鍛え上がれば、空が裂けるという。',
    outro: '鍛炉の火は消え、星はただの石となって祭壇に転がっていた。' },
];
