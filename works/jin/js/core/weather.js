/* ============================================================
   陣 — 天候。戦場には空がある。
   同じ種・同じ章からは、いつも同じ空が垂れこめる。
   雨は弦を湿らせ矢をそらし、嵐は身を泳がせ、霧は目をふさぐ。
   砂嵐は視界を奪い、雪は手をかじかませ、陽炎は理（火）を冴えさせる。

   効果（命中への加算。負は当てにくい）：
     hit    … すべての攻撃に効く一般の命中補正
     ranged … 間合い2以上（飛び道具・魔法）への追加補正
     bow    … 弓にだけ追加で効く補正
     anima  … 理（火）系の威力への加算（陽炎で増し、雨で減る）
   ============================================================ */

import { isMagicType } from './items.js';

export const WEATHER = {
  clear: { id: 'clear', name: '晴れ', sky: '#7fb0e0', hit: 0, ranged: 0, bow: 0, anima: 0,
    line: '空は晴れわたり、風は凪いでいる。' },
  rain: { id: 'rain', name: '雨', sky: '#5a6a78', hit: 0, ranged: -10, bow: -10, anima: -3,
    line: '雨が弦を湿らせ、火を弱める。矢は的をそれやすい。' },
  storm: { id: 'storm', name: '嵐', sky: '#3a4350', hit: -10, ranged: -20, bow: -15, anima: -5,
    line: '吹きすさぶ嵐。身は泳ぎ、遠き一矢はまるで届かぬ。' },
  fog: { id: 'fog', name: '霧', sky: '#8a929a', hit: -15, ranged: -10, bow: -10, anima: 0,
    line: '濃い霧が立ちこめ、敵の影さえ朧げだ。' },
  snow: { id: 'snow', name: '吹雪', sky: '#c2d2dc', hit: -5, ranged: -10, bow: -10, anima: 0,
    line: '吹雪が手をかじかませる。狙いは定まらぬ。' },
  sandstorm: { id: 'sandstorm', name: '砂嵐', sky: '#c8a85e', hit: -15, ranged: -15, bow: -15, anima: 0,
    line: '砂嵐が目を打ち、視界を奪う。' },
  haze: { id: 'haze', name: '陽炎', sky: '#d8a860', hit: -5, ranged: -5, bow: 0, anima: 3,
    line: '陽炎が揺らめく。熱に理（火）の魔が冴える。' },
};

export const WEATHER_LIST = Object.values(WEATHER);

export function weatherOf(id) {
  return WEATHER[id] || WEATHER.clear;
}

/* 地勢ごとの空模様の出やすさ（重み）。晴れがいちばん多い。 */
const BIOME_WEATHER = {
  green:   [['clear', 5], ['rain', 3], ['fog', 2], ['storm', 1]],
  desert:  [['clear', 4], ['sandstorm', 4], ['haze', 2]],
  ruins:   [['clear', 4], ['fog', 4], ['rain', 2]],
  snow:    [['snow', 5], ['fog', 2], ['clear', 2], ['storm', 1]],
  volcano: [['clear', 3], ['haze', 5], ['sandstorm', 1]],
};

/* 種と章から、その戦場の空を決める（決定的）。 */
export function weatherForChapter(seed, chapterIndex, biome = 'green') {
  const table = BIOME_WEATHER[biome] || BIOME_WEATHER.green;
  // 種と章だけから定まる小さなハッシュ（RNG に依らず純粋に）
  let h = ((seed >>> 0) ^ ((chapterIndex + 1) * 2654435761)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12;
  const total = table.reduce((s, [, w]) => s + w, 0);
  let r = h % total;
  for (const [id, w] of table) { if (r < w) return weatherOf(id); r -= w; }
  return weatherOf(table[0][0]);
}

const isRanged = w => (w && w.max > 1);

/* この武器・この空のもとでの命中補正（整数）。 */
export function weatherHitMod(weather, weapon) {
  const wx = (weather && weather.id) ? weather : weatherOf(weather);
  if (!weapon) return wx.hit;
  let d = wx.hit;
  if (isRanged(weapon)) d += wx.ranged;
  if (weapon.wtype === 'bow') d += wx.bow;
  return d;
}

/* この武器・この空のもとでの威力補正（整数）。理（火）系にだけ効く。 */
export function weatherMightMod(weather, weapon) {
  const wx = (weather && weather.id) ? weather : weatherOf(weather);
  if (!weapon || !isMagicType(weapon.wtype)) return 0;
  if (weapon.wtype === 'anima') return wx.anima;     // 理＝火・雷の魔。空に強く影響される
  return 0;
}
