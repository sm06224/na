/* ============================================================
   響 — hibiki. 無から生まれる、響き。

   種ひとつから、共鳴する物体を鋳る。青銅の鐘・うたう鉢・硝子・
   木・石・銅鑼——材質が倍音の非調和性と減衰を、寸法が音高を決める。
   音は誰も録っていない。叩かれた物体は、減衰する正弦波の重ね合わせ
   として鳴るだけ——モーダル合成、源は物理そのもの。
   y(t) = Σ aᵢ · e^(−dᵢt) · sin(2π fᵢ t)
   金は永く澄んで鳴り、木と石は短く沈む。鐘には短三度の唸りがあり、
   銅鑼は密な非調和でゆらめく。誰も音色を描いていない。

   音高はすべて五音音階に量子化される——半音のぶつかりが無いので、
   どの物が同時に鳴っても濁らない（この約束はテストが守る）。
   ——依存ゼロ・Web Audio も知らない。同じ種なら、何度でも同じ響き。
   ============================================================ */

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
   音階。半音を含まない五音音階だけを使う（隣りが濁らない）。
   degree 0 を最低音に、上へ五音ずつ積む。
   ============================================================ */
export const SCALES = {
  yo:   { ja: '陽', steps: [0, 2, 4, 7, 9] },   // メジャーペンタ・あたたかい
  in:   { ja: '陰', steps: [0, 3, 5, 7, 10] },  // マイナーペンタ・しっとり
  ritsu:{ ja: '律', steps: [0, 2, 5, 7, 9] },   // 雅楽の風
  sus:  { ja: '宙', steps: [0, 2, 5, 7, 10] },  // 宙づり・どこにも帰らない
};
export const SCALE_IDS = Object.keys(SCALES);

/* MIDI 番号 → 周波数（A4=69=440Hz）。 */
export function midiToHz(m) { return 440 * 2 ** ((m - 69) / 12); }

/* 根音(midi) と音階で、degree 番目の音高(Hz)。 */
export function degreeHz(rootMidi, scale, degree) {
  const st = scale.steps, n = st.length;
  const d = degree | 0;
  const oct = Math.floor(d / n);
  const semi = st[((d % n) + n) % n] + 12 * oct;
  return midiToHz(rootMidi + semi);
}

/* ============================================================
   物体の種類。ratios はモーダル周波数比（[0] は必ず 1＝基音）。
   t60 は基音が −60dB まで鳴り続ける秒数（材質の永さ）。
   bright は高次の音量の落ち（小さいほど明るく倍音が立つ）。
   tilt は高次ほど早く減衰する度合い。noise は打撃の接触音。
   ============================================================ */
export const KINDS = {
  kane:   { ja: '鐘',   en: 'bell',   ratios: [1, 1.19, 1.5, 2.0, 2.5, 2.66, 3.0, 4.0], t60: 7.5, bright: 0.85, tilt: 0.55, noise: 0.05, rootLo: 53, rootHi: 64, cls: 'metal' },
  hachi:  { ja: '鉢',   en: 'bowl',   ratios: [1, 2.74, 5.42, 8.94], t60: 12.0, bright: 1.0, tilt: 0.4, noise: 0.03, rootLo: 55, rootHi: 67, cls: 'metal' },
  garasu: { ja: '硝子', en: 'glass',  ratios: [1, 2.5, 4.6, 7.1], t60: 9.0, bright: 1.15, tilt: 0.6, noise: 0.02, rootLo: 64, rootHi: 79, cls: 'glass' },
  suzu:   { ja: '鈴',   en: 'chime',  ratios: [1, 2.76, 5.40, 8.93, 13.34], t60: 4.0, bright: 0.8, tilt: 0.7, noise: 0.06, rootLo: 67, rootHi: 84, cls: 'metal' },
  ki:     { ja: '木',   en: 'wood',   ratios: [1, 2.76, 5.40], t60: 0.45, bright: 1.7, tilt: 1.2, noise: 0.16, rootLo: 60, rootHi: 76, cls: 'wood' },
  ishi:   { ja: '石',   en: 'stone',  ratios: [1, 2.3, 3.9], t60: 0.16, bright: 1.9, tilt: 1.4, noise: 0.28, rootLo: 57, rootHi: 72, cls: 'stone' },
  tsuzumi:{ ja: '鼓',   en: 'drum',   ratios: [1, 1.59, 2.14, 2.30, 2.65, 2.92], t60: 0.6, bright: 1.2, tilt: 1.0, noise: 0.22, rootLo: 45, rootHi: 57, cls: 'skin' },
  dora:   { ja: '銅鑼', en: 'gong',   ratios: [1, 1.46, 1.93, 2.41, 2.91, 3.43, 3.97, 4.6, 5.2], t60: 6.5, bright: 0.7, tilt: 0.45, noise: 0.12, rootLo: 41, rootHi: 53, cls: 'metal' },
};
export const KIND_IDS = Object.keys(KINDS);

