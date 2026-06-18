/* 宙 — タイトル画面を SVG のポスターに焼く（静止画の置き土産・確認用）。
   コアの星空と投影をそのまま使う。   node poster.js > poster.svg */

import { makeStars, project, STAR_FAR } from './js/core/space.js';

const W = 960, H = 600, cx = W / 2, cy = H / 2;
const stars = makeStars(700, 'sora');

let dots = '';
for (const s of stars) {
  const p = project(s.x, s.y, s.z, 320);
  if (!p) continue;
  const x = cx + p.x, y = cy + p.y;
  if (x < 0 || x > W || y < 0 || y > H) continue;
  const depth = 1 - s.z / STAR_FAR;
  const r = (0.4 + depth * 2.4).toFixed(2);
  const a = (0.2 + depth * 0.8).toFixed(2);
  const b = (215 + 40 * depth) | 0;
  dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="rgb(${(200 + 50 * depth) | 0},${b},255)" fill-opacity="${a}"/>`;
}

// コッパーバー風の帯（飾り）
let bars = '';
for (let i = 0; i < 5; i++) {
  const yy = H * 0.5 + (i - 2) * 16;
  const hue = (i * 40 + 200) % 360;
  bars += `<rect x="0" y="${yy - 7}" width="${W}" height="14" fill="hsl(${hue} 90% 60%)" opacity="0.10"/>`;
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-sans-serif,system-ui,sans-serif">
  <defs><radialGradient id="bg" cx="50%" cy="42%" r="75%">
    <stop offset="0%" stop-color="#0a1024"/><stop offset="100%" stop-color="#02030a"/>
  </radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${bars}
  <g>${dots}</g>
  <text x="${cx}" y="${H * 0.43}" text-anchor="middle" dominant-baseline="middle" font-size="180" font-weight="800" fill="#dff1ff" style="filter:drop-shadow(0 0 24px rgba(110,200,255,.7))">宙</text>
  <text x="${cx}" y="${H * 0.62}" text-anchor="middle" font-size="34" letter-spacing="18" fill="#9fc7e6" font-family="ui-monospace,monospace">S O R A</text>
  <text x="${cx}" y="${H * 0.70}" text-anchor="middle" font-size="16" fill="#8aa6c4">a space megademo — 無から</text>
  <text x="${cx}" y="${H - 24}" text-anchor="middle" font-size="12" fill="#5a7090" font-family="ui-monospace,monospace">na / works / sora — greetings to every stripe in the rock</text>
</svg>`;
process.stdout.write(svg + '\n');
