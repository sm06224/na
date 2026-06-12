/* ============================================================
   楽理 — 奏のコア。DOM も Web Audio も知らない。
   「誰が何を弾いても濁らない」はここで保証する：
   すべての音は五音系の音階に量子化される。五音音階には
   ぶつかる半音がないので、何人で同時に触っても協和する。
   ============================================================ */

/* 音階の在庫。intervals はオクターブ内の半音位置（五音）。
   それぞれに情景の名と、光の色（hue の帯）を持つ。 */
/* 半音を含む五音音階（琉球・平調子など）は美しいが、隣どうしが
   濁りうるので、ここでは使わない。全部アンヘミトニック。 */
export const SCALES = [
  { id: 'yoi',  label: '宵', intervals: [0, 2, 4, 7, 9],  base: 220.0,
    hueA: 230, hueB: 50,  gloss: 'メジャーペンタトニック。あたたかい' },
  { id: 'ame',  label: '雨', intervals: [0, 3, 5, 7, 10], base: 220.0,
    hueA: 200, hueB: 160, gloss: 'マイナーペンタトニック。しっとり' },
  { id: 'kaze', label: '風', intervals: [0, 2, 5, 7, 9],  base: 220.0,
    hueA: 130, hueB: 60,  gloss: '律音階。雅楽の風がとおる' },
  { id: 'nagi', label: '凪', intervals: [0, 2, 5, 7, 10], base: 220.0,
    hueA: 190, hueB: 280, gloss: '宙づりの音階。どこにも帰らず、ただ漂う' },
];
export const scaleById = Object.fromEntries(SCALES.map(s => [s.id, s]));

/* 画面の縦いっぱいに広げる段数（およそ3オクターブ） */
export const SPAN = 15;

/* 段 → 周波数。degree 0 が最低音。 */
export function freqOf(scale, degree) {
  const n = scale.intervals.length;
  const d = Math.max(0, Math.min(SPAN - 1, degree | 0));
  const oct = Math.floor(d / n);
  const semi = scale.intervals[d % n] + 12 * oct;
  return scale.base * 2 ** (semi / 12);
}

/* 画面の縦位置（0=上端, 1=下端）→ 段。上ほど高い音。 */
export function degreeFromY(yNorm) {
  const y = Math.max(0, Math.min(1, yNorm));
  return Math.min(SPAN - 1, Math.floor((1 - y) * SPAN));
}

/* 画面の横位置（0..1）→ 定位（左右いっぱいは使わない） */
export function panFromX(xNorm) {
  const x = Math.max(0, Math.min(1, xNorm));
  return (x - 0.5) * 1.6;
}

/* 段 → 光の色。低音は hueA、高音へ向かって hueB へ滲む。 */
export function hueOf(scale, degree) {
  const t = Math.max(0, Math.min(1, degree / (SPAN - 1)));
  return scale.hueA + (scale.hueB - scale.hueA) * t;
}

/* ============================================================
   こだま — 弾いた音は、ひと巡りして薄くなって還ってくる。
   一人でも重ねれば合奏になり、何人かなら模様が編み上がる。
   音もイベントとして繰り返すので、光もいっしょに還る。
   ============================================================ */
export class EchoLoop {
  constructor(loopSec = 8, decay = 0.55, floor = 0.13) {
    this.loopSec = loopSec;
    this.decay = decay;     // ひと巡りごとの減衰
    this.floor = floor;     // これより小さくなったら、忘れる
    this.events = [];       // { at, x, y, degree, gain, gen }
    this.enabled = true;
  }

  /* いま弾いた音を覚える（gain は次の巡回で decay 倍されて還る） */
  add(ev, now) {
    if (!this.enabled) return;
    this.events.push({ ...ev, at: now, gain: 1, gen: 0 });
    if (this.events.length > 400) this.events.shift();
  }

  /* now までに「還ってくるべき音」を返し、次の巡回を予約する */
  poll(now) {
    if (!this.enabled) return [];
    const due = [];
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i];
      if (now - e.at < this.loopSec) continue;
      const gain = e.gain * this.decay;
      if (gain < this.floor) { this.events.splice(i, 1); continue; }
      e.at += this.loopSec;     // 取りこぼしても重複しない
      e.gain = gain;
      e.gen++;
      due.push({ x: e.x, y: e.y, degree: e.degree, gain, gen: e.gen });
    }
    return due;
  }

  clear() { this.events.length = 0; }
  size() { return this.events.length; }
}
