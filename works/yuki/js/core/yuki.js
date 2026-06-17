/* ============================================================
   雪 — yuki. 種ひとつから、空の手紙を一片おろす。

   結晶は誰も描いていない。種が選んだ「その日の空」——温度と
   過飽和度（湿り気）——のもとで、ライター(Clifford Reiter, 2005)の
   六方格子セルオートマトンがほどけるだけ。水蒸気は拡散し、結晶の
   ふちで凍りつき、凍ったふちはさらに蒸気を呼ぶ。雨の年が崖の縞を
   決めたように、ここでは空の温度と湿りが、角板にも樹枝にも羊歯にも
   分かれる「晶癖」を決める（中谷宇吉郎の結晶分類図）。

   規則は等方で、種は中央にひとつ。だから生まれる華は、おのずと
   六回対称になる（このコードは六方の和を整列してから足すので、
   その対称はビット単位で厳密に保たれる——テストが見張っている）。

       「雪は天から送られた手紙である。」 ——中谷宇吉郎

   ——依存ゼロ・副作用なし。同じ種なら、何度でも同じひとひら。
   ============================================================ */

export const NAKAYA = '雪は天から送られた手紙である。 ——中谷宇吉郎';

/* ---- 種から決定的な擬似乱数（mulberry32） ---- */
export function hashSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  const s = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export function mulberry32(a) {
  a >>>= 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================================================
   六方格子。立方座標 (x,y,z) で z=-x-y。中心からの距離が
   半径 R 以下の六角形を一枚もつ。六方向の隣り、60°回転、鏡映は
   どれもこの六角形を自分自身へ写す——対称性の試金石になる。
   ============================================================ */
const DIRS = [
  [+1, -1, 0], [+1, 0, -1], [0, +1, -1],
  [-1, +1, 0], [-1, 0, +1], [0, -1, +1],
];
/* 60°回転：(x,y,z) -> (-z,-x,-y)。鏡映：(x,y,z) -> (x,z,y)。
   （+0 を足して -0 を正の 0 にそろえる——座標を素直に比べられるように。） */
export function rot60(x, y) { const z = -x - y; return [-z + 0, -x + 0]; }   // 返すのは [x', y']
export function mirror(x, y) { const z = -x - y; return [x + 0, z + 0]; }    // y' = z
export function hexDist(x, y) { const z = -x - y; return (Math.abs(x) + Math.abs(y) + Math.abs(z)) / 2; }

/* 半径 R の六角形を、座標→添字の対応とともに組む。 */
function buildGrid(R) {
  const xs = [], ys = [], idx = new Map();
  for (let x = -R; x <= R; x++) {
    const lo = Math.max(-R, -x - R), hi = Math.min(R, -x + R);
    for (let y = lo; y <= hi; y++) { idx.set(x + ',' + y, xs.length); xs.push(x); ys.push(y); }
  }
  const N = xs.length;
  const center = idx.get('0,0');
  const dist = new Float64Array(N);
  const nbr = new Int32Array(N * 6).fill(-1);            // -1 は外（無限の蒸気だまり）
  for (let i = 0; i < N; i++) {
    dist[i] = hexDist(xs[i], ys[i]);
    for (let k = 0; k < 6; k++) {
      const nx = xs[i] + DIRS[k][0], ny = ys[i] + DIRS[k][1];
      const j = idx.get(nx + ',' + ny);
      if (j !== undefined) nbr[i * 6 + k] = j;
    }
  }
  return { R, N, xs, ys, idx, center, dist, nbr };
}

/* 六つの値を、添字の順番によらず同じ和にするための整列（挿入ソート）。
   対称な升どうしは隣りの値が同じ多重集合になる。整列して足せば、
   浮動小数の足し算の順番まで一致し、六回対称がビット単位で保たれる。 */
function sort6(a) {
  for (let i = 1; i < 6; i++) {
    const v = a[i]; let j = i - 1;
    while (j >= 0 && a[j] > v) { a[j + 1] = a[j]; j--; }
    a[j + 1] = v;
  }
}

/* ============================================================
   weather — 種から「その日の空」を読む。温度と過飽和度（湿り気）。
   中谷の図にならい、温度が晶癖の系統を、湿りが枝の繁りを決める。
     temp:  ℃（およそ -28..-2）
     humid: 過飽和度 0..1（高いほど枝が伸びる）
   ============================================================ */
export function weather(seed) {
  const rng = mulberry32(hashSeed(seed) ^ 0x59554b49);   // 'YUKI'
  const temp = -2 - 26 * rng();                          // -28..-2 ℃
  const humid = 0.18 + 0.8 * rng();                      // 0.18..0.98
  return { temp, humid: Math.min(1, humid) };
}

/* 空（温度・湿り）から、結晶を育てる規則のつまみへ。
   中谷の図にならい、-15℃あたりが最も樹枝・羊歯に走り、そこから離れると
   角板へまとまる。湿りが高いほど枝は深く繁る。枝の繁り branch(0..1) を
   ライターのつまみへ写す——蒸気だまり beta と凍るふちへの足し gamma を
   薄くするほど、結晶は満たされず枝へと走る（実測で較正）。
   （-5℃ 帯の針・角柱は立体の結晶。真上から見るこの世界は、平らに
   開く華——角板・星・樹枝・羊歯——だけを育てる。） */
export function paramsFor(w) {
  const dendriteZone = Math.exp(-((w.temp + 15) ** 2) / (2 * 6 * 6));   // -15℃で1
  const branch = Math.max(0, Math.min(1,
    (0.15 + 0.85 * w.humid) * (0.4 + 0.6 * dendriteZone)));
  return {
    alpha: 1.0 + 0.4 * branch,                 // 拡散の速さ
    beta: 0.95 - 0.33 * branch,                // まわりの蒸気（高いほど満ちて角板）
    gamma: Math.max(0.0008, 0.012 - 0.0112 * branch),  // 凍るふちへの蒸気の足し
    branch, dendriteZone,
  };
}

/* ============================================================
   grow — 雪をひとひら育てる。返すのは結晶の盤面（DOM 非依存）。
     grow(seed, { R, steps, params })
   params を渡せば空を介さず規則を直接固定できる（テスト用）。
   返り値:
     { R, N, xs, ys, dist, idx, s, frozen, frozenAt, count, maxR,
       steps, params, weather }
   s[i]      : その升の水の量（>=1 で結晶）
   frozen[i] : 1 なら結晶
   frozenAt[i]: 初めて凍った歩（-1 はまだ）
   ============================================================ */
export function grow(seed, opts = {}) {
  const w = opts.weather || weather(seed);
  const P = opts.params || paramsFor(w);
  const { alpha, beta, gamma } = P;
  const R = opts.R | 0 || 64;
  const maxSteps = opts.steps | 0 || 4000;

  const G = buildGrid(R);
  const { N, nbr, dist, center } = G;
  const s = new Float64Array(N).fill(beta);
  const u = new Float64Array(N);
  const v = new Float64Array(N);
  const recep = new Uint8Array(N);
  const frozenAt = new Int32Array(N).fill(-1);
  s[center] = 1; frozenAt[center] = 0;

  const half = alpha / 2;
  const scratch = new Float64Array(6);
  let maxR = 0, step = 0;

  for (step = 1; step <= maxSteps; step++) {
    // 受容（結晶か、結晶に隣りする升）を決める
    for (let i = 0; i < N; i++) {
      let r = s[i] >= 1;
      if (!r) for (let k = 0; k < 6; k++) { const j = nbr[i * 6 + k]; if (j >= 0 && s[j] >= 1) { r = true; break; } }
      recep[i] = r ? 1 : 0;
    }
    // 拡散する水 u と、しない水 v に分け、受容升へ蒸気 γ を足す
    for (let i = 0; i < N; i++) {
      if (recep[i]) { v[i] = s[i] + gamma; u[i] = 0; }
      else { u[i] = s[i]; v[i] = 0; }
    }
    // 拡散：隣り六つの平均へ近づく。外は蒸気だまり beta。整列して厳密に対称。
    let grewTo = 0;
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < 6; k++) { const j = nbr[i * 6 + k]; scratch[k] = j >= 0 ? u[j] : beta; }
      sort6(scratch);
      const avg = (scratch[0] + scratch[1] + scratch[2] + scratch[3] + scratch[4] + scratch[5]) / 6;
      const un = u[i] + half * (avg - u[i]);
      const sv = un + v[i];
      s[i] = sv;
      if (sv >= 1 && frozenAt[i] < 0) { frozenAt[i] = step; if (dist[i] > grewTo) grewTo = dist[i]; }
    }
    if (grewTo > maxR) maxR = grewTo;
    if (maxR >= R - 2) break;                  // ふちに届く前に止める（蒸気だまりを保つ）
  }

  const frozen = new Uint8Array(N);
  let count = 0;
  for (let i = 0; i < N; i++) { if (s[i] >= 1) { frozen[i] = 1; count++; } }

  return {
    R, N, xs: G.xs, ys: G.ys, dist, idx: G.idx,
    s, frozen, frozenAt, count, maxR, steps: step, params: P, weather: w,
  };
}

