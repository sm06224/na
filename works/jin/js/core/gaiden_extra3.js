/* ============================================================
   陣 — 外伝・其の三、三度目の遠征。なお埋もれし辺境に、八つの戦記。
   題と物語、小ボスと目標だけを携えた純然たるデータ群。
   キャンペーンの保存には触れぬ——同じ種なら、何度でも同じ一戦。
   ============================================================ */

/* なおも続く外伝シナリオ（純粋なデータ）。 */
export const EXTRA_GAIDEN3 = [
  { id: 'reedfen', title: '外伝・葦原の伏兵', biome: 'green', size: 'small', level: 7, objective: 'rout',
    boss: { classId: 'fighter', name: '泥手のドゥーガ', level: 10, items: ['steel_axe'] },
    intro: '丈高い葦が視界を塞ぐ湿原に、賊が身を伏せて旅商の隊列を待ち構えている。',
    outro: '葦は刈り倒され、伏兵の隠れ場はもう辺境のどこにも残っていなかった。' },

  { id: 'amberwood', title: '外伝・琥珀の樹海', biome: 'green', size: 'medium', level: 9, objective: 'defeat_boss',
    boss: { classId: 'ranger', name: '樹冠のフィオナ', level: 12, items: ['killer_bow'] },
    intro: '樹脂が陽を受けて琥珀色に光る森で、密猟の頭目が獣道を支配し通行を許さぬ。',
    outro: '頭目は倒れ、琥珀の森に再び旅人の足音が戻ってきた。' },

  { id: 'cindermoth', title: '外伝・灰蛾の坑', biome: 'volcano', size: 'medium', level: 12, objective: 'rout', monster: true,
    boss: { classId: 'gargoyle', name: '熱風のザグ', level: 15 },
    intro: '熱気立ち昇る廃坑の闇から、灰をまとう翼の眷属が群れをなして湧き出してくる。',
    outro: '羽音は絶え、坑道には熱せられた岩の唸りだけが低く響いていた。' },

  { id: 'brackmoor', title: '外伝・汽水の砦', biome: 'green', size: 'medium', level: 14, objective: 'seize',
    boss: { classId: 'halberdier', name: '潮垣のレーヴ', level: 18, items: ['silver_lance'] },
    intro: '海と川が混じる汽水の岸に砦が建ち、傭兵団が関を閉ざして通行料を貪っている。',
    outro: '関は開かれ、汽水の砦は川を行く者すべてに門を譲った。' },

  { id: 'gypsum', title: '外伝・石膏の迷窟', biome: 'desert', size: 'large', level: 16, objective: 'defeat_boss',
    boss: { classId: 'sorcerer', name: '白闇のカリム', level: 20, items: ['nosferatu'] },
    intro: '白く脆い石膏の洞が幾重にも枝分かれし、その奥で術師が命を吸う闇を編んでいる。',
    outro: '闇は晴れ、石膏の壁が松明の火を白く照り返すだけになった。' },

  { id: 'frostkiln', title: '外伝・凍窯の主', biome: 'snow', size: 'medium', level: 18, objective: 'defeat_boss',
    boss: { classId: 'sage', name: '冷炉のイズベル', level: 22, items: ['fimbulvetr'] },
    intro: '雪に埋もれた古き窯で、賢者が炎ならぬ凍気を焚き、近づく者を氷像に変えていく。',
    outro: '凍気の炉は砕け、窯の周りの雪がようやく自らの白さを取り戻した。' },

  { id: 'wraithgate', title: '外伝・亡者の門', biome: 'ruins', size: 'large', level: 21, objective: 'seize', monster: true,
    boss: { classId: 'revenant', name: '門守りのオルク', level: 25 },
    intro: '崩れた城門に死せる者どもが列をなし、要石を抱える主が通る者を呑み込まんと待つ。',
    outro: '要石は奪われ、亡者の門は二度と開かぬよう静かに塞がれた。' },

  { id: 'voltspire', title: '外伝・雷尖の塔', biome: 'ruins', size: 'large', level: 24, objective: 'defeat_boss',
    boss: { classId: 'mortalsavant', name: '雷を断つ者ヴァイス', level: 28, items: ['thunder'] },
    intro: '雷を呼ぶ尖塔の頂で、剣と魔を兼ねる者が落雷を意のままに操り近づく影を焼く。',
    outro: '塔の雷は鎮まり、尖塔はただ風雨に晒される古き石へと戻った。' },
];
