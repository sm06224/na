/* ============================================================
   陣 — 外伝・其の六、六度目の遠征。さらに遠き境に眠る八つの戦記。
   題と物語、小ボスと目標だけを携えた純然たるデータ群。
   キャンペーンの保存には触れぬ——同じ種なら、何度でも同じ一戦。
   ============================================================ */

/* なおも続く外伝シナリオ（純粋なデータ）。 */
export const EXTRA_GAIDEN6 = [
  { id: 'briarwell', title: '外伝・棘井の郷', biome: 'green', size: 'small', level: 6, objective: 'rout',
    boss: { classId: 'brigand', name: '井荒らしのバッカ', level: 9, items: ['hand_axe'] },
    intro: '棘に囲まれた泉の郷を野盗が押さえ、村の喉を渇きで締め上げている。',
    outro: '盗賊は棘に絡め取られ、井戸にはまた澄んだ水の音が戻った。' },

  { id: 'sablemoor', title: '外伝・黒泥の野', biome: 'green', size: 'medium', level: 10, objective: 'defeat_boss', monster: true,
    boss: { classId: 'mogall', name: '泥眼のヴェルグ', level: 13 },
    intro: '黒き泥の沈む荒野で、一つ眼の魔物が瘴気を吐き旅人を底なしへ誘う。',
    outro: '泥眼は潰え、野を覆っていた澱んだ瘴気がゆるやかに晴れていった。' },

  { id: 'duskforge', title: '外伝・薄暮の鍛冶場', biome: 'volcano', size: 'medium', level: 12, objective: 'seize',
    boss: { classId: 'hero', name: '残照のガレス', level: 16, items: ['steel_sword'] },
    intro: '薄暮に赤らむ鍛冶場を傭兵団が奪い、奪った名剣を炉にくべて鋳潰している。',
    outro: '鍛冶場は取り戻され、衰えかけた炉に再び正しき槌音が響いた。' },

  { id: 'whitecairn', title: '外伝・白塚の丘', biome: 'snow', size: 'large', level: 15, objective: 'defeat_boss',
    boss: { classId: 'general', name: '雪嶺のボラク', level: 19, items: ['silver_lance'] },
    intro: '雪に埋もれた古塚の丘に将が陣を据え、峠を越える者をことごとく阻んでいる。',
    outro: '将は白塚に倒れ、丘を渡る峠道にようやく旅人の影が戻った。' },

  { id: 'lampveil', title: '外伝・灯帳の砂宮', biome: 'desert', size: 'medium', level: 17, objective: 'seize',
    boss: { classId: 'sage', name: '幻灯のナーシャ', level: 21, items: ['elfire'] },
    intro: '無数の灯が帳をなす砂中の宮で、賢者が幻の灯火で隊商を惑わせ砂に沈める。',
    outro: '砂宮は奪い返され、偽りの灯は消えて夜空の星だけが道を照らした。' },

  { id: 'crowmarch', title: '外伝・鴉境の辺塞', biome: 'ruins', size: 'large', level: 20, objective: 'defeat_boss',
    boss: { classId: 'swordmaster', name: '鴉羽のジン', level: 25, items: ['killing_edge'] },
    intro: '鴉の群れる国境の朽ち砦で、剣聖が黒羽を従え越境する者の首を刈り取る。',
    outro: '剣聖は辺塞に斃れ、鴉は散じ、境にはただ風の通う道が開けた。' },

  { id: 'gravelantern', title: '外伝・墓灯の窖', biome: 'ruins', size: 'small', level: 22, objective: 'defeat_boss', monster: true,
    boss: { classId: 'revenant', name: '灯守りのオズ', level: 26 },
    intro: '墓灯のともる地下の窖で、朽ちぬ屍が消えぬ灯を抱え弔われぬ骸を起こす。',
    outro: '墓灯は尽き果て、窖に満ちていた死の気配が静かに地へ還った。' },

  { id: 'emberthrone', title: '外伝・燼座の玉宮', biome: 'volcano', size: 'large', level: 26, objective: 'seize',
    boss: { classId: 'wyvernlord', name: '焔翼のヴァロ', level: 30, items: ['silver_axe'] },
    intro: '燃え熾る燼の玉座に竜将が君臨し、火口の宮を炎の檻で閉ざしている。',
    outro: '玉宮は奪い返され、消えゆく燼の座にようやく静かな灰が降り積もった。' },
];
