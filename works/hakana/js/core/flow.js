/* ============================================================
   生きている膜 — 厚みは、とどまらない。
   重力で下へ落ち（上から薄くなる）、表面張力でならされ、
   マランゴニ対流でゆっくり渦を巻く。やがて上に「黒い膜」が口をあけ、
   膜は破れる支度をする。いちばん美しいのは、消える直前。
   種ひとつから決まる。同じ種からは、同じうつろい。依存ゼロ・DOM を知らない。
   ============================================================ */
import { RNG } from './rng.js';

// 種 → 膜の素性（いくつかの波の重ね合わせ・基準の厚み・水切れの速さ・傾き）。
export function makeFilm(seed, opts = {}) {
  const rng = new RNG(seed);
  // 薄い膜ほど、いちばん冴えた色（金・紅・青・緑）が出る。低次の色域で遊ぶ。
  const base = opts.base ?? rng.float(380, 560);   // 中ほどの厚み nm
  const waves = [];
  const K = opts.waves ?? 9, coarse = 6;            // 大きな渦 6 ＋ 細かなきらめき 3
  for (let i = 0; i < K; i++) {
    const fine = i >= coarse;
    const ang = rng.float(0, Math.PI * 2);
    const k = fine ? rng.float(9, 17) : rng.float(2, 7);
    waves.push({
      kx: Math.cos(ang) * k, ky: Math.sin(ang) * k,
      amp: fine ? rng.float(12, 34) : rng.float(70, 175) / (1 + i * 0.28),
      w: rng.float(-0.5, 0.5) * (1 + i * 0.18),      // ゆっくり位相が流れる
      phase: rng.float(0, Math.PI * 2),
      sx: rng.float(-0.18, 0.18), sy: rng.float(-0.04, 0.30), // 流される（おもに下へ）
    });
  }
  return {
    seed: rng.seed, base, waves,
    drain: opts.drain ?? rng.float(0.03, 0.055),     // 全体が薄くなる速さ（1/s）
    tilt: opts.tilt ?? rng.float(240, 430),          // 上ほど薄い量 nm（黒い膜は上から）
    swirl: opts.swirl ?? rng.float(0.85, 1.12),
    breaths: [],                                      // 息／指のあと（UI が足す）
  };
}

// 位置 (x,y)∈[0,1]、時刻 t(s) の厚み nm。上(y=0)ほど薄く、時とともに細る。
export function thickness(film, x, y, t) {
  let d = film.base - film.drain * film.base * t;     // 水切れ：全体がやせる
  d -= film.tilt * (1 - y) * (0.6 + 0.4 * film.drain * t * 6); // 上ほど薄く、時とともに強まる
  let sw = 0;
  for (const wv of film.waves) {
    const px = x + wv.sx * t, py = y + wv.sy * t;     // 流される座標（マランゴニ）
    sw += wv.amp * Math.sin(wv.kx * px + wv.ky * py + wv.w * t + wv.phase);
  }
  d += sw * film.swirl;
  // 息・指のあと：そこだけ膜が寄って厚くなり、虹がにじむ。
  for (const b of film.breaths) {
    const dx = x - b.x, dy = y - b.y, r2 = dx * dx + dy * dy;
    d += b.amp * Math.exp(-r2 / (2 * b.s * b.s));
  }
  return d < 0 ? 0 : d;                                // 0 で黒い膜（破れの予兆）
}

// 平均の厚み（格子で標本）。水切れの監視に。
export function meanThickness(film, t, grid = 16) {
  let s = 0, c = 0;
  for (let j = 0; j < grid; j++) for (let i = 0; i < grid; i++) {
    s += thickness(film, (i + 0.5) / grid, (j + 0.5) / grid, t); c++;
  }
  return s / c;
}

// 黒い膜（厚み≈0）の割合。これが増えるほど、破れが近い。
export function blackFraction(film, t, thresh = 30, grid = 24) {
  let n = 0, c = 0;
  for (let j = 0; j < grid; j++) for (let i = 0; i < grid; i++) {
    if (thickness(film, (i + 0.5) / grid, (j + 0.5) / grid, t) <= thresh) n++; c++;
  }
  return n / c;
}

// 上半分と下半分の平均の厚みの差（上ほど薄い、を確かめるための窓）。
export function topBottom(film, t, grid = 16) {
  let top = 0, bot = 0, n = 0;
  for (let j = 0; j < grid; j++) for (let i = 0; i < grid; i++) {
    const y = (j + 0.5) / grid, d = thickness(film, (i + 0.5) / grid, y, t);
    if (y < 0.5) top += d; else bot += d; n++;
  }
  return { top: top / (n / 2), bottom: bot / (n / 2) };
}

// 息を吹きかける／指でなでる。その場の膜を寄せる（UI から）。
export function breathe(film, x, y, amp = 220, s = 0.09) {
  film.breaths.push({ x, y, amp, s, born: 0 });
  if (film.breaths.length > 24) film.breaths.shift();
}