/* 結晶の升だけを、座標と量つきで取り出す（描画・読み取り用）。 */
export function frozenCells(cr) {
  const out = [];
  for (let i = 0; i < cr.N; i++) if (cr.frozen[i]) out.push({ x: cr.xs[i], y: cr.ys[i], s: cr.s[i], at: cr.frozenAt[i], d: cr.dist[i] });
  return out;
}
export function valueAt(cr, x, y) { const i = cr.idx.get(x + ',' + y); return i === undefined ? 0 : cr.s[i]; }
export function isFrozen(cr, x, y) { return valueAt(cr, x, y) >= 1; }

/* ============================================================
   habit — 「晶癖」。中谷の図がいうように、晶癖を決めるのは空——
   温度と湿り——であって、結晶はその手で書かれる手蹟にすぎない。
   だから晶癖は、空から導いた「枝の繁り」branch から読む（結晶の
   filigree そのものは、その同じ規則が画面に描く）。
   平らに開く華の五段：角板→扇板→星形→樹枝→羊歯状。
   （実形の充填率 fill は参考として fillRatio で取り出せる。） ============================================================ */
export const HABITS = ['plate', 'sector', 'stellar', 'dendrite', 'fern'];
const HABIT_JA = {
  plate: '角板', sector: '扇板', stellar: '星形', dendrite: '樹枝', fern: '羊歯状',
};
export function habitJa(h) { return HABIT_JA[h] || h; }

