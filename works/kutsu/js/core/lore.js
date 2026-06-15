/* ============================================================
   窟 — 言い伝え。鑑識帳（bestiary）と、調べたときに出る一言。
   魔物には噂を、品物にはその素性（さいころ・効能）を添える。
   ============================================================ */

import { getMonster } from './monsterdb.js';
import { getItemDef } from './itemdb.js';

export const MONSTER_LORE = {
  rat: '溝を伝う痩せた鼠。一匹なら雑魚、群れれば足を掬われる。',
  giant_rat: '猫ほどもある鼠。歯は鑿のように床を齧る。',
  bat: '闇に酔ったように飛び、軌道が読めない。噛む力は弱い。',
  kobold: '小柄な穴掘り。粗末な刃を持ち、群れで気を大きくする。',
  king_kobold: 'コボルドの長。緑の鎧をまとい、配下を鼓舞する。',
  snake: '湿った岩陰に潜む蝮。噛まれると血に毒がまわる。',
  jackal: '痩せた山犬。速く、群れで獲物を囲んで仕留める。',
  goblin: '腹を空かせた小鬼。錆びた得物を振り、財布を狙う。',
  spider: '天井から糸を垂らす洞蜘蛛。巣で足を止め、毒牙を突き立てる。',
  spider_queen: '腹の膨れた女王蜘蛛。子を産み落とし、濃い毒を吐く。',
  green_mold: '壁に張りつく緑の黴。動かぬが、触れた者を腐らせる。',
  frog: '膨れた毒蛙。跳ねて間合いを詰め、ぬめる舌で打つ。',
  mudling: '泥が固まって歩き出したもの。鈍いが毒は効かない。',
  wisp: '宙に浮く火の粉。近づく前に火花を飛ばしてくる。',
  ant: '甲殻の硬い大蟻。列をなして運び、噛みつく。',
  centipede: '足の多い大百足。素早く這い、毒を盛る。',
  orc: '戦さ慣れしたオーク。厚い腕で重い一撃を振り下ろす。',
  orc_archer: 'オークの射手。間合いの外から矢を継ぐ。',
  zombie: '腐り歩く屍。鈍重だが、打たれても倒れにくい。',
  skeleton: '錆びた剣を握る骸骨兵。毒は効かず、淡々と斬りかかる。',
  gnoll: '鬣の獣人。群れで吠え、力任せに薙ぎ払う。',
  ogre: '見上げる体躯の人喰い。棍棒一振りで骨が軋む。',
  cultist: '深みに魅入られた邪教徒。火の呪文を唱える。',
  imp: '赤い小鬼。すばしこく飛び、魔法の矢を放つ。',
  thief: '影に紛れる盗賊。鞄を掠めて一目散に逃げる。',
  mimic: '宝箱や品物に化けるもの。触れて初めて牙を剥く。',
  wraith: '半透明の怨霊。触れられると生気が抜けていく。',
  wolf: '銀毛の狼。速さと数で囲い込む。',
  bear: '岩室の主の熊。二本の爪は鎧を裂く。',
  lizardman: '鱗の戦士。隊を組み、規律よく戦う。',
  lizard_archer: '鱗の射手。冷静に矢を継いでくる。',
  sahuagin: '水辺の半魚人。濡れた手で三叉を突く。',
  fire_lizard: '火を吐く大トカゲ。炎には強い。',
  shadow: '形のない影。触れると生気を奪い、捉えどころがない。',
  gargoyle: '石の翼を持つ守り手。硬く、毒を寄せつけない。',
  harpy: '人面の鳥。空から羽根の刃を降らせる。',
  mummy: '布に巻かれた古王。打たれた者の動きを鈍らせる。',
  rustmonster: '金物を喰う獣。武具を錆びさせ、価値を奪う。',
  troll: '緑肌の巨人。斬っても見る間に傷が塞がる。',
  vampire: '夜の貴族。血を吸って傷を癒し、氷の魔を操る。',
  drake: '火竜の仔。劫火には満たぬが、十分に熱い炎を吐く。',
  lich: '不死の魔導士。雷を落とし、骸を呼び起こす。',
  demon: '深淵の大鬼。炎をものともせず、力で押し潰す。',
  golem: '魔力で動く石像。あらゆる毒と寒気を撥ね返す。',
  wyvern: '毒尾の飛竜。空から急降下して襲う。',
  basilisk: '石の眼を持つ蜥蜴。見据えられると身が固まる。',
  mindflayer: '蛸頭の魔。精神を掻き乱し、雷を呼ぶ。',
  necromancer: '骸を操る術者。倒しても倒しても骨が立ち上がる。',
  iron_golem: '鉄の巨像。途方もなく硬く、あらゆる元素を弾く。',
  hellhound: '炎を吐く地獄の犬。群れで火を浴びせる。',
  ent: '歩く古木。深手も時とともに癒える。',
  titan: '神話の巨人。一撃の重みが桁違い。',
  dragon: '古き竜。劫火を吐き、その威に大気が震える。窟の深きヌシ。',
  death_king: '死を統べる王。雷と眷属を従え、生者の精を啜る。窟の最奥に座す。',
  kobold_shaman: '骨の杖を振るコボルドの呪術師。小さな魔法の矢を飛ばす。',
  giant_bat: '人ほどもある大蝙蝠。速く、つかみどころがない。',
  fungus: '淡く光る茸。胞子を吸うと頭がくらむ。',
  salamander: '炎をまとう火蜥蜴。触れれば火傷を負う。',
  ghoul: '墓を漁る喰屍鬼。群れで囲み、ときに身を竦ませる。',
  wight: '塚に眠る古い亡者。触れられると生気を吸われる。',
  banshee: '夜に泣く女の霊。その声に身が竦み、氷の魔を呼ぶ。',
  minotaur: '迷宮の牛頭。狭い通路でこそ恐ろしい。',
  chimera: '三つの頭を持つ獣。火を吐き、爪で薙ぐ。',
  eye: '宙を漂う大きな眼。睨まれると雷が落ち、身が固まる。',
  death_knight: '呪われた騎士。重い一撃と、生気を奪う剣。',
  slime: '酸の粘体。鈍いが、武具を溶かし毒も効かぬ。',
  shopkeeper: '地の底の商人。金を出せば品を売る。盗めば——ただでは済まない。',
  beetle: '甲殻の硬い甲虫。守りは固いが、動きは鈍い。',
  bee: '群れなす大蜂。素早く刺し、毒を残す。',
  crab: '岩のような甲蟹。鋏は重く、殻は分厚い。',
  pixie: '光る羽の妖精。魔法の矢を放ち、ふいに消えて現れる。',
  phantom: '半ば透けた幽鬼。睨まれると足が竦む。',
  naga: '蛇の身を持つ呪い手。毒と氷を操る。',
  cyclops: '一つ目の巨人。岩を投げ、間合いの外から潰しにかかる。',
  manticore: '人面の獅子。尾から毒針を雨と降らせる。',
  toad: '見上げる大きさの蟇。鈍いが、舌の一撃は重い。',
  scorpion: '大きな蠍。鋏で挟み、尾の毒で仕留める。',
  warg: '魔性の狼。群れで囲み、速さで翻弄する。',
  dark_elf: '地底に住む闇のエルフ。毒矢を継いでくる。',
  flesh_golem: '縫い合わされた肉の兵。鈍いが、傷は塞がる。',
  frost_giant: '氷をまとう巨人。遠くから氷塊を投げつける。',
  maggot: '床を這う蛆。弱いが、放っておくと数を増す。',
  wasp: '黄色い針蜂。素早く刺し、毒を残す。',
  lynx: '岩棚の山猫。跳躍して一息に間合いを詰める。',
  ghast: '腐臭を放つ鬼。近づくと身が竦む。',
  satyr: '笛を吹く牧神。惑わせ、魔法の矢を放つ。',
  revenant: '執念の亡者。深手も癒え、生気を吸い続ける。',
  behemoth: '見上げる巨獣。一撃で地が揺れる。深層のヌシ格。',
  siren: '歌う海妖。聴く者を惑わし、氷を呼ぶ。',
};

