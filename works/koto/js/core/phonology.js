/* ============================================================
   音韻 — 単語は音節の列、音節は (子音 + 母音)。
   各群（deme）は自分の音素在庫を持ち、それが訛りの素地になる。
   単語は文字列ではなく音節 id の配列で持ち、表示時にカナへ写す。
   ============================================================ */

/* 子音と母音の在庫。id はそのまま音の同一性を表す。 */
export const CONSONANTS = ['k', 'g', 's', 'z', 't', 'd', 'n', 'h', 'b', 'p', 'm', 'r', 'w', 'y'];
export const VOWELS = ['a', 'i', 'u', 'e', 'o'];

/* 音節 = 子音 index * 5 + 母音 index（0..69）。
   子音 index = -1（=母音のみ）は使わず、単純化のため CV のみ。 */
export function syl(cIdx, vIdx) { return cIdx * VOWELS.length + vIdx; }
export function sylC(s) { return (s / VOWELS.length) | 0; }
export function sylV(s) { return s % VOWELS.length; }

/* カナ表（CV を素直に写す。無ければローマ字フォールバック） */
const KANA = {
  k: ['カ', 'キ', 'ク', 'ケ', 'コ'], g: ['ガ', 'ギ', 'グ', 'ゲ', 'ゴ'],
  s: ['サ', 'シ', 'ス', 'セ', 'ソ'], z: ['ザ', 'ジ', 'ズ', 'ゼ', 'ゾ'],
  t: ['タ', 'チ', 'ツ', 'テ', 'ト'], d: ['ダ', 'ヂ', 'ヅ', 'デ', 'ド'],
  n: ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ'], h: ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ'],
  b: ['バ', 'ビ', 'ブ', 'ベ', 'ボ'], p: ['パ', 'ピ', 'プ', 'ペ', 'ポ'],
  m: ['マ', 'ミ', 'ム', 'メ', 'モ'], r: ['ラ', 'リ', 'ル', 'レ', 'ロ'],
  w: ['ワ', 'ヰ', 'ゥ', 'ヱ', 'ヲ'], y: ['ヤ', 'イ', 'ユ', 'エ', 'ヨ'],
};

export function sylToKana(s) {
  const c = CONSONANTS[sylC(s)], v = sylV(s);
  return (KANA[c] && KANA[c][v]) || (c + VOWELS[v]);
}

export function wordToKana(word) {
  return word.map(sylToKana).join('');
}
export function wordToRoma(word) {
  return word.map(s => CONSONANTS[sylC(s)] + VOWELS[sylV(s)]).join('');
}

/* 群の音素プロファイル：使う子音・母音に重みを持たせる。
   これが偏ることで「この方言は濁音が多い」等の個性が出る。 */
export function makeProfile(rng) {
  const cw = CONSONANTS.map(() => 0.3 + rng.float() ** 2 * 2);
  const vw = VOWELS.map(() => 0.5 + rng.float() ** 2 * 2);
  return { cw, vw };
}

/* プロファイルから 1 音節を引く */
export function sampleSyl(profile, rng) {
  return syl(rng.weighted(profile.cw), rng.weighted(profile.vw));
}

/* 新語を作る（1〜2 音節、たまに 3） */
export function coinWord(profile, rng) {
  const n = rng.chance(0.55) ? 2 : (rng.chance(0.7) ? 1 : 3);
  const w = [];
  for (let i = 0; i < n; i++) w.push(sampleSyl(profile, rng));
  return w;
}

/* ----- 音変化（言語が時間とともに訛る） ----- */

/* 子音の自然な推移（弱化・有声化の連鎖）。-1 は変化なし。 */
const C_SHIFT = {
  k: 'g', g: 'h', t: 'd', d: 'r', s: 'h', p: 'b', b: 'm', h: 'w',
};
const C_INDEX = Object.fromEntries(CONSONANTS.map((c, i) => [c, i]));

/* 単語に確率的な音変化を施した新語形を返す（元は壊さない）。
   strength を上げると訛りが激しくなる。 */
export function mutateForm(word, rng, strength = 1) {
  let w = word.slice();
  // 1) 子音推移
  if (rng.chance(0.18 * strength) && w.length) {
    const i = rng.int(w.length);
    const c = CONSONANTS[sylC(w[i])];
    if (C_SHIFT[c] !== undefined) {
      w[i] = syl(C_INDEX[C_SHIFT[c]], sylV(w[i]));
    }
  }
  // 2) 母音推移（a→o→u の連鎖、e→i）
  if (rng.chance(0.16 * strength) && w.length) {
    const i = rng.int(w.length);
    const v = sylV(w[i]);
    const next = [4, 1, 4, 0, 2][v]; // a→o,i→i,u→o(?),e→a,o→u … ゆるい円環
    w[i] = syl(sylC(w[i]), next);
  }
  // 3) 末尾音節の脱落（語の摩耗）
  if (w.length >= 2 && rng.chance(0.07 * strength)) {
    w = w.slice(0, -1);
  }
  // 4) 音節の重複（強調から生まれる）
  if (w.length && rng.chance(0.05 * strength)) {
    const i = rng.int(w.length);
    w.splice(i, 0, w[i]);
  }
  if (w.length === 0) w = word.slice(); // 消滅は防ぐ
  return w;
}

/* 2 つの語形の距離（0=同一）。音節単位の素朴な編集距離。 */
export function formDistance(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = sameSyl(a[i - 1], b[j - 1]) ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[n][m];
}
/* 音節の近さ：同子音か同母音なら 0.5 の部分一致扱い */
function sameSyl(x, y) {
  if (x === y) return true;
  return false;
}

/* 群の名前（音素プロファイルから 2〜3 音節） */
export function demeName(profile, rng) {
  const w = [];
  const n = 2 + rng.int(2);
  for (let i = 0; i < n; i++) w.push(sampleSyl(profile, rng));
  const k = wordToKana(w);
  return k.charAt(0) + k.slice(1);
}
