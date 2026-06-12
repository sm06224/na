import { mulberry32 } from './rng.js';

/* ============================================================
   値ノイズ + fBm — 大陸と気候の素地。依存なし、種から決定的。
   ============================================================ */
export function makeNoise2D(seed) {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (rand() * (i + 1)) | 0;
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  // 格子点の値（0..1）
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) vals[i] = rand();

  const fade = t => t * t * (3 - 2 * t);
  const at = (X, Y) => vals[perm[(perm[X & 255] + Y) & 255]];

  return function noise(x, y) {
    const X = Math.floor(x), Y = Math.floor(y);
    const fx = x - X, fy = y - Y;
    const u = fade(fx), v = fade(fy);
    const a = at(X, Y), b = at(X + 1, Y);
    const c = at(X, Y + 1), d = at(X + 1, Y + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; // 0..1
  };
}

/* fractional Brownian motion — 重ねるほど大陸は複雑になる */
export function makeFBM(seed, octaves = 5, lacunarity = 2, gain = 0.5) {
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push(makeNoise2D(seed + o * 1013));
  return function fbm(x, y) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += layers[o](x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain; freq *= lacunarity;
    }
    return sum / norm; // 0..1
  };
}
