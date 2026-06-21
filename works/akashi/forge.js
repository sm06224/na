/* 証を鍛える。入力（既定は「無」＝空文字）から、紋章(SVG)と旋律(WAV)を打ち出す。
     node forge.js            # 無の証：akashi.svg / akashi.wav
     node forge.js "言葉"     # その言葉の証
   コアと同じく決定的。同じ入力なら、寸分たがわぬ同じ証。 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { akashi, midiToHz } from './js/core/akashi.js';

const here = dirname(fileURLToPath(import.meta.url));
const input = process.argv[2] ?? '';
const a = akashi(input);

/* ---- 紋章 → SVG（左右対称の印） ---- */
function sigilSVG(a) {
  const { n, cells, hue, hue2 } = a.sigil;
  const cell = 54, pad = 60, W = n * cell + pad * 2;
  const L = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W + 70}" viewBox="0 0 ${W} ${W + 70}" role="img" aria-label="証 — ${a.input || '無'} の紋章">`];
  L.push('<defs>');
  L.push(`<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 75% 64%)"/><stop offset="1" stop-color="hsl(${hue2} 70% 56%)"/></linearGradient>`);
  L.push(`<radialGradient id="aura" cx="0.5" cy="0.46" r="0.6"><stop offset="0" stop-color="hsl(${hue} 60% 22%)"/><stop offset="1" stop-color="#0a0910"/></radialGradient>`);
  L.push('</defs>');
  L.push(`<rect width="${W}" height="${W + 70}" fill="#0a0910"/>`);
  L.push(`<rect x="14" y="14" width="${W - 28}" height="${W - 28}" rx="18" fill="url(#aura)" stroke="hsl(${hue} 50% 40%)" stroke-opacity="0.5" stroke-width="1.5"/>`);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!cells[r][c]) continue;
    const x = pad + c * cell, y = pad + r * cell;
    L.push(`<rect x="${x + 4}" y="${y + 4}" width="${cell - 8}" height="${cell - 8}" rx="9" fill="url(#g)"/>`);
  }
  const label = a.input ? a.input : '無';
  L.push(`<text x="${W / 2}" y="${W + 34}" font-family="ui-monospace,monospace" font-size="13" fill="hsl(${hue} 30% 70%)" text-anchor="middle" letter-spacing="2">${a.hex.slice(0, 32)}</text>`);
  L.push(`<text x="${W / 2}" y="${W + 54}" font-family="ui-monospace,monospace" font-size="13" fill="hsl(${hue} 30% 55%)" text-anchor="middle" letter-spacing="2">${a.hex.slice(32)}</text>`);
  L.push('</svg>');
  return L.join('\n');
}

/* ---- 旋律 → WAV（やわらかな鐘の音、八つ） ---- */
function tuneWAV(a) {
  const SR = 44100, beat = 0.42;
  const total = a.tune.reduce((s, n) => s + n.dur, 0) * beat + 1.2;
  const N = Math.floor(total * SR), buf = new Float32Array(N);
  let t0 = 0;
  for (const note of a.tune) {
    const f = midiToHz(note.midi), at = Math.floor(t0 * beat * SR), len = Math.floor((note.dur * beat + 0.9) * SR);
    for (let k = 0; k < len && at + k < N; k++) {
      const t = k / SR, env = Math.exp(-t * 3.2);
      const s = (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 2 * t) * Math.exp(-t * 5) + 0.25 * Math.sin(2 * Math.PI * f * 3 * t) * Math.exp(-t * 7));
      buf[at + k] += s * env * 0.3;
    }
    t0 += note.dur;
  }
  // ささやかな残響
  const D = (0.09 * SR) | 0;
  for (let i = D; i < N; i++) buf[i] += buf[i - D] * 0.28;
  let pk = 0; for (const v of buf) if (Math.abs(v) > pk) pk = Math.abs(v);
  const g = pk > 0 ? 0.95 / pk : 1;
  const bytes = 44 + N * 2, b = Buffer.alloc(bytes);
  b.write('RIFF', 0); b.writeUInt32LE(bytes - 8, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(N * 2, 40);
  let p = 44; for (let i = 0; i < N; i++) { b.writeInt16LE(Math.max(-1, Math.min(1, buf[i] * g)) * 32767 | 0, p); p += 2; }
  return b;
}

writeFileSync(join(here, 'akashi.svg'), sigilSVG(a));
writeFileSync(join(here, 'akashi.wav'), tuneWAV(a));
process.stderr.write(`証 — 「${a.input || '無'}」\n  指紋 ${a.hex}\n  読み ${a.name}（仮）\n  → akashi.svg / akashi.wav\n`);
