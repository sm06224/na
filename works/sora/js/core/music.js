/* ============================================================
   宙 — music. メガデモの自前サウンドトラック（楽譜）。
   DOM も Web Audio も知らない。各 16分音符の刻みで、どのトラックが
   何を鳴らすかを返すだけ。鳴らすのは UI（Web Audio）と録音器(rec.js)。

   ベース＆和音は四つの和音をめぐり、リードは五音音階で外れない。
   速さは BPM から決まる。同じ刻みなら、いつでも同じ音。
   ============================================================ */

export const BPM = 124;
export const STEP = 60 / BPM / 4;           // 16分音符 1 個の秒数
export const STEPS_PER_BAR = 16;

export function midiToHz(m) { return 440 * 2 ** ((m - 69) / 12); }
export function stepAt(t) { return Math.floor(t / STEP); }

/* 和音の根（半音・基準 A から）。vi–IV–I–V 風の、よく流れる並び。 */
const ROOTS = [0, -4, 3, -2];               // A, F, C, G（1 小節ずつ）
const BASE = 33;                            // A1（低音）
const LEAD_BASE = 69;                       // A4（高音）
/* マイナー・ペンタトニック（半音）。リードはここから外れない。 */
const PENTA = [0, 3, 5, 7, 10];

/* 打楽器のパターン（1 小節＝16 刻み）。 */
const KICK  = [1,0,0,0, 0,0,1,0, 0,0,1,0, 0,0,0,0];
const SNARE = [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1];
const HAT   = [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0];
/* ベースの刻み（根音を弾く位置）。 */
const BASS  = [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,1,0,0];
/* リードのアルペジオ（ペンタの番号、-1 は休み）。 */
const ARP   = [0,2,4,2, 3,2,1,0, 0,2,4,5, 4,2,1,-1];

/* 刻み step（全曲を通した 16分音符の通し番号）で、各トラックの音を返す。
   { step, bar, beat, kick, snare, hat, bass, lead, pad:[...] } すべて Hz か null。 */
export function notesAtStep(step) {
  const inBar = ((step % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR;
  const bar = Math.floor(step / STEPS_PER_BAR);
  const root = ROOTS[((bar % ROOTS.length) + ROOTS.length) % ROOTS.length];

  const kick = !!KICK[inBar];
  const snare = !!SNARE[inBar];
  const hat = !!HAT[inBar];

  let bass = null;
  if (BASS[inBar]) {
    const oct = (inBar % 8 === 3) ? 12 : 0;          // たまにオクターブ上へ跳ねる
    bass = midiToHz(BASE + root + oct);
  }

  let lead = null;
  const a = ARP[inBar];
  if (a >= 0) lead = midiToHz(LEAD_BASE + root + PENTA[a % PENTA.length] + 12 * Math.floor(a / PENTA.length));

  // パッドは小節頭で、根＋五度＋オクターブ（パワーコード＝決して濁らない）。
  let pad = null;
  if (inBar === 0) pad = [BASE + 12 + root, BASE + 12 + root + 7, BASE + 24 + root].map(midiToHz);

  return { step, bar, beat: Math.floor(inBar / 4), inBar, kick, snare, hat, bass, lead, pad };
}

/* リードの半音が、その小節の根に対してペンタの内側にあるか（テスト用）。 */
export function leadIsPentatonic(step) {
  const inBar = ((step % STEPS_PER_BAR) + STEPS_PER_BAR) % STEPS_PER_BAR;
  if (ARP[inBar] < 0) return true;
  const a = ARP[inBar];
  const semi = PENTA[a % PENTA.length];
  return PENTA.includes(((semi % 12) + 12) % 12);
}

/* 時間窓 [t0,t1) に着手する刻みの一覧（先読みスケジューラ・録音器が使う）。 */
export function stepsInWindow(t0, t1) {
  const out = [];
  let s = Math.max(0, Math.ceil(t0 / STEP));
  for (; s * STEP < t1; s++) out.push({ step: s, at: s * STEP });
  return out;
}
