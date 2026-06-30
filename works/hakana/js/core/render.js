/* ============================================================
   膜を、絵にする — けれど DOM もキャンバスも知らない。
   ピクセルごとに厚みを読み、ゆるいドーム（曲率）で入射角を変え、
   干渉色の表を引いて、線形 sRGB のバッファを返す。
   この核は紙の上の数。UI はそれをキャンバスへ、CLI は端末へ写すだけ。
   ============================================================ */
import { thickness } from './flow.js';
import { sample, toByte } from './film.js';

// ドームの曲率：中心は正面（cosθ=1）、縁ほど浅く差し込む（虹が薄い次へずれる）。
function domeCos(x, y, curve) {
  const dx = (x - 0.5) * 2, dy = (y - 0.5) * 2, r2 = (dx * dx + dy * dy) * curve;
  return Math.sqrt(Math.max(0.12, 1 - Math.min(0.97, r2)));
}

// 厚み場 + 色階 → RGBA バッファ（Uint8ClampedArray, W*H*4）。
export function renderRGBA(film, scale, W, H, t, opts = {}) {
  const curve = opts.curve ?? 0.55, out = new Uint8ClampedArray(W * H * 4);
  for (let py = 0; py < H; py++) {
    const y = (py + 0.5) / H;
    for (let px = 0; px < W; px++) {
      const x = (px + 0.5) / W;
      const cos0 = domeCos(x, y, curve);
      const d = thickness(film, x, y, t) * cos0;   // 斜めに見るほど、光路は短い
      const b = toByte(sample(scale, d)), o = (py * W + px) * 4;
      out[o] = b[0]; out[o + 1] = b[1]; out[o + 2] = b[2]; out[o + 3] = 255;
    }
  }
  return out;
}

// その瞬間の膜の「いろどり」を測る（彩度の最大・黒い膜の割合）。
// 見えない目のための物差し：本物の虹なら彩度が立ち、薄い所に黒がのぞく。
export function vitality(film, scale, t, grid = 40) {
  let maxChroma = 0, black = 0, n = 0, lumSum = 0;
  for (let j = 0; j < grid; j++) for (let i = 0; i < grid; i++) {
    const x = (i + 0.5) / grid, y = (j + 0.5) / grid;
    const lin = sample(scale, thickness(film, x, y, t) * domeCos(x, y, 0.55));
    const mx = Math.max(lin[0], lin[1], lin[2]), mn = Math.min(lin[0], lin[1], lin[2]);
    const chroma = mx <= 0 ? 0 : (mx - mn) / mx;
    if (chroma > maxChroma) maxChroma = chroma;
    if (mx < 0.06) black++;
    lumSum += mx; n++;
  }
  return { maxChroma, blackFraction: black / n, meanLum: lumSum / n };
}
