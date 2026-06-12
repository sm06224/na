/* ============================================================
   音階 — 歌は音符の列、音符は (高さ + 長さ)。
   高さは五音音階（ペンタトニック）の段。半音が無いので、
   どの群のどんな節回しも、重なればなぜか調和する。
   音符は文字列ではなく整数 id で持ち、表示時に唱歌のカナへ写す。
   ひらがな = 低いオクターブ、カタカナ = 高いオクターブ。
   ============================================================ */

export const STEPS = 5;                   // ど れ み そ ら
export const OCTAVES = 2;
export const DEGREES = STEPS * OCTAVES;   // 高さの段 0..9
export const DURS = [1, 2, 3];            // 拍：タ・ター・ターー
export const MIN_LEN = 3, MAX_LEN = 16;   // 歌の長さの自然な限界

export function note(deg, durIdx) { return deg * DURS.length + durIdx; }
export function noteDeg(n) { return (n / DURS.length) | 0; }
export function noteDur(n) { return DURS[n % DURS.length]; }
export function noteDurIdx(n) { return n % DURS.length; }

/* 唱歌のカナ写し */
const SOL_LOW = ['ど', 'れ', 'み', 'そ', 'ら'];
const SOL_HIGH = ['ド', 'レ', 'ミ', 'ソ', 'ラ'];
export function noteToKana(n) {
  const d = noteDeg(n);
  const base = d < STEPS ? SOL_LOW[d] : SOL_HIGH[d - STEPS];
  return base + 'ー'.repeat(noteDur(n) - 1);
}
export function melodyToKana(m) { return m.map(noteToKana).join(''); }

/* 周波数（UI の演奏用）：「ど」= C4 の長音階ペンタトニック */
const SEMITONES = [0, 2, 4, 7, 9];
export function noteFreq(n, base = 261.63) {
  const d = noteDeg(n);
  const oct = (d / STEPS) | 0, step = d % STEPS;
  return base * 2 ** ((SEMITONES[step] + 12 * oct) / 12);
}

/* 群の歌い口：好む音域・好む拍・跳躍癖。これが節回しの訛りの素地になる。 */
export function makeStyle(rng) {
  const center = 2 + rng.float() * (DEGREES - 4);   // 音域の好みの中心
  const width = 1.6 + rng.float() * 2.4;
  const reg = [];
  for (let d = 0; d < DEGREES; d++) reg.push(Math.exp(-(((d - center) / width) ** 2)) + 0.05);
  // 拍の好み：短い音を基調に、群ごとに揺らす（歌は流れるもの）
  const durBase = [1.4, 0.8, 0.35];
  const dur = durBase.map(b => b * (0.4 + rng.float() * 1.6));
  return { reg, dur, leap: 0.12 + rng.float() * 0.3 };
}

/* 新しい歌を作る（4〜7 音の節）。順次進行を基本に、ときどき跳ぶ。 */
export function coinMelody(style, rng) {
  const len = 4 + rng.int(4);
  const m = [];
  let deg = rng.weighted(style.reg);
  for (let i = 0; i < len; i++) {
    m.push(note(deg, rng.weighted(style.dur)));
    const leap = rng.chance(style.leap) ? 2 + rng.int(3) : 1;
    let next = deg + (rng.chance(0.5) ? leap : -leap);
    if (next < 0 || next >= DEGREES) next = deg + (next < 0 ? leap : -leap);
    deg = Math.max(0, Math.min(DEGREES - 1, next));
  }
  return m;
}

/* ----- 変奏（歌が口から口へ渡るとき、節は揺れる） ----- */
export function varyMelody(m, rng, strength = 1) {
  let w = m.slice();
  // 1) 装飾：隣の高さの短い音を差し込む
  if (rng.chance(0.2 * strength) && w.length < MAX_LEN) {
    const i = rng.int(w.length);
    const d = Math.max(0, Math.min(DEGREES - 1, noteDeg(w[i]) + (rng.chance(0.5) ? 1 : -1)));
    w.splice(i, 0, note(d, 0));
  }
  // 2) 高さのずれ（音痴ではなく、好みの現れ）
  if (rng.chance(0.22 * strength) && w.length) {
    const i = rng.int(w.length);
    const d = Math.max(0, Math.min(DEGREES - 1, noteDeg(w[i]) + (rng.chance(0.5) ? 1 : -1)));
    w[i] = note(d, noteDurIdx(w[i]));
  }
  // 3) 拍の伸び縮み
  if (rng.chance(0.18 * strength) && w.length) {
    const i = rng.int(w.length);
    w[i] = note(noteDeg(w[i]), rng.int(DURS.length));
  }
  // 4) 句の繰り返し — 覚えやすさ（フック）はここから生まれる
  if (rng.chance(0.16 * strength) && w.length >= 2) {
    const n = 2 + rng.int(Math.min(3, w.length - 1));
    const at = rng.int(w.length - n + 1);
    if (w.length + n <= MAX_LEN) w.splice(at + n, 0, ...w.slice(at, at + n));
  }
  // 5) 摩耗：音がひとつ落ちる
  if (w.length > MIN_LEN && rng.chance(0.1 * strength)) {
    w.splice(rng.int(w.length), 1);
  }
  if (w.length === 0) w = m.slice();
  return w;
}

/* 2 つの旋律の距離（0=同一）。音符単位の素朴な編集距離。 */
export function melodyDistance(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[n][m];
}

/* ----- 覚えやすさ（memorability）-----
   胸に残る歌だけが、もう一度歌われる。これが音楽の淘汰圧。
   反復が多く、順次進行が多く、長すぎない節ほど高い。0..1。 */
export function memorability(m) {
  if (m.length < 2) return 0.1;
  // 反復：同じ 2 音の並びが繰り返されるほど残る
  const seen = new Map();
  let rep = 0;
  for (let i = 0; i < m.length - 1; i++) {
    const k = m[i] * 64 + m[i + 1];
    const c = seen.get(k) || 0;
    if (c > 0) rep++;
    seen.set(k, c + 1);
  }
  const repScore = Math.min(1, rep / Math.max(1, m.length - 2));
  // 歌いやすさ：跳躍が少ないほど喉に馴染む
  let smooth = 0;
  for (let i = 0; i < m.length - 1; i++) {
    smooth += Math.max(0, 1 - Math.abs(noteDeg(m[i + 1]) - noteDeg(m[i])) / 4);
  }
  smooth /= m.length - 1;
  // 長さ：短すぎても長すぎても残らない
  const L = m.length;
  const lenScore = L <= 4 ? (L / 4) * 0.8 : L <= 10 ? 1 : Math.max(0.2, 1 - (L - 10) * 0.12);
  return 0.5 * repScore + 0.3 * smooth + 0.2 * lenScore;
}
