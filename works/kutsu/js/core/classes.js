/* ============================================================
   窟 — 冒険者の型。始まりの素質・装備・技が変わる。
   どれを選ぶかで、同じ種でも潜り方が変わる。
   ============================================================ */

export const CLASSES = {
  warrior: {
    key: 'warrior', name: '戦士', desc: '頑健で力強い。重い得物を振るい、前へ出る。',
    hp: 28, focus: 8, stats: { str: 5, def: 1, acc: 5, eva: 2, speed: 100 },
    abilities: ['cleave', 'warcry', 'bulwark', 'quake'],
    kit: [['shortsword', 0], ['leather', 0], ['buckler', 0]], potions: 3,
  },
  mage: {
    key: 'mage', name: '魔術師', desc: '脆いが、火と氷を操り、瞬時に身をかわす。',
    hp: 18, focus: 18, stats: { str: 2, def: 0, acc: 3, eva: 3, speed: 100 },
    abilities: ['firebolt', 'frostbolt', 'blink', 'wardshield'],
    kit: [['dagger', 0], ['robe', 0]], potions: 2, scrolls: 1,
  },
  rogue: {
    key: 'rogue', name: '盗賊', desc: '素早く、影に紛れ、隠し刃で急所を突く。',
    hp: 22, focus: 13, stats: { str: 3, def: 0, acc: 5, eva: 5, speed: 110 },
    abilities: ['sneak', 'dagger_throw', 'blink'],
    kit: [['dagger', 1], ['leather', 0], ['cloak', 0]], potions: 2,
  },
  ranger: {
    key: 'ranger', name: '狩人', desc: '遠くから射て、薬草で立て直す。',
    hp: 24, focus: 14, stats: { str: 3, def: 0, acc: 5, eva: 3, speed: 100 },
    abilities: ['aimed_shot', 'volley', 'herbal'],
    kit: [['shortsword', 0], ['studded', 0]], potions: 2,
  },
  priest: {
    key: 'priest', name: '僧侶', desc: '癒しと祝福、聖光で不死を退ける。',
    hp: 24, focus: 16, stats: { str: 3, def: 1, acc: 4, eva: 2, speed: 100 },
    abilities: ['smite', 'mend', 'bless', 'turn_undead'],
    kit: [['mace', 0], ['ringmail', 0]], potions: 2,
  },
};

export function getClass(key) { return CLASSES[key] || CLASSES.warrior; }
export function classKeys() { return Object.keys(CLASSES); }
