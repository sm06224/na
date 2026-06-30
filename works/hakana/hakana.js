#!/usr/bin/env node
/* ============================================================
   儚 — 端末に、膜の虹を描く。
   ブラウザの絵が見えなくても、ここに本物の干渉色が出る。
     node hakana.js                その日の膜を一枚
     node hakana.js <種>           その種の膜
     node hakana.js <種> --t 8     8 秒後の姿（黒い膜が育つころ）
     node hakana.js --scale        干渉色の早見表（Newton の色階）
   ============================================================ */
import { makeFilm, meanThickness, blackFraction, thickness } from './js/core/flow.js';
import { buildScale, sample, toByte, colorOfThickness } from './js/core/film.js';
import { renderRGBA, vitality } from './js/core/render.js';

const argv = process.argv.slice(2);
const flag = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const has = (name) => argv.includes('--' + name);
const seed = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--t') || 'hakana-' + new Date().toISOString().slice(0, 10);

const fg = (r, g, b, s) => `\x1b[38;2;${r};${g};${b}m${s}\x1b[0m`;
const px = (r, g, b) => `\x1b[48;2;${r};${g};${b}m`;
const RESET = '\x1b[0m';

const scale = buildScale();

// 半文字ブロック ▀ で、1 文字に上下 2 ピクセルを詰める（縦を倍に）。
function paint(film, t, W, H) {
  const buf = renderRGBA(film, scale, W, H, t);
  let out = '';
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x++) {
      const t0 = (y * W + x) * 4, t1 = ((y + 1) * W + x) * 4;
      const tp = `38;2;${buf[t0]};${buf[t0 + 1]};${buf[t0 + 2]}`;
      const bt = (y + 1 < H) ? `48;2;${buf[t1]};${buf[t1 + 1]};${buf[t1 + 2]}` : '49';
      out += `\x1b[${tp};${bt}m▀`;
    }
    out += RESET + '\n';
  }
  return out;
}

if (has('scale')) {
  // 干渉色の早見表：厚みが増すにつれ、色がどう巡るか。
  console.log('\n  ' + fg(180, 200, 255, '干渉色の早見表 — 厚み(nm) → 目に映る色（Newton の色階）') + '\n');
  const W = 72, maxD = 1500;
  let bar = '  ';
  for (let i = 0; i < W; i++) { const b = toByte(colorOfThickness(i / (W - 1) * maxD)); bar += px(b[0], b[1], b[2]) + ' '; }
  console.log(bar + RESET);
  let ticks = '  ';
  for (let i = 0; i < W; i++) ticks += (i % 12 === 0) ? '^' : ' ';
  console.log(fg(120, 130, 150, ticks));
  let labs = '  ';
  for (let i = 0; i < W; i += 12) { const nm = Math.round(i / (W - 1) * maxD); labs += String(nm).padEnd(12); }
  console.log(fg(120, 130, 150, labs));
  console.log('\n  ' + fg(150, 160, 180, '厚み0＝黒い膜（破れる直前）。薄→黄→紅紫→青→緑…と次数を上がる。') + '\n');
  process.exit(0);
}

const t = Number(flag('t', 0));
const film = makeFilm(seed);
const W = Number(flag('w', 64)), H = Number(flag('h', 56));

console.log('\n' + paint(film, t, W, H));
const v = vitality(film, scale, t);
const mean = meanThickness(film, t), blk = blackFraction(film, t);
console.log('  ' + fg(200, 210, 235, `儚 「${seed}」  t=${t}s`));
console.log('  ' + fg(140, 150, 175,
  `平均の厚み ${mean.toFixed(0)}nm ・ 黒い膜 ${(blk * 100).toFixed(0)}% ・ 彩度 ${(v.maxChroma * 100).toFixed(0)}% ・ 明るさ ${(v.meanLum * 100).toFixed(0)}%`));
console.log('  ' + fg(110, 120, 145, t === 0 ? '（--t を上げると水が切れ、上から黒い膜が育つ）' : '消える直前ほど、色は濃い。') + '\n');
