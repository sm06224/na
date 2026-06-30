/* ============================================================
   光のいろ — スペクトルを、人の目の色にする。
   ここには絵の具がない。あるのは波長と、目の感度だけ。
   反射スペクトル R(λ) を、CIE 1931 等色関数で XYZ に積み、
   D65 の白のもとで sRGB に落とす。色は、計算で生まれる。
   ============================================================ */

// CIE 1931 等色関数の解析近似（Wyman, Sloan & Shirley, JCGT 2013, 多ローブ Gauss）。
// 表を持たずに、x̄ ȳ z̄ を数式だけで再現する。λ は nm。
function lobe(x, mu, s1, s2) {
  const t = (x - mu) / (x < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
}
export function xbar(l) {
  return 1.056 * lobe(l, 599.8, 37.9, 31.0)
       + 0.362 * lobe(l, 442.0, 16.0, 26.7)
       - 0.065 * lobe(l, 501.1, 20.4, 26.2);
}
export function ybar(l) {
  return 0.821 * lobe(l, 568.8, 46.9, 40.5)
       + 0.286 * lobe(l, 530.9, 16.3, 31.1);
}
export function zbar(l) {
  return 1.217 * lobe(l, 437.0, 11.8, 36.0)
       + 0.681 * lobe(l, 459.0, 26.0, 13.8);
}

// 標準昼光 D65 の相対分光分布（10nm, 380–730）。白の手本。
const D65_380_730_10 = [
  49.98, 54.65, 82.75, 91.49, 93.43, 86.68, 104.86, 117.01, 117.81, 114.86,
  115.92, 108.81, 109.35, 107.80, 104.79, 107.69, 104.41, 104.05, 100.00, 96.33,
  95.79, 88.69, 90.01, 89.60, 87.70, 83.29, 83.70, 80.03, 80.21, 82.28,
  78.28, 69.72, 71.61, 74.35, 61.60, 69.89,
];
export const LAMBDA0 = 380, LAMBDA1 = 730, DLAMBDA = 10;
export const LAMBDAS = D65_380_730_10.map((_, i) => LAMBDA0 + i * DLAMBDA);

// 白（R=1）が D65 白点 Y=1 になるよう正規化した重み S(λ)·ȳ(λ) の総和。
const YN = LAMBDAS.reduce((a, l, i) => a + D65_380_730_10[i] * ybar(l), 0);

// 反射スペクトル R(λ)（関数）→ CIE XYZ（白点 D65、白で Y=1）。
export function spectrumToXYZ(R) {
  let X = 0, Y = 0, Z = 0;
  for (let i = 0; i < LAMBDAS.length; i++) {
    const l = LAMBDAS[i], w = D65_380_730_10[i] * R(l);
    X += w * xbar(l); Y += w * ybar(l); Z += w * zbar(l);
  }
  return [X / YN, Y / YN, Z / YN];
}

// XYZ(D65) → 線形 sRGB。負は外れ色（人の色域の外）→ 0 に丸める。
export function xyzToLinearSRGB(X, Y, Z) {
  let r =  3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b =  0.0557 * X - 0.2040 * Y + 1.0570 * Z;
  return [Math.max(0, r), Math.max(0, g), Math.max(0, b)];
}

// 線形 → sRGB のガンマ（0..1）。
export function gamma(c) {
  c = Math.min(1, Math.max(0, c));
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// 線形 sRGB を、色相を保ったまま 0..1 に収める（最大が 1 を超えたら一様に縮める）。
export function clampLinear(rgb) {
  const m = Math.max(rgb[0], rgb[1], rgb[2]);
  if (m > 1) return [rgb[0] / m, rgb[1] / m, rgb[2] / m];
  return rgb;
}
