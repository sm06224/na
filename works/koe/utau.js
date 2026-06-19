/* 声 — 合唱に、ことばのない歌を歌わせて WAV に焼く。
   `響` の naru.js と同じ流儀。コア(koe.js)の sing/choir/phrase をそのまま使う。
     node utau.js [種] [小節] > utau.wav
*/
import { sing, choir, phrase, degreeHz, midiToHz, VOWELS, scaleVowel } from './js/core/koe.js';

const seed = process.argv[2] || 'hajimari';
const BARS = Math.min(16, Math.max(1, +(process.argv[3] || 4)));
const SR = 44100, BPM = 96, beat = 60 / BPM;

const c = choir(seed);
const notes = phrase(seed, BARS);
const totalBeats = notes.reduce((a, n) => a + n.dur, 0);
const total = Math.floor((totalBeats * beat + 1.5) * SR);
const L = new Float32Array(total), R = new Float32Array(total);

let tBeat = 0;
for (const note of notes) {
  const at = Math.floor(tBeat * beat * SR);
  const secs = note.dur * beat * 0.96;
  for (const s of c.singers) {
    const f0 = degreeHz(c.rootMidi, note.degree) * Math.pow(2, s.detune / 1200);
    const vowel = scaleVowel(VOWELS[note.vowel], s.tract);
    const w = sing({ f0, vowel, seconds: secs, sampleRate: SR, vibrato: s.vibR, depth: 0.007, seed: seed + s.pan + note.degree });
    const gl = Math.cos((s.pan + 1) * Math.PI / 4) / c.singers.length;
    const gr = Math.sin((s.pan + 1) * Math.PI / 4) / c.singers.length;
    for (let k = 0; k < w.length && at + k < total; k++) { L[at + k] += w[k] * gl; R[at + k] += w[k] * gr; }
  }
  tBeat += note.dur;
}

/* シュレーダー残響（教会の余韻を少し）。 */
function comb(b, d, g) { const D = (d * SR) | 0, o = new Float32Array(b.length); for (let i = 0; i < b.length; i++) o[i] = b[i] + (i >= D ? g * o[i - D] : 0); return o; }
function allpass(b, d, g) { const D = (d * SR) | 0, o = new Float32Array(b.length); for (let i = 0; i < b.length; i++) { const x = b[i], y = i >= D ? o[i - D] : 0; o[i] = -g * x + y + g * (i >= D ? b[i - D] : 0); } return o; }
function reverb(b) { let s = new Float32Array(b.length); for (const [d, g] of [[0.031, 0.8], [0.037, 0.78], [0.041, 0.76], [0.044, 0.74]]) { const c = comb(b, d, g); for (let i = 0; i < s.length; i++) s[i] += c[i] * 0.25; } s = allpass(s, 0.005, 0.7); s = allpass(s, 0.0017, 0.7); return s; }
const wet = 0.3, Lw = reverb(L), Rw = reverb(R);
for (let i = 0; i < total; i++) { L[i] += Lw[i] * wet; R[i] += Rw[i] * wet; }

let peak = 0; for (let i = 0; i < total; i++) { if (Math.abs(L[i]) > peak) peak = Math.abs(L[i]); if (Math.abs(R[i]) > peak) peak = Math.abs(R[i]); }
const g = peak > 0 ? 0.95 / peak : 1;
const bytes = 44 + total * 4, b = Buffer.alloc(bytes);
b.write('RIFF', 0); b.writeUInt32LE(bytes - 8, 4); b.write('WAVE', 8);
b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
b.write('data', 36); b.writeUInt32LE(total * 4, 40);
let p = 44;
for (let i = 0; i < total; i++) { b.writeInt16LE(Math.max(-1, Math.min(1, L[i] * g)) * 32767 | 0, p); b.writeInt16LE(Math.max(-1, Math.min(1, R[i] * g)) * 32767 | 0, p + 2); p += 4; }
process.stderr.write(`声 — ${c.name} の合唱（${c.singers.length}人）が ${notes.length} 音を歌う\n`);
process.stdout.write(b);