/* 材質の永さの序列（テストが見張る：金・硝子＞木＞石）。 */
export const CLASS_RING = { metal: 4, glass: 4, skin: 2, wood: 1, stone: 0 };

/* −60dB に要する減衰係数 d を秒数 t60 から（e^(−d·t60)=10⁻³）。 */
const LN1000 = Math.log(1000);
function dampFor(t60) { return LN1000 / Math.max(1e-3, t60); }

/* ============================================================
   castObject — 一つの物体を鋳る。
     { id, kind, ja, name, rootMidi, degree, fundamental,
       modes: [{ f, a, d }], t60, noise }
   ============================================================ */
export function castObject(kind, rootMidi, scale, degree, jitter = 0) {
  const K = KINDS[kind];
  const fundamental = degreeHz(rootMidi, scale, degree);
  const modes = [];
  for (let i = 0; i < K.ratios.length; i++) {
    // ほんのわずかな非調和の揺らぎ（材質の個体差）。基音は揺らさない。
    const r = K.ratios[i] * (i === 0 ? 1 : 1 + (jitter) * (i / K.ratios.length));
    const f = fundamental * r;
    const a = 1 / Math.pow(r, K.bright);            // 高次ほど小さい
    const t60i = K.t60 / Math.pow(r, K.tilt);       // 高次ほど早く消える
    modes.push({ f, a, d: dampFor(t60i) });
  }
  // 音量を正規化（基音を 1 に）
  const a0 = modes[0].a || 1;
  for (const m of modes) m.a /= a0;
  return {
    kind, ja: K.ja, rootMidi, degree, fundamental,
    modes, t60: K.t60, noise: K.noise,
    name: K.ja + '・' + noteName(rootMidi, scale, degree),
  };
}

/* 音名（人に見せる用）。 */
const PITCH = ['ハ', '嬰ハ', 'ニ', '嬰ニ', 'ホ', 'ヘ', '嬰ヘ', 'ト', '嬰ト', 'イ', '嬰イ', 'ロ'];
export function noteName(rootMidi, scale, degree) {
  const st = scale.steps, n = st.length;
  const semi = rootMidi + st[((degree % n) + n) % n] + 12 * Math.floor(degree / n);
  return PITCH[((semi % 12) + 12) % 12];
}

/* ============================================================
   cast — 種から、共鳴する物体の一揃い（合奏できる組）を鋳る。
     { name, kindId, kind, scaleId, scale, rootMidi, objects:[...] }
   一つの材質で、五音音階に沿って低い物から高い物へ。
   ============================================================ */
export function cast(seed, opts = {}) {
  const rng = mulberry32(hashSeed(seed) ^ 0x68696269);   // 'hibi'
  const kindId = opts.kind || KIND_IDS[(rng() * KIND_IDS.length) | 0];
  const K = KINDS[kindId];
  const scaleId = opts.scale || SCALE_IDS[(rng() * SCALE_IDS.length) | 0];
  const scale = SCALES[scaleId];
  const count = opts.count || (6 + ((rng() * 3) | 0));     // 6..8 個
  const rootMidi = opts.rootMidi != null ? opts.rootMidi
    : Math.round(K.rootLo + rng() * (K.rootHi - K.rootLo));

  const objects = [];
  for (let i = 0; i < count; i++) {
    const jitter = (rng() - 0.5) * 0.01;                   // 個体差（ごく僅か）
    objects.push(castObject(kindId, rootMidi, scale, i, jitter));
  }
  return { name: ensembleName(seed), kindId, kind: K, scaleId, scale, rootMidi, objects };
}

