#!/usr/bin/env node
/* ============================================================
   斑 — 端末に、獣の肌を育てる。
   ブラウザの絵が見えなくても、ここに本物の反応拡散が走る。
     node madara.js                その日の肌を一枚
     node madara.js <種>           その種の肌
     node madara.js <種> --steps 8000   もっと育てる
     node madara.js --map          (f,k) 位相空間の地図（どこにどの肌が棲むか）
   ============================================================ */
import { grow, makeField, advance, BIOMES } from './js/core/grayscott.js';
import { identify } from './js/core/classify.js';
import { makePalette, renderRGBA } from './js/core/render.js';

const argv = process.argv.slice(2);
const flag = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const has = (name) => argv.includes('--' + name);

const fg = (r, g, b, s) => `\x1b[38;2;${r};${g};${b}m${s}\x1b[0m`;
const RESET = '\x1b[0m';

// 半文字ブロック ▀ で、1 文字に上下 2 ピクセルを詰める（縦を倍に）。
function paint(F, palette) {
  const { N } = F, buf = renderRGBA(F, palette);
  let out = '';
  for (let y = 0; y < N; y += 2) {
    out += '  ';
    for (let x = 0; x < N; x++) {
      const t0 = (y * N + x) * 4, t1 = ((y + 1) * N + x) * 4;
      const tp = `38;2;${buf[t0]};${buf[t0 + 1]};${buf[t0 + 2]}`;
      const bt = (y + 1 < N) ? `48;2;${buf[t1]};${buf[t1 + 1]};${buf[t1 + 2]}` : '49';
      out += `\x1b[${tp};${bt}m▀`;
    }
    out += RESET + '\n';
  }
  return out;
}

const GLYPH = { spots: '斑', stripes: '縞', maze: '迷', holes: '孔', void: '無' };

if (has('map')) {
  // 位相空間の地図：どの (f,k) に、どの肌が棲むか。
  console.log('\n  ' + fg(210, 196, 168, '斑の地図 — 二つの数 (f・k) が、肌の運命を決める') + '\n');
  const fs = [], ks = [];
  for (let i = 0; i <= 24; i++) fs.push(0.012 + i / 24 * (0.064 - 0.012));
  for (let j = 0; j <= 14; j++) ks.push(0.055 + j / 14 * (0.066 - 0.055));
  const mark = { spots: fg(214, 180, 130, '·'), stripes: fg(150, 96, 40, '/'),
                 maze: fg(120, 200, 180, '#'), holes: fg(120, 130, 150, 'o'),
                 void: fg(60, 60, 70, ' ') };
  for (let j = ks.length - 1; j >= 0; j--) {
    let row = '  ' + fg(110, 120, 140, ks[j].toFixed(3)) + ' ';
    for (let i = 0; i < fs.length; i++) {
      const F = makeField('map', { N: 64 }); F.f = fs[i]; F.k = ks[j]; advance(F, 2500);
      row += mark[identify(F).coat];
    }
    console.log(row);
  }
  console.log('  ' + fg(110, 120, 140, '  k\\f  ' + fs[0].toFixed(3) + ' '.repeat(fs.length - 12) + fs[fs.length - 1].toFixed(3)));
  console.log('\n  ' + [['·', '斑', 214, 180, 130], ['/', '縞', 150, 96, 40],
    ['#', '迷路', 120, 200, 180], ['o', '孔', 150, 160, 180]]
    .map(([c, n, r, g, b]) => fg(r, g, b, c + ' ' + n)).join('   ') + '\n');
  process.exit(0);
}

const seed = argv.find((a) => !a.startsWith('--') &&
  argv[argv.indexOf(a) - 1] !== '--steps') || 'madara-' + new Date().toISOString().slice(0, 10);
const steps = Number(flag('steps', 5000));
const N = Number(flag('n', 72));

const F = grow(seed, steps, { N });
const palette = makePalette(seed);
const id = identify(F);

console.log('\n' + paint(F, palette));
console.log('  ' + fg(232, 214, 178, `斑 「${seed}」  ${GLYPH[id.coat]} ${id.coat}`));
console.log('  ' + fg(210, 196, 168, `${id.kana}（${id.en}）の肌`));
console.log('  ' + fg(150, 140, 120, id.note));
console.log('  ' + fg(110, 110, 120,
  `f=${F.f.toFixed(4)} k=${F.k.toFixed(4)} ・ 覆い ${(id.coverage * 100).toFixed(0)}% ・ 斑 ${id.fg} ・ ${steps} 刻み`));
console.log('  ' + fg(95, 95, 105, '誰も模様を描いていない。二つの物質が追いかけあっただけ。') + '\n');
