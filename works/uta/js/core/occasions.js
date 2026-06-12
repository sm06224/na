/* ============================================================
   場 — 歌が歌われる場面の在庫。
   暮らしの中で「歌わずにいられない」ときたち。切実な場ほど
   その場の歌は早く・強く根づく（pressure が大きい）。
   ============================================================ */

export const OCCASIONS = [
  { id: 'lull',  label: '子守歌', gloss: '眠れ、眠れ',             hue: 220, pressure: 1.0 },
  { id: 'work',  label: '労働歌', gloss: '声を揃えて運ぶ',         hue: 90,  pressure: 1.3 },
  { id: 'dirge', label: '弔い歌', gloss: '死者を送る',             hue: 0,   pressure: 0.9 },
  { id: 'feast', label: '祭歌',   gloss: '火を囲んで踊る',         hue: 40,  pressure: 1.2 },
  { id: 'love',  label: '恋歌',   gloss: '想いを届ける',           hue: 330, pressure: 1.1 },
  { id: 'rain',  label: '雨乞歌', gloss: '雨を呼ぶ',               hue: 200, pressure: 0.7 },
  { id: 'road',  label: '旅歌',   gloss: '歩みを軽くする',         hue: 150, pressure: 0.8 },
  { id: 'saga',  label: '語り歌', gloss: '出来事を忘れないために', hue: 280, pressure: 0.9 },
];

export const OCCASION_IDS = OCCASIONS.map(o => o.id);
export const occasionById = Object.fromEntries(OCCASIONS.map(o => [o.id, o]));

/* 場どうしの「近さ」。歌が場を移って転用されやすい組。
   （子守歌が恋歌になり、労働歌が祭歌になる — 現実にもよくある転身） */
export const NEIGHBORS = {
  lull:  ['love', 'dirge'],
  work:  ['feast', 'road'],
  dirge: ['lull', 'saga'],
  feast: ['work', 'love'],
  love:  ['lull', 'feast'],
  rain:  ['dirge', 'work'],
  road:  ['work', 'saga'],
  saga:  ['dirge', 'road'],
};
