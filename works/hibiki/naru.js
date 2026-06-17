/* 響 — 種ひとつを、短い演奏として WAV に焼く道具。
   `雪` が結晶を SVG に残したように、ここでは響きを音として確かめる。
   残響はノイズではなく、シュレーダー型（コム＋オールパス）の手作り。

     node naru.js [種] [秒] > naru.wav

   依存ゼロ。コアの決定的な波形を並べて鳴らすだけ。 */

import { cast, strike } from './js/core/hibiki.js';

const seed = process.argv[2] || 'kanata';
const SECONDS = Math.min(30, Math.max(4, +(process.argv[3] || 13)));
const SR = 44100;

const e = cast(seed);
const N = e.objects.length;
const total = Math.floor(SR * SECONDS);
const L = new Float32Array(total), R = new Float32Array(total);

/* 物体を t 秒の位置で、強さ vel・定位 pan(-1..1) で置く。 */
function place(obj, t, vel, pan) {
  const w = strike(obj, { sampleRate: SR, velocity: vel, seed: seed + obj.name });
  const at = Math.floor(t * SR);
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  for (let k = 0; k < w.length && at + k < total; k++) {
    L[at + k] += w[k] * gl; R[at + k] += w[k] * gr;
  }
}

/* やわらかな運び：低い物から高い物へ昇り、また降りる。たまに和音。 */
let t = 0.15;
const pan = i => (N <= 1 ? 0 : (i / (N - 1) - 0.5) * 1.4);
const order = [];
for (let i = 0; i < N; i++) order.push(i);
for (let i = N - 2; i >= 1; i--) order.push(i);
let step = 0;
while (t < SECONDS - e.kind.t60 * 0.4) {
  const i = order[step % order.length];
  const vel = 0.55 + 0.4 * Math.abs(Math.sin(step * 1.3));
  place(e.objects[i], t, vel, pan(i));
  if (step % 4 === 3 && i + 2 < N) place(e.objects[i + 2], t + 0.02, vel * 0.7, pan(i + 2)); // 重なり
  t += 0.34 + (step % 3 === 0 ? 0.18 : 0);
  step++;
}

/* シュレーダー残響：並列コム4本＋直列オールパス2本。 */
function comb(buf, delaySec, g) {
  const d = Math.floor(delaySec * SR), out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = buf[i] + (i >= d ? g * out[i - d] : 0);
  return out;
}
function allpass(buf, delaySec, g) {
  const d = Math.floor(delaySec * SR), out = new Float32Array(buf.length);
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i], y = (i >= d ? out[i - d] : 0);
    out[i] = -g * x + y + g * (i >= d ? buf[i - d] : 0);
  }
  return out;
}
function reverb(buf) {
  let s = new Float32Array(buf.length);
  for (const [dl, g] of [[0.0297, 0.78], [0.0371, 0.76], [0.0411, 0.74], [0.0437, 0.72]]) {
    const c = comb(buf, dl, g);
    for (let i = 0; i < s.length; i++) s[i] += c[i] * 0.25;
  }
  s = allpass(s, 0.0050, 0.7);
  s = allpass(s, 0.0017, 0.7);
  return s;
}

const wet = 0.28;
const Lw = reverb(L), Rw = reverb(R);
for (let i = 0; i < total; i++) { L[i] += Lw[i] * wet; R[i] += Rw[i] * wet; }

// 正規化（ピーク 0.92）。
let peak = 0;
for (let i = 0; i < total; i++) { if (Math.abs(L[i]) > peak) peak = Math.abs(L[i]); if (Math.abs(R[i]) > peak) peak = Math.abs(R[i]); }
const g = peak > 0 ? 0.92 / peak : 1;

// 16bit ステレオ WAV を書き出す。
const bytes = 44 + total * 4;
const b = Buffer.alloc(bytes);
b.write('RIFF', 0); b.writeUInt32LE(bytes - 8, 4); b.write('WAVE', 8);
b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
b.write('data', 36); b.writeUInt32LE(total * 4, 40);
let p = 44;
for (let i = 0; i < total; i++) {
  const l = Math.max(-1, Math.min(1, L[i] * g)) * 32767;
  const r = Math.max(-1, Math.min(1, R[i] * g)) * 32767;
  b.writeInt16LE(l | 0, p); b.writeInt16LE(r | 0, p + 2); p += 4;
}
process.stderr.write(`響 — ${e.name}（${e.kind.ja}・${e.scale.ja}旋・${N}個）${SECONDS}s\n`);
process.stdout.write(b);