/* ============================================================
   strike — 物体を叩いて、波形（PCM）を返す。Web Audio はいらない。
   返すのは Float32Array（[-1,1]、ピーク約 0.9 に正規化）。
     opts: { sampleRate=44100, velocity=1, seconds=t60, seed }
   velocity を上げるほど高次倍音が立ち、明るく硬い音になる。
   ============================================================ */
export function strike(obj, opts = {}) {
  const sr = opts.sampleRate || 44100;
  const vel = opts.velocity == null ? 1 : Math.max(0, opts.velocity);
  const seconds = opts.seconds || Math.min(14, obj.t60 * 1.05 + 0.05);
  const N = Math.max(1, Math.floor(sr * seconds));
  const out = new Float32Array(N);

  // 接触の打撃音（短い帯域ノイズ）。決定的にしたいので種つき乱数。
  const nrng = mulberry32((hashSeed(opts.seed ?? obj.name) ^ 0x6e6f6973) >>> 0);

  for (let i = 0; i < obj.modes.length; i++) {
    const m = obj.modes[i];
    // 強打ほど高次が起きる：velocity で高次の初期振幅を持ち上げる
    const aBright = m.a * Math.pow(vel, i * 0.18);
    const w = 2 * Math.PI * m.f / sr;
    const dec = Math.exp(-m.d / sr);                       // 1 サンプルごとの減衰
    // 漸化式で正弦を回す（sin/cos を毎サンプル呼ばない）
    let s = 0, c = 1, env = aBright;
    const cw = Math.cos(w), sw = Math.sin(w);
    for (let k = 0; k < N; k++) {
      out[k] += env * s;
      const ns = s * cw + c * sw, nc = c * cw - s * sw;    // 角を w 進める
      s = ns; c = nc;
      env *= dec;
      if (env < 1e-6) break;                               // 消えたら打ち切り
    }
  }
  // 打撃の接触音（最初の数ミリ秒）
  const nN = Math.min(N, Math.floor(sr * 0.012));
  const nAmp = obj.noise * (0.6 + 0.8 * vel);
  for (let k = 0; k < nN; k++) {
    out[k] += (nrng() * 2 - 1) * nAmp * Math.pow(1 - k / nN, 3);
  }

  // 正規化（ピークを約 0.9 に）。
  let peak = 0;
  for (let k = 0; k < N; k++) { const v = Math.abs(out[k]); if (v > peak) peak = v; }
  if (peak > 0) { const g = 0.9 / peak; for (let k = 0; k < N; k++) out[k] *= g; }
  return out;
}

/* ============================================================
   命名。物体の組は、おのれの名を名のる。
   ============================================================ */
const ON = ['rin', 'go', 'ne', 'mi', 'ka', 'su', 'wa', 'ho', 'to', 'ra', 'mu', 'shi', 'ko', 'na', 'yu'];
export function ensembleName(seed) {
  const rng = mulberry32(hashSeed(seed) ^ 0x6e616d65);
  const n = 2 + (rng() < 0.5 ? 1 : 0);
  let s = '';
  for (let i = 0; i < n; i++) s += ON[(rng() * ON.length) | 0];
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* 種ひとつの素性（テスト・UI 用のまとめ）。 */
export function describe(seed, opts) {
  const e = cast(seed, opts);
  return {
    name: e.name, material: e.kind.ja, materialEn: e.kind.en,
    scale: e.scale.ja, scaleId: e.scaleId, count: e.objects.length,
    rootMidi: e.rootMidi, t60: e.kind.t60, ensemble: e,
  };
}
