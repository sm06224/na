/* ============================================================
   斑を、肌の色にする — けれど DOM もキャンバスも知らない。
   V（喰うものの濃さ）を、種で決めた二色のあいだに移す。
   薄い地は獣の地色（クリーム・砂・黄土）、濃い斑は獣の墨（黒・煤・錆）。
   本物の毛皮の色素になぞらえてある——黒褐の eumelanin と、黄赤の pheomelanin。
   この核は紙の上の数。UI はそれをキャンバスへ、CLI は端末へ写すだけ。
   ============================================================ */
import { RNG } from './rng.js';

// 地色（明・色素のうすい側）。獣の下地。
const GROUNDS = [
  [232, 214, 178], // クリーム
  [214, 180, 130], // 砂・黄土
  [222, 224, 228], // 灰白
  [236, 226, 206], // 生成り
  [205, 164, 120], // 麦
  [196, 206, 210], // 青灰
];
// 斑の色（暗・色素のこい側）。獣の墨。
const MARKS = [
  [38, 30, 26],    // 黒褐（eumelanin）
  [78, 48, 30],    // 焦茶・煤
  [120, 58, 30],   // 錆・栗
  [44, 52, 60],    // 鉄紺
  [92, 72, 44],    // セピア
  [150, 96, 40],   // 黄金褐
];

// 種から、地色と斑色の対をひとつ選ぶ（同じ種からは同じ毛色）。
export function makePalette(seed) {
  const rng = new RNG(seed).fork('palette');
  return { ground: rng.pick(GROUNDS), mark: rng.pick(MARKS) };
}

const smooth = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// V の濃さ（0..peak）→ 地色と斑色のあいだの色。
// しきい値あたりで少しきゅっと絞り、斑が斑として読めるようにする。
export function colorOf(palette, v, peak) {
  const x = peak > 0 ? v / peak : 0;
  const t = smooth((x - 0.30) / 0.40);   // 0.30 以下は地、0.70 以上は斑、間はなだらか
  const g = palette.ground, m = palette.mark;
  return [lerp(g[0], m[0], t) | 0, lerp(g[1], m[1], t) | 0, lerp(g[2], m[2], t) | 0];
}

// 場 + パレット → RGBA バッファ（Uint8ClampedArray, N*N*4）。
export function renderRGBA(F, palette) {
  const { N, V } = F;
  let peak = 0;
  for (let i = 0; i < N * N; i++) if (V[i] > peak) peak = V[i];
  const out = new Uint8ClampedArray(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const c = colorOf(palette, V[i], peak), o = i * 4;
    out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = 255;
  }
  return out;
}
