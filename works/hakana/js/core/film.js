/* ============================================================
   薄膜の干渉 — シャボン玉や油膜が虹いろに見える、本当の理由。
   膜の表と裏で跳ね返った光が重なり、波長ごとに強めあい／弱めあう。
   膜が薄いほど、ある色が消え、ある色が際立つ。色は厚みの言葉。
   ここでは Fresnel 係数と Airy の総和で反射スペクトル R(λ) を出し、
   spectrum.js に渡して「目に映る色」へ翻訳する。
   厚み 0 で真っ黒になる——破れる直前の「黒い膜」まで、物理から出る。
   ============================================================ */
import { LAMBDAS, spectrumToXYZ, xyzToLinearSRGB, gamma, clampLinear } from './spectrum.js';

// 水の屈折率（Cauchy 分散）。青いほどわずかに強く曲がる＝色が割れる。
export function nWater(lambda) { return 1.324 + 3046 / (lambda * lambda); }

// 振幅反射係数（s/p）を境界で。n_i cosθ_i から Fresnel。
function fresnel(ni, nt, ci, ct) {
  const rs = (ni * ci - nt * ct) / (ni * ci + nt * ct);
  const rp = (nt * ci - ni * ct) / (nt * ci + ni * ct);
  return [rs, rp];
}

// 空気 / 膜(n1) / 媒質(n2) の薄膜。厚み d(nm)、入射角の cosθ0、波長 λ(nm)。
// 無偏光の反射率 R(λ) を返す（0..1）。
export function reflectance(d, cos0, lambda, opts = {}) {
  const n0 = opts.n0 ?? 1.0;                       // 上の媒質（空気）
  const n1 = opts.n1 ?? nWater(lambda);            // 膜（水石鹸）。分散あり
  const n2 = opts.n2 ?? 1.0;                        // 下の媒質（既定は空気＝自由なシャボン膜）
  const s0 = Math.sqrt(Math.max(0, 1 - cos0 * cos0));
  const s1 = (n0 / n1) * s0, c1 = Math.sqrt(Math.max(0, 1 - s1 * s1));
  const s2 = (n0 / n2) * s0, c2 = Math.sqrt(Math.max(0, 1 - s2 * s2));
  const [r01s, r01p] = fresnel(n0, n1, cos0, c1);
  const [r12s, r12p] = fresnel(n1, n2, c1, c2);
  const beta = 2 * Math.PI * n1 * d * c1 / lambda;  // 片道の位相
  const cb = Math.cos(-2 * beta), sb = Math.sin(-2 * beta);
  // Airy: r = (r01 + r12 e^{-2iβ}) / (1 + r01 r12 e^{-2iβ})。|r|^2 を s,p で平均。
  const airy = (r01, r12) => {
    const nr = r01 + r12 * cb, ni = r12 * sb;        // 分子（実,虚）
    const dr = 1 + r01 * r12 * cb, di = r01 * r12 * sb; // 分母（実,虚）
    const den = dr * dr + di * di;
    const Rr = (nr * dr + ni * di) / den, Ri = (ni * dr - nr * di) / den;
    return Rr * Rr + Ri * Ri;
  };
  return 0.5 * (airy(r01s, r12s) + airy(r01p, r12p));
}

// 膜の厚み d → 目に映る色（線形 sRGB, 0..1）。
// gain は反射のわずかな光（数%）を、見える明るさに持ち上げる露出。
export function colorOfThickness(d, opts = {}) {
  const cos0 = opts.cos0 ?? 1.0, gain = opts.gain ?? 22;
  const xyz = spectrumToXYZ((l) => reflectance(d, cos0, l, opts));
  let lin = xyzToLinearSRGB(xyz[0] * gain, xyz[1] * gain, xyz[2] * gain);
  return clampLinear(lin);
}

/* 干渉色の早見表（Newton／Michel-Lévy の色階）。
   厚み 0..maxD(nm) を step(nm) で刻み、各厚みの線形 sRGB を持つ。
   毎フレーム・毎ピクセルでスペクトル積分をやり直さないための、ただ一度の表。
   厚みは膜のことば。表を引けば、色がかえる。 */
export function buildScale(opts = {}) {
  const maxD = opts.maxD ?? 1500, step = opts.step ?? 2;
  const n = Math.floor(maxD / step) + 1;
  const lin = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const c = colorOfThickness(i * step, opts);
    lin[i * 3] = c[0]; lin[i * 3 + 1] = c[1]; lin[i * 3 + 2] = c[2];
  }
  return { lin, n, step, maxD };
}

// 表を引く（厚み d nm → 線形 sRGB）。表の外は端で止める。線形補間。
export function sample(scale, d) {
  const x = d / scale.step;
  let i = Math.floor(x);
  if (i < 0) i = 0; if (i >= scale.n - 1) i = scale.n - 2;
  const f = Math.min(1, Math.max(0, x - i)), g = 1 - f, b = i * 3, b2 = b + 3, L = scale.lin;
  return [g * L[b] + f * L[b2], g * L[b + 1] + f * L[b2 + 1], g * L[b + 2] + f * L[b2 + 2]];
}

// 線形 sRGB → 8bit（ガンマ込み）。
export function toByte(lin) {
  return [Math.round(gamma(lin[0]) * 255), Math.round(gamma(lin[1]) * 255), Math.round(gamma(lin[2]) * 255)];
}
