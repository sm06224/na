/* 雪 — ひとひらを SVG の額に焼く。
   `苔` が庭を、`織` が手紙を SVG に残したように、ここでは種 `kesa`
   （今朝）の結晶を一片、額装して置いていく。誰も開かなくても、
   同じ種なら百年後も同じ華が落ちる——その証として。

     node hitohira.js [種] > hitohira.svg

   依存ゼロ。コアの決定的な結晶を、六角形の集まりとして刷るだけ。 */

import { grow, summary, NAKAYA } from './js/core/yuki.js';

const SQ3 = Math.sqrt(3);
const seed = process.argv[2] || 'kesa';
const W = 720, H = 820;

const s = summary(seed, { R: 42, steps: 4000 });
const cr = s.crystal;

/* 立方座標 (x,y) を平面の点へ（flat-top 軸座標）。 */
const hex = (x, y, size) => ({ px: size * 1.5 * x, py: size * SQ3 * (y + x / 2) });

/* 凍り升の広がりを測り、画面の華の部分に収める縮尺を出す。 */
let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
for (let i = 0; i < cr.N; i++) {
  if (!cr.frozen[i]) continue;
  const { px, py } = hex(cr.xs[i], cr.ys[i], 1);
  if (px < minx) minx = px; if (px > maxx) maxx = px;
  if (py < miny) miny = py; if (py > maxy) maxy = py;
}
const fieldH = 560;
const size = Math.min((W * 0.84) / ((maxx - minx) + 2), (fieldH * 0.84) / ((maxy - miny) + 2));
const cx = W / 2 - size * (minx + maxx) / 2;
const cy = 40 + fieldH / 2 - size * (miny + maxy) / 2;
const r = size * 0.62;

function hexPoly(px, py) {
  let p = '';
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k;
    p += (px + r * Math.cos(a)).toFixed(1) + ',' + (py + r * Math.sin(a)).toFixed(1) + ' ';
  }
  return p.trim();
}

let cells = '';
for (let i = 0; i < cr.N; i++) {
  if (!cr.frozen[i]) continue;
  const { px, py } = hex(cr.xs[i], cr.ys[i], size);
  const k = Math.min(1, (cr.s[i] - 1) * 0.55 + 0.35);
  const R = 150 + 80 * k, G = 195 + 55 * k, B = 235 + 20 * k;
  const a = (0.4 + 0.5 * k).toFixed(2);
  cells += `<polygon points="${hexPoly(cx + px, cy + py)}" fill="rgb(${R | 0},${G | 0},${B | 0})" fill-opacity="${a}"/>`;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-sans-serif,system-ui,sans-serif">
  <defs>
    <radialGradient id="sky" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="#101c2e"/><stop offset="100%" stop-color="#05080f"/>
    </radialGradient>
    <radialGradient id="core" cx="50%" cy="${((cy / H) * 100).toFixed(1)}%" r="22%">
      <stop offset="0%" stop-color="#d2ebff" stop-opacity="0.12"/><stop offset="100%" stop-color="#d2ebff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="14" fill="none" stroke="#1b2738"/>
  <circle cx="${W / 2}" cy="${cy}" r="${(size * 7).toFixed(0)}" fill="url(#core)"/>
  <g style="mix-blend-mode:screen">${cells}</g>
  <text x="${W / 2}" y="650" text-anchor="middle" fill="#bfe0ff" font-size="26" letter-spacing="3">${s.name}</text>
  <text x="${W / 2}" y="680" text-anchor="middle" fill="#7fb4e6" font-size="13">${s.habitJa} ・ ${s.temp.toFixed(0)}℃ ・ 過飽和 ${(s.humid * 100) | 0}% ・ ${s.mei}</text>
  <text x="${W / 2}" y="714" text-anchor="middle" fill="#9fb4cf" font-size="13.5">${s.letter}</text>
  <text x="${W / 2}" y="766" text-anchor="middle" fill="#6c7f9c" font-size="12.5">${NAKAYA}</text>
  <text x="${W / 2}" y="790" text-anchor="middle" fill="#46566c" font-size="10.5" letter-spacing="2">na / works / yuki — 種 ${seed}</text>
</svg>`;
process.stdout.write(svg + '\n');
