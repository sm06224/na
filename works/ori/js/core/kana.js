/* ============================================================
   カナ譜 — 「歌」の世界と同じ書き方で旋律を読み書きする。
   音符は (高さ + 長さ) をひとつの整数 id に畳んだもの。
   ひらがな = 低いオクターブ、カタカナ = 高いオクターブ、
   「ー」= 一拍ぶんの伸ばし（最大三拍）。
   つまり「らドレドレドーそーー」はこのファイルだけで読める。
   ============================================================ */

export const STEPS = 5;                   // ど れ み そ ら
export const OCTAVES = 2;
export const DEGREES = STEPS * OCTAVES;   // 高さの段 0..9
export const DURS = [1, 2, 3];            // 拍：タ・ター・ターー

export function note(deg, durIdx) { return deg * DURS.length + durIdx; }
export function noteDeg(n) { return (n / DURS.length) | 0; }
export function noteDur(n) { return DURS[n % DURS.length]; }

const SOL_LOW = ['ど', 'れ', 'み', 'そ', 'ら'];
const SOL_HIGH = ['ド', 'レ', 'ミ', 'ソ', 'ラ'];

export function noteToKana(n) {
  const d = noteDeg(n);
  const base = d < STEPS ? SOL_LOW[d] : SOL_HIGH[d - STEPS];
  return base + 'ー'.repeat(noteDur(n) - 1);
}
export function melodyToKana(m) { return m.map(noteToKana).join(''); }

/* カナ → 旋律。空白・読点は読み飛ばし、知らない字には黙らない。 */
export function kanaToMelody(s) {
  const m = [];
  for (const ch of s) {
    if (/[\s、。・･,.]/u.test(ch)) continue;
    if (ch === 'ー') {
      if (m.length === 0) throw new Error('伸ばし「ー」の前に音がありません');
      const last = m[m.length - 1];
      const durIdx = last % DURS.length;
      if (durIdx >= DURS.length - 1) throw new Error('伸ばしは三拍までです');
      m[m.length - 1] = last + 1;
      continue;
    }
    let d = SOL_LOW.indexOf(ch);
    if (d < 0) {
      const h = SOL_HIGH.indexOf(ch);
      if (h < 0) throw new Error(`読めない音です: 「${ch}」`);
      d = STEPS + h;
    }
    m.push(note(d, 0));
  }
  if (m.length === 0) throw new Error('旋律が空です');
  return m;
}

/* 周波数（UI の演奏用）：「ど」= C4 の長音階ペンタトニック */
const SEMITONES = [0, 2, 4, 7, 9];
export function noteFreq(n, base = 261.63) {
  const d = noteDeg(n);
  const oct = (d / STEPS) | 0, step = d % STEPS;
  return base * 2 ** ((SEMITONES[step] + 12 * oct) / 12);
}