export function fillRatio(cr) {
  const R = Math.max(1, cr.maxR);
  return cr.count / (3 * R * R + 3 * R + 1);   // 半径 R の角板に対する充填率
}
export function habit(cr) {
  const b = cr.params?.branch ?? paramsFor(cr.weather || weather('')).branch;
  if (b < 0.18) return 'plate';
  if (b < 0.34) return 'sector';
  if (b < 0.52) return 'stellar';
  if (b < 0.74) return 'dendrite';
  return 'fern';
}

/* ============================================================
   name / mei — ひとりでに名のる。銘は種ごとの決定的な指紋。
   ============================================================ */
const ON = ['shi', 'ra', 'yu', 'ki', 'mu', 'ka', 'se', 'na', 'ho', 'to', 'wa', 'mi', 'ne', 'ru', 'ko', 'a'];
export function crystalName(seed) {
  const rng = mulberry32(hashSeed(seed) ^ 0x6e616d65);   // 'name'
  const n = 2 + (rng() < 0.5 ? 1 : 0);
  let s = '';
  for (let i = 0; i < n; i++) s += ON[(rng() * ON.length) | 0];
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function mei(seed) {
  // 種を SHA 風に潰さず、軽い指紋（24bit）を六進めいた六片の銘に。
  let h = hashSeed(seed) ^ 0x6d656900;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
  return '❄' + (h >>> 8).toString(16).padStart(6, '0');
}

/* ============================================================
   letter — 「空からの手紙」。温度・湿り・晶癖から、決定的に綴る。
   語彙はここに尽きる（テストが見張る）。
   ============================================================ */
function coldWord(t) {
  if (t > -8) return 'しんしんと冷えた';
  if (t > -14) return 'よく晴れて凍てつく';
  if (t > -20) return '骨まで凍る';
  return '声も凍る底冷えの';
}
function wetWord(h) {
  if (h < 0.42) return '乾いた';
  if (h < 0.72) return 'しっとり湿った';
  return '水気にあふれた';
}
const HABIT_LINE = {
  plate: 'ためらわず六辺をのばし、すきのない角板になった。',
  sector: '六枚の扇を開くように、面を残して角を張った。',
  stellar: '六方へ星の腕をのばし、淡い面を残した。',
  dendrite: '六本の幹からいくつもの小枝を吹いて、樹枝の華になった。',
  fern: '羊歯のように小枝が小枝を生み、際限なく繁った。',
};
export function letter(seed, cr) {
  const w = cr.weather || weather(seed);
  const h = habit(cr);
  return `${coldWord(w.temp)}空、${wetWord(w.humid)}日に生まれた。${HABIT_LINE[h]}`;
}

/* まとめ：種ひとつから、ひとひらの素性をすべて返す（テスト・UI 用）。 */
export function summary(seed, opts = {}) {
  const cr = grow(seed, opts);
  return {
    name: crystalName(seed), mei: mei(seed), habit: habit(cr),
    habitJa: habitJa(habit(cr)), temp: cr.weather.temp, humid: cr.weather.humid,
    count: cr.count, maxR: cr.maxR, letter: letter(seed, cr), crystal: cr,
  };
}