export function monsterLore(key) {
  return MONSTER_LORE[key] || (getMonster(key)?.tags?.includes('undead') ? '名もなき死者。' : 'この迷宮に棲むもの。');
}

/* 魔物の鑑識行（鑑識帳に並ぶ一行：見た数・倒した数つき） */
export function monsterEntry(key, knowledge) {
  const d = getMonster(key);
  const k = knowledge ? knowledge.monster(key) : null;
  return {
    key, name: d.name, glyph: d.glyph, color: d.color,
    depth: d.depth, hp: d.hp, lore: monsterLore(key),
    seen: k ? k.seen : 0, slain: k ? k.slain : 0,
    tags: d.tags || [],
  };
}

const CAT_FLAVOR = {
  potion: '飲めば効く（あるいは祟る）。', scroll: '読めば効く。盲ては読めない。',
  wand: '振れば力が飛ぶ。残量がある。', ring: '嵌めれば常に効く。呪いは外せない。',
  weapon: '手に持って戦う。', armor: '身につけて守る。', food: '食べて飢えをしのぐ。',
  amulet: '窟の最奥に眠る、帰還の証。', gold: 'ただの金。重ねるほど誇らしい。',
};

/* 品物の素性（鑑定済みなら数値、未鑑定なら見た目だけ） */
export function itemInfo(item, idStore) {
  const d = getItemDef(item.def);
  if (!d) return '';
  const known = item.identified || (idStore && idStore.isKnown(d.category, item.def));
  const parts = [];
  if (d.category === 'weapon') {
    parts.push(`傷 ${d.damage}${item.enchant ? `（${item.enchant > 0 ? '+' : ''}${item.enchant}）` : ''}`);
    if (d.acc) parts.push(`命中 ${d.acc > 0 ? '+' : ''}${d.acc}`);
    if (d.twoHanded) parts.push('両手');
    if (d.reach) parts.push('間合い長');
  } else if (d.category === 'armor') {
    parts.push(`防御 ${(d.defense || 0) + item.enchant}`);
    if (d.eva) parts.push(`回避 ${d.eva}`);
  } else if (d.category === 'ring' && d.passive) {
    parts.push(Object.entries(d.passive).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join('・'));
  } else if (d.category === 'food') {
    parts.push(`滋養 ${d.nutrition}`);
  } else if (d.category === 'wand') {
    if (known) parts.push(`効：${d.name}`);
    if (item.charges != null) parts.push(`残 ${item.charges}`);
  }
  if (d.artifact) {
    if (d.passive) parts.push(Object.entries(d.passive).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join('・'));
    if (d.brand) parts.push(`銘：${d.brand.element || ''}`);
    parts.unshift('【遺物】');
  }
  const flavor = known ? '' : CAT_FLAVOR[d.category] || '';
  return [parts.join('　'), flavor].filter(Boolean).join('　／　') || CAT_FLAVOR[d.category] || '';
}
