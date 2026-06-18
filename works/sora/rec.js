/* 宙 — サウンドtrack を WAV に焼く録音器。
   `響` の naru.js と同じ流儀で、コアの楽譜(music.js)を純 JS の簡易シンセで
   鳴らし、手作りの残響に沈めて 16bit ステレオ WAV に書き出す。Web Audio 不要。

     node rec.js [秒] > sora.wav
*/

import { notesAtStep, stepsInWindow, STEP } from './js/core/music.js';

const SECONDS = Math.min(120, Math.max(4, +(process.argv[2] || 32)));
const SR = 44100;
const total = Math.floor(SR * SECONDS);
const L = new Float32Array(total), R = new Float32Array(total);

function add(at, dur, gain, pan, gen) {
  const start = Math.floor(at * SR), n = Math.floor(dur * SR);
  const gl = Math.cos((pan + 1) * Math.PI / 4) * gain, gr = Math.sin((pan + 1) * Math.PI / 4) * gain;
  for (let k = 0; k < n && start + k < total; k++) {
    if (start + k < 0) continue;
    const s = gen(k / SR, k / n);
    L[start + k] += s * gl; R[start + k] += s * gr;
  }
}
const saw = (ph) => 2 * (ph - Math.floor(ph + 0.5));
const sq = (ph, duty = 0.5) => ((ph - Math.floor(ph)) < duty ? 1 : -1);
let nseed = 1; const noise = () => { nseed = (Math.imul(nseed, 1664525) + 1013904223) >>> 0; return nseed / 2147483648 - 1; };

/* 声たち */
function kick(at) {
  add(at, 0.32, 0.95, 0, (t) => {
    const f = 120 * Math.exp(-t * 22) + 45;
    const env = Math.exp(-t * 9);
    return Math.sin(2 * Math.PI * f * t) * env;
  });
}
function snare(at) {
  add(at, 0.2, 0.4, 0, (t) => (noise() * 0.8 + Math.sin(2 * Math.PI * 180 * t) * 0.2) * Math.exp(-t * 18));
}
function hat(at) {
  add(at, 0.05, 0.22, 0.2, (t) => (noise() - noise()) * Math.exp(-t * 90));
}
function bass(at, f) {
  add(at, 0.22, 0.5, 0, (t) => {
    let lp = 0; // 一極ローパスの近似のかわりに saw を軽く丸める
    const env = Math.min(1, t * 60) * Math.exp(-t * 4.5);
    return (saw(f * t) * 0.7 + Math.sin(2 * Math.PI * f * t) * 0.3) * env;
  });
}
function lead(at, f) {
  for (const [d, g] of [[0, 0.34], [0.13, 0.16], [0.26, 0.08]]) {   // ディレイ・エコー
    add(at + d, 0.26, g, 0.25, (t) => sq(f * t, 0.4) * Math.min(1, t * 80) * Math.exp(-t * 7));
  }
}
function pad(at, freqs) {
  for (const f of freqs) {
    add(at, 2.2, 0.12, -0.2, (t, p) => {
      const env = Math.min(1, t * 1.2) * (1 - p) * 0.9;
      return (saw(f * t) * 0.5 + saw(f * 1.005 * t) * 0.5) * env;
    });
  }
}

/* 演奏：曲の刻みをぜんぶ並べる。 */
for (const { step, at } of stepsInWindow(0, SECONDS)) {
  const n = notesAtStep(step);
  if (n.kick) kick(at);
  if (n.snare) snare(at);
  if (n.hat) hat(at);
  if (n.bass) bass(at, n.bass);
  if (n.lead) lead(at, n.lead);
  if (n.pad) pad(at, n.pad);
}

/* シュレーダー残響（響の naru.js と同じ手）。 */
function comb(buf, d, g) { const D = Math.floor(d * SR), o = new Float32Array(buf.length); for (let i = 0; i < buf.length; i++) o[i] = buf[i] + (i >= D ? g * o[i - D] : 0); return o; }
function allpass(buf, d, g) { const D = Math.floor(d * SR), o = new Float32Array(buf.length); for (let i = 0; i < buf.length; i++) { const x = buf[i], y = i >= D ? o[i - D] : 0; o[i] = -g * x + y + g * (i >= D ? buf[i - D] : 0); } return o; }
function reverb(buf) { let s = new Float32Array(buf.length); for (const [d, g] of [[0.0297, 0.77], [0.0371, 0.75], [0.0411, 0.73], [0.0437, 0.71]]) { const c = comb(buf, d, g); for (let i = 0; i < s.length; i++) s[i] += c[i] * 0.25; } s = allpass(s, 0.005, 0.7); s = allpass(s, 0.0017, 0.7); return s; }
const wet = 0.2, Lw = reverb(L), Rw = reverb(R);
for (let i = 0; i < total; i++) { L[i] += Lw[i] * wet; R[i] += Rw[i] * wet; }

/* 正規化＋書き出し。 */
let peak = 0; for (let i = 0; i < total; i++) { if (Math.abs(L[i]) > peak) peak = Math.abs(L[i]); if (Math.abs(R[i]) > peak) peak = Math.abs(R[i]); }
const g = peak > 0 ? 0.95 / peak : 1;
const bytes = 44 + total * 4, b = Buffer.alloc(bytes);
b.write('RIFF', 0); b.writeUInt32LE(bytes - 8, 4); b.write('WAVE', 8);
b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
b.write('data', 36); b.writeUInt32LE(total * 4, 40);
let p = 44;
for (let i = 0; i < total; i++) {
  b.writeInt16LE(Math.max(-1, Math.min(1, L[i] * g)) * 32767 | 0, p);
  b.writeInt16LE(Math.max(-1, Math.min(1, R[i] * g)) * 32767 | 0, p + 2); p += 4;
}
process.stderr.write(`宙 — soundtrack ${SECONDS}s @ ${SR}Hz\n`);
process.stdout.write(b);
