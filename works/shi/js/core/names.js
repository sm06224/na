/* ============================================================
   命名 — 歴史に固有名詞を。集落も、国も、王も、名を持つ。
   ============================================================ */
const SYL = [
  'カ','キ','ク','ケ','コ','サ','シ','ス','セ','ソ',
  'タ','チ','ツ','テ','ト','ナ','ニ','ヌ','ネ','ノ',
  'ハ','ヒ','フ','ヘ','ホ','マ','ミ','ム','メ','モ',
  'ヤ','ユ','ヨ','ラ','リ','ル','レ','ロ','ワ',
  'ガ','ギ','グ','ゲ','ゴ','ザ','ジ','ズ','ゼ','ゾ',
  'ダ','デ','ド','バ','ビ','ブ','ベ','ボ',
];
const TAIL = ['ン','ル','ス','ト','ム','ラ','ナ',''];

export function placeName(rng) {
  const n = 2 + rng.int(2);
  let s = '';
  for (let i = 0; i < n; i++) s += SYL[rng.int(SYL.length)];
  if (rng.chance(0.35)) s += TAIL[rng.int(TAIL.length)];
  return s;
}

export function rulerName(rng) {
  return placeName(rng);
}

/* 国名：都の名から、あるいは独自に */
export function nationName(rng, cityName) {
  if (rng.chance(0.55) && cityName) return cityName;
  return placeName(rng);
}

const WONDERS = ['大社', '大灯台', '大墳墓', '空中庭園', '大城壁', '大図書館', '大劇場', '天文台'];
export function wonderName(rng, cityName) {
  return `${cityName}の${WONDERS[rng.int(WONDERS.length)]}`;
}
