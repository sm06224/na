/* ============================================================
   声 — koe. 無から生まれる声。

   サンプル音源を一切使わず、声を物理の模型から立ち上げる——
   ソース・フィルタ模型。声帯のひだが震えてできる倍音ゆたかな
   「ブザー」（声源）を、声道（口・舌・喉）の共鳴＝フォルマントが
   母音のかたちに削り出す。第1・第2フォルマント(F1,F2)の位置が、
   「あ・い・う・え・お」を分ける。誰も声を録っていない。
   倍音ごとの強さを、フォルマントの共鳴で重みづけて足すだけ。

   音高はすべて五音音階に量子化される——重ねても濁らない（合唱）。
   `言`(言葉)→`歌`(音楽)→`響`(音色) と続いた音の系譜の、声の章。
   ——依存ゼロ・Web Audio も知らない。同じ種なら、同じ声。
   ============================================================ */

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
   母音のフォルマント（日本語・おおよその男声）。
   f: フォルマント周波数 [F1,F2,F3]（Hz）
   bw: 帯域幅（共鳴の鋭さ）  g: 強さ（F1 がいちばん大きい）
   F1 はおおむね口の開き、F2 は舌の前後に対応する。
   ============================================================ */
export const VOWELS = {
  a: { ja: 'あ', f: [800, 1200, 2900], bw: [80, 90, 120], g: [1.0, 0.5, 0.18] },
  i: { ja: 'い', f: [300, 2300, 3000], bw: [60, 100, 120], g: [1.0, 0.45, 0.2] },
  u: { ja: 'う', f: [350, 1250, 2200], bw: [60, 90, 120], g: [1.0, 0.4, 0.15] },
  e: { ja: 'え', f: [500, 1900, 2550], bw: [70, 100, 120], g: [1.0, 0.5, 0.2] },
  o: { ja: 'お', f: [500, 900, 2400], bw: [70, 80, 120], g: [1.0, 0.45, 0.15] },
};
export const VOWEL_IDS = Object.keys(VOWELS);

/* 声道の長さで全フォルマントを伸縮（小さいほど高い＝子ども・女声寄り）。 */
export function scaleVowel(v, k = 1) {
  return { ja: v.ja, f: v.f.map(x => x * k), bw: v.bw.map(x => x * Math.sqrt(k)), g: v.g.slice() };
}

/* フォルマントの共鳴：周波数 f での声道のゲイン（ローレンツ型の山の和）。 */
export function resonance(f, vowel) {
  let s = 0;
  for (let i = 0; i < vowel.f.length; i++) {
    const d = (f - vowel.f[i]) / (vowel.bw[i] * 0.5);
    s += vowel.g[i] / (1 + d * d);
  }
  return s + 0.0025;                         // ほんの底上げ（高次が消えすぎないよう）
}

/* 声源（声帯）の倍音の強さ：おおよそ 1/n の傾き（ノコギリ波的）。 */
function sourceAmp(n, tilt = 1.0) { return 1 / Math.pow(n, tilt); }

/* 倍音 n（基音 f0）の最終的な強さ＝声源 × 声道の共鳴。 */
export function harmonicAmp(n, f0, vowel, tilt = 1.0) {
  return sourceAmp(n, tilt) * resonance(n * f0, vowel);
}

/* ============================================================
   音階。半音のない五音音階だけ（合唱が濁らない）。
   ============================================================ */
export const SCALE = [0, 2, 4, 7, 9];        // メジャーペンタ
export function midiToHz(m) { return 440 * 2 ** ((m - 69) / 12); }
export function degreeHz(rootMidi, degree) {
  const n = SCALE.length;
  const oct = Math.floor(degree / n);
  return midiToHz(rootMidi + SCALE[((degree % n) + n) % n] + 12 * oct);
}

/* ============================================================
   sing — 一声、母音を歌わせて波形(PCM)を返す。Web Audio はいらない。
   倍音加算合成：各倍音を、声源×フォルマント共鳴で重みづけて足す。
     opts: { f0, vowel:'a', seconds, sampleRate=44100,
             vibrato=5(Hz), depth=0.006, breath=0.004, tilt=1.0, seed }
   返すのは Float32Array（[-1,1]、ピーク約 0.9 に正規化）。
   ============================================================ */
