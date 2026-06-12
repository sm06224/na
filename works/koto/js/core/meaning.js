/* ============================================================
   意味 — 言葉が指しうる概念の在庫。
   世界の中で「伝える価値がある」ものたち。生存と結びつくほど
   その概念の語は早く・強く定着する（pressure が大きい）。
   ============================================================ */

export const CONCEPTS = [
  { id: 'predator', label: '捕食者', gloss: '危険・逃げろ', hue: 0,   pressure: 1.6 },
  { id: 'food',     label: '餌',     gloss: '食べ物がある', hue: 90,  pressure: 1.4 },
  { id: 'water',    label: '水',     gloss: '水場',         hue: 200, pressure: 1.0 },
  { id: 'come',     label: '集まれ', gloss: 'こっちへ来い', hue: 280, pressure: 1.1 },
  { id: 'mate',     label: '求愛',   gloss: 'つがいたい',   hue: 330, pressure: 1.2 },
  { id: 'kin',      label: '仲間',   gloss: '味方だ',       hue: 50,  pressure: 0.7 },
  { id: 'good',     label: '良い',   gloss: '快・肯定',     hue: 150, pressure: 0.5 },
  { id: 'bad',      label: '悪い',   gloss: '不快・否定',   hue: 20,  pressure: 0.6 },
];

export const CONCEPT_IDS = CONCEPTS.map(c => c.id);
export const conceptById = Object.fromEntries(CONCEPTS.map(c => [c.id, c]));
export function conceptIndex(id) { return CONCEPT_IDS.indexOf(id); }

/* 概念どうしの「近さ」。聞き間違い・意味のずれが起きやすい組。
   （捕食者と悪い、餌と良い、など意味的に隣接するもの） */
export const NEIGHBORS = {
  predator: ['bad', 'come'],
  food: ['good', 'water'],
  water: ['food'],
  come: ['kin', 'predator'],
  mate: ['kin', 'good'],
  kin: ['come', 'mate'],
  good: ['food', 'mate'],
  bad: ['predator'],
};
