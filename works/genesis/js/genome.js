import { clamp } from './util.js';

/* ============================================================
   遺伝子 — 生き物の設計図。
   体の形質（スカラー遺伝子）と、脳の重み（ベクトル遺伝子）からなる。
   親から子へ、すこしずつ写し間違えられながら受け継がれる。
   ============================================================ */

export const BRAIN = {
  RAYS: 5,                       // 視覚レイの本数
  INPUTS: 5 * 3 + 2,             // レイ×{植物,獲物,脅威} + 自エネルギー + 自速度
  HIDDEN: 10,
  OUTPUTS: 2,                    // 旋回, 推進
};
BRAIN.WEIGHTS =
  BRAIN.HIDDEN * BRAIN.INPUTS + BRAIN.HIDDEN +
  BRAIN.OUTPUTS * BRAIN.HIDDEN + BRAIN.OUTPUTS;

/* スカラー遺伝子の定義域 */
export const GENE_RANGES = {
  hue:     [0, 360],     // 体色（種の見た目の系統を生む）
  size:    [0.65, 1.9],  // 体の大きさ：大きいほど強いが燃費が悪い
  speed:   [0.5, 1.7],   // 速さ：速いほど燃費が悪い
  vision:  [60, 260],    // 視程：遠くまで見えるほど脳のコストが増す
  fov:     [1.2, 4.6],   // 視野角（ラジアン）
  diet:    [0, 1],       // 食性：0=草食 … 1=肉食
  mutRate: [0.02, 0.25], // 変異率そのものも進化する
};

export function randomGenome(rng) {
  const g = {};
  for (const [k, [lo, hi]] of Object.entries(GENE_RANGES)) {
    g[k] = rng.float(lo, hi);
  }
  // 初期世界は草食寄りから始める（いきなり共食いだと立ち上がらない）
  g.diet = rng.float(0, 0.35);
  g.weights = new Array(BRAIN.WEIGHTS);
  for (let i = 0; i < BRAIN.WEIGHTS; i++) g.weights[i] = rng.gauss(0, 0.6);
  return g;
}

/* 写し間違い。mutRate 自体も変異するので、変異しやすい家系・
   保守的な家系という「進化のしかたの進化」が起こる。 */
export function mutate(parent, rng) {
  const g = { weights: parent.weights.slice() };
  const m = parent.mutRate;
  for (const [k, [lo, hi]] of Object.entries(GENE_RANGES)) {
    let v = parent[k];
    if (rng.chance(0.55)) v += rng.gauss(0, (hi - lo) * 0.045 * (0.5 + m * 3));
    // ごく稀な跳躍変異（新しい生態的地位への賭け）
    if (rng.chance(0.012)) v = rng.float(lo, hi);
    // 色相だけは円環（360 と 0 はつながっている）
    g[k] = (k === 'hue') ? ((v % 360) + 360) % 360 : clamp(v, lo, hi);
  }
  for (let i = 0; i < g.weights.length; i++) {
    if (rng.chance(0.18)) g.weights[i] += rng.gauss(0, m * 1.4);
    if (rng.chance(0.004)) g.weights[i] = rng.gauss(0, 0.8);
  }
  return g;
}

/* 遺伝距離 — 種分化の判定に使う。体の形質と脳の前半部の差を合成。 */
export function geneticDistance(a, b) {
  let d = 0;
  for (const [k, [lo, hi]] of Object.entries(GENE_RANGES)) {
    if (k === 'hue') {
      let dh = Math.abs(a.hue - b.hue) % 360;
      if (dh > 180) dh = 360 - dh;
      d += (dh / 180) * 0.8;
    } else {
      d += Math.abs(a[k] - b[k]) / (hi - lo);
    }
  }
  let wd = 0;
  const n = Math.min(48, a.weights.length);
  for (let i = 0; i < n; i++) wd += Math.abs(a.weights[i] - b.weights[i]);
  d += (wd / n) * 0.9;
  return d;
}

/* 種の名前 — 音節から生まれる固有名。世界に固有名詞があると歴史になる。 */
const SYL = ['ka','ki','ku','ke','ko','sa','shi','su','se','so','ta','chi','tsu','te','to',
  'na','ni','nu','ne','no','ha','hi','fu','he','ho','ma','mi','mu','me','mo',
  'ya','yu','yo','ra','ri','ru','re','ro','wa','n'];
export function speciesName(rng) {
  const n = 2 + rng.int(2);
  let s = '';
  for (let i = 0; i < n; i++) s += SYL[rng.int(SYL.length)];
  return s.charAt(0).toUpperCase() + s.slice(1);
}