export function sing(opts = {}) {
  const sr = opts.sampleRate || 44100;
  const f0 = opts.f0 || 220;
  const vowel = typeof opts.vowel === 'string' ? VOWELS[opts.vowel] : (opts.vowel || VOWELS.a);
  const seconds = opts.seconds || 1.0;
  const vibR = opts.vibrato == null ? 5 : opts.vibrato;
  const depth = opts.depth == null ? 0.006 : opts.depth;
  const breathAmt = opts.breath == null ? 0.004 : opts.breath;
  const tilt = opts.tilt || 1.0;
  const N = Math.max(1, Math.floor(sr * seconds));
  const out = new Float32Array(N);
  const nyq = sr / 2;
  const H = Math.min(64, Math.max(1, Math.floor(nyq / f0)));

  // 倍音ごとの位相と振幅（振幅はビブラートに合わせて時々更新）。
  const amp = new Float32Array(H + 1);
  const recompute = (curF0) => { for (let n = 1; n <= H; n++) amp[n] = (n * curF0 < nyq) ? harmonicAmp(n, curF0, vowel, tilt) : 0; };
  recompute(f0);

  const nrng = mulberry32((hashSeed(opts.seed ?? 'koe') ^ 0x62726561) >>> 0);
  let ph = opts.phase || 0;                   // 基音の位相（周）
  const vibPh0 = (hashSeed(opts.seed ?? 'koe') % 1000) / 1000 * 6.283;

  // 音量の起伏（やわらかな立ち上がりと減衰＝歌の息づかい）
  const atk = Math.min(0.12, seconds * 0.25), rel = Math.min(0.25, seconds * 0.35);
  for (let k = 0; k < N; k++) {
    const t = k / sr;
    const vib = 1 + depth * Math.sin(2 * Math.PI * vibR * t + vibPh0);
    const curF0 = f0 * vib;
    if ((k & 127) === 0) recompute(curF0);
    ph += curF0 / sr;
    const tp = 2 * Math.PI * ph;
    let s = 0;
    for (let n = 1; n <= H; n++) { const a = amp[n]; if (a) s += a * Math.sin(tp * n); }
    // ささやかな息（高域のノイズを声道に通したもの）
    if (breathAmt) s += (nrng() * 2 - 1) * breathAmt * resonance(2500, vowel);
    // 包絡
    let env = 1;
    if (t < atk) env = t / atk;
    else if (t > seconds - rel) env = Math.max(0, (seconds - t) / rel);
    out[k] = s * env;
  }
  // 正規化
  let peak = 0; for (let k = 0; k < N; k++) { const v = Math.abs(out[k]); if (v > peak) peak = v; }
  if (peak > 0) { const g = 0.9 / peak; for (let k = 0; k < N; k++) out[k] *= g; }
  return out;
}

/* ============================================================
   choir — 種から、ひとつの合唱（少しずつ違う歌い手たち）を作る。
   各声は、わずかな音程のずれ・声道長・ビブラート位相が異なる。
   ============================================================ */
export function choir(seed, opts = {}) {
  const rng = mulberry32(hashSeed(seed) ^ 0x63686f69);   // 'choi'
  const n = opts.count || (3 + ((rng() * 3) | 0));        // 3..5 人
  const rootMidi = opts.rootMidi != null ? opts.rootMidi : 50 + ((rng() * 8) | 0);
  const singers = [];
  for (let i = 0; i < n; i++) {
    singers.push({
      detune: (rng() * 2 - 1) * 8,            // セント
      tract: 0.9 + rng() * 0.35,              // 声道長（声色）
      vibR: 4.5 + rng() * 2,
      vibPhase: rng(),
      pan: n === 1 ? 0 : (i / (n - 1) - 0.5) * 1.2,
    });
  }
  return { name: voiceName(seed), seed, rootMidi, singers };
}

/* ============================================================
   phrase — 種から、ことばのない短い歌（五音の旋律＋母音）。
   返すのは [{ degree, vowel, dur }]（dur は拍）。
   ============================================================ */
export function phrase(seed, bars = 4) {
  const rng = mulberry32(hashSeed(seed) ^ 0x70687261);   // 'phra'
  const notes = [];
  let deg = 2 + ((rng() * 3) | 0);
  for (let b = 0; b < bars; b++) {
    let beats = 0;
    while (beats < 4) {
      const dur = rng() < 0.5 ? 1 : (rng() < 0.6 ? 2 : 0.5);
      const d = Math.min(4 - beats, dur);
      deg = Math.max(0, Math.min(9, deg + ((rng() * 5) | 0) - 2));
      const vowel = VOWEL_IDS[(rng() * VOWEL_IDS.length) | 0];
      notes.push({ degree: deg, vowel, dur: d });
      beats += d;
    }
  }
  return notes;
}

const ON = ['a', 'ka', 'sa', 'na', 'ma', 'ya', 'ra', 'wa', 'mi', 'ko', 'to', 'ne', 'su', 'ho'];
export function voiceName(seed) {
  const rng = mulberry32(hashSeed(seed) ^ 0x6e616d65);
  let s = '';
  const n = 2 + (rng() < 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) s += ON[(rng() * ON.length) | 0];
  return s.charAt(0).toUpperCase() + s.slice(1);
}
