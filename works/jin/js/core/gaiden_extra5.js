/* ============================================================
   陣 — 外伝・其の五、五度目の遠征。境を越えた先に潜む八つの戦記。
   題と物語、小ボスと目標だけを携えた純然たるデータ群。
   キャンペーンの保存には触れぬ——同じ種なら、何度でも同じ一戦。
   ============================================================ */

/* なおも続く外伝シナリオ（純粋なデータ）。 */
export const EXTRA_GAIDEN5 = [
  { id: 'fenmire', title: '外伝・沼霧の関', biome: 'green', size: 'small', level: 7, objective: 'rout',
    boss: { classId: 'fighter', name: '沼引きのゴルム', level: 10, items: ['steel_axe'] },
    intro: '霧の垂れこめる沼の関所を山賊が我が物とし、行き交う荷を泥に沈めている。',
    outro: '賊は沼に呑まれ、霧の関にはまた淀みなき水路だけが残った。' },

  { id: 'sunspire', title: '外伝・陽灼の尖塔', biome: 'desert', size: 'medium', level: 9, objective: 'seize',
    boss: { classId: 'halberdier', name: '灼熱のザイド', level: 12, items: ['steel_lance'] },
    intro: '灼ける陽を一身に集める尖塔を傭兵が占め、隊商路の井戸を封じている。',
    outro: '尖塔は奪い返され、灼けた砂路にふたたび水を求める列が伸びた。' },

  { id: 'gravechime', title: '外伝・喪鐘の墟', biome: 'ruins', size: 'medium', level: 12, objective: 'defeat_boss', monster: true,
    boss: { classId: 'revenant', name: '鐘守りのウェズ', level: 15 },
    intro: '夜ごと喪の鐘が独り鳴る廃墟で、朽ちざる屍が弔いを待たぬ骸を引き連れる。',
    outro: '喪鐘は砕け、墟に立ちこめた死の気配がようやく地へと還った。' },

  { id: 'magmavault', title: '外伝・熔鉄の地下宮', biome: 'volcano', size: 'large', level: 14, objective: 'defeat_boss',
    boss: { classId: 'warrior', name: '溶岩のドルガ', level: 18, items: ['silver_axe'] },
    intro: '熔けた鉄が川をなす地下宮で、武人が捕えた職人に呪われた武具を打たせている。',
    outro: '武人は熔鉄に沈み、地下宮の炉はようやく赤き脈動を止めた。' },

  { id: 'palefrost', title: '外伝・蒼氷の祭室', biome: 'snow', size: 'medium', level: 16, objective: 'seize',
    boss: { classId: 'valkyrie', name: '凍てのリディア', level: 20, items: ['silver_lance'] },
    intro: '蒼く凍る祭室に氷の聖女が籠もり、雪に迷う巡礼を生贄として閉じ込めている。',
    outro: '祭室は解き放たれ、蒼氷の壁が一筋の温もりに静かに滴り落ちた。' },

  { id: 'gloomvault', title: '外伝・幽闇の納堂', biome: 'ruins', size: 'small', level: 18, objective: 'defeat_boss',
    boss: { classId: 'sorcerer', name: '闇紡ぎのカイル', level: 22, items: ['flux'] },
    intro: '陽の届かぬ納堂で術者が幽き闇を編み、奪った魂を糧に古き禁呪を呼び覚ます。',
    outro: '闇は払われ、納堂に長く絶えていた光がひとすじ差し込んだ。' },

  { id: 'thornveil', title: '外伝・茨帳の庭', biome: 'green', size: 'large', level: 20, objective: 'rout', monster: true,
    boss: { classId: 'gargoyle', name: '茨翼のドラン', level: 24 },
    intro: '茨が帳をなし庭を覆い隠す廃苑で、翼ある魔物が花陰から旅人を狩り立てる。',
    outro: '茨は焼き払われ、苑にはまた風の通う道がひらけて静まった。' },

  { id: 'mirrorhall', title: '外伝・鏡影の回廊', biome: 'ruins', size: 'large', level: 23, objective: 'defeat_boss',
    boss: { classId: 'mortalsavant', name: '鏡裏のセレス', level: 28, items: ['silver_sword'] },
    intro: '無数の鏡が影を映す古き回廊の奥で、剣賢者が己の幻影を従え刃を研ぐ。',
    outro: '鏡はことごとく砕け、回廊にはもはや偽りの影一つ残らなかった。' },
];
