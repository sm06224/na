/* ============================================================
   斑 のこころ臓 — 反応拡散（Gray–Scott）。
   チューリングが最後の論文で問うた「一様な卵が、どうして豹の斑になるのか」。
   答えは、ふたつの物質が追いかけあうだけ。
     U（餌）はどこにでもあり、補充される。
     V（喰うもの）は U をふたつ喰って自分をふやす（U + 2V → 3V）。
   それぞれ別の速さで滲み（拡散し）、V は一定の率で枯れる（kill）。
   この四則だけで、地に斑・縞・迷路・孔が、ひとりでに浮かぶ。
   ここは紙の上の数。DOM もキャンバスもネットも知らない。
   ============================================================ */
import { RNG } from './rng.js';

// 拡散率・刻み幅は固定（Karl Sims の値）。U は V の倍の速さで滲む。
export const Du = 0.16, Dv = 0.08, DT = 1.0;

/* バイオーム＝(f,k) の住みごこちのよい土地。
   位相空間の大半は「死（一様）」か「飽和」だが、この帯だけが生きて模様を結ぶ。
   種はまずどの土地に生まれるかを選び、そのまわりに少しだけ揺らぐ。
   分類はあとで「実際に浮かんだ形」から正直に測る（ここは産声の地でしかない）。 */
export const BIOMES = [
  { key: 'spots',   f: 0.0280, k: 0.0625, jf: 0.0025, jk: 0.0008 }, // 孤立した粒 → 斑（はん）
  { key: 'spots',   f: 0.0300, k: 0.0630, jf: 0.0020, jk: 0.0006 }, // 分裂する粒（有糸分裂）
  { key: 'stripes', f: 0.0390, k: 0.0620, jf: 0.0025, jk: 0.0006 }, // のびる帯 → 縞
  { key: 'maze',    f: 0.0300, k: 0.0575, jf: 0.0020, jk: 0.0006 }, // つながる迷路（脳珊瑚）
  { key: 'maze',    f: 0.0340, k: 0.0590, jf: 0.0020, jk: 0.0006 }, // うねる網（コーラル）
  { key: 'holes',   f: 0.0460, k: 0.0600, jf: 0.0025, jk: 0.0006 }, // 地が満ち、孔があく
];

// 種 → (f,k) と生まれた土地。
export function biomeOf(seed) {
  const rng = new RNG(seed).fork('biome');
  const b = BIOMES[rng.int(BIOMES.length)];
  const f = b.f + rng.float(-1, 1) * b.jf;
  const k = b.k + rng.float(-1, 1) * b.jk;
  return { biome: b.key, f, k };
}

/* 場をこしらえる。
   はじまりは無地——U=1, V=0 の一様な地。
   そこへ種が、いくつかの斑点（V の種火）をぽつぽつと置く。
   無地＋ひと粒の擾乱から、やがて肌いちめんの模様になる。 */
export function makeField(seed, opts = {}) {
  const N = opts.N ?? 96;
  const { biome, f, k } = biomeOf(seed);
  const rng = new RNG(seed).fork('field');
  const U = new Float32Array(N * N);
  const V = new Float32Array(N * N);
  // かすかな素地のゆらぎ（対称を破り、模様に個性を与える。けれど種で決まる）。
  for (let i = 0; i < N * N; i++) { U[i] = 1 - rng.float(0, 0.02); V[i] = rng.float(0, 0.02); }
  // V の種火を肌いちめんに散らす（数・位置・大きさは種で決まる）。
  // ひとつの火から広がるのを待たず、全面でいっせいに模様が立つように。
  const seeds = 40 + rng.int(40);
  for (let s = 0; s < seeds; s++) {
    const cx = rng.int(N), cy = rng.int(N), r = 1 + rng.int(3);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue;
      const x = (cx + dx + N) % N, y = (cy + dy + N) % N, idx = y * N + x;
      U[idx] = 0.5; V[idx] = 0.25;
    }
  }
  return { N, U, V, f, k, Du, Dv, dt: DT, biome, seed, step: 0,
           _u: new Float32Array(N * N), _v: new Float32Array(N * N) };
}

/* トーラス（上下左右が地続き）の 9 点ラプラシアン。
   中心 -1、辺 0.2、角 0.05 ——重みの総和は 0（一様な地は滲んでも一様）。 */
export function laplacian(arr, N, x, y) {
  const xm = (x - 1 + N) % N, xp = (x + 1) % N, ym = (y - 1 + N) % N, yp = (y + 1) % N;
  const c = arr[y * N + x];
  const e = arr[y * N + xm] + arr[y * N + xp] + arr[ym * N + x] + arr[yp * N + x];
  const d = arr[ym * N + xm] + arr[ym * N + xp] + arr[yp * N + xm] + arr[yp * N + xp];
  return 0.2 * e + 0.05 * d - c;
}

// ひと刻み進める。新しい場を裏のバッファに書き、表と入れ替える。
export function step(F) {
  const { N, U, V, f, k, Du, Dv, dt } = F;
  const nu = F._u, nv = F._v;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x, u = U[i], v = V[i];
      const lu = laplacian(U, N, x, y), lv = laplacian(V, N, x, y);
      const uvv = u * v * v;
      let un = u + (Du * lu - uvv + f * (1 - u)) * dt;
      let vn = v + (Dv * lv + uvv - (f + k) * v) * dt;
      // 数のほつれ止め（理論上は不要だが、念のため地を [0,1] に留める）。
      nu[i] = un < 0 ? 0 : un > 1 ? 1 : un;
      nv[i] = vn < 0 ? 0 : vn > 1 ? 1 : vn;
    }
  }
  F.U = nu; F.V = nv; F._u = U; F._v = V; F.step++;
  return F;
}

// 何刻みか一気に進める。
export function advance(F, steps) { for (let s = 0; s < steps; s++) step(F); return F; }

// 種から、刻みを与えて、できあがった肌を返す（CLI・テストの入口）。
export function grow(seed, steps = 4000, opts = {}) {
  const F = makeField(seed, opts);
  advance(F, steps);
  return F;
}
