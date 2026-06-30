#!/usr/bin/env node
/* ============================================================
   群 — 端末に、夕暮れのむれを描く。
   絵が見えなくても、ここに本物のうねりが立つ。
     node mure.js                その日のむれを一枚
     node mure.js <種>           その種のむれ
     node mure.js <種> --steps 800   もっと飛ばす
     node mure.js <種> --frames 90   うねりを動かす（隼がよぎる）
   ============================================================ */
import { makeFlock, advance, step, order, alarmed } from './js/core/flock.js';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes('--' + n);
const seed = argv.find((a) => !a.startsWith('--') && !['--steps', '--frames'].includes(argv[argv.indexOf(a) - 1]))
  || 'mure-' + new Date().toISOString().slice(0, 10);

const COLS = Number(flag('w', 76)), ROWS = Number(flag('h', 34));   // 文字の格子（縦は ▀ で倍）
const PW = COLS, PH = ROWS * 2;
const fg = (r, g, b, s) => `\x1b[38;2;${r};${g};${b}m${s}\x1b[0m`;
const RESET = '\x1b[0m';
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [lerp(a[0], b[0], t) | 0, lerp(a[1], b[1], t) | 0, lerp(a[2], b[2], t) | 0];

// 夕空：上は藍、地平は橙。鳥は影、おびえは仄かに朱。
const SKY_TOP = [38, 40, 78], SKY_LOW = [196, 120, 86], BIRD = [12, 10, 18], FEAR = [150, 60, 54];

function paint(F) {
  const { p } = F;
  const px = new Array(PW * PH);
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) px[y * PW + x] = mix(SKY_TOP, SKY_LOW, (y / PH) ** 1.4);
  for (const b of F.birds) {
    const cx = Math.min(PW - 1, Math.max(0, (b.x / p.W * PW) | 0));
    const cy = Math.min(PH - 1, Math.max(0, (b.y / p.H * PH) | 0));
    const i = cy * PW + cx;
    const sil = b.alarm > 0.25 ? mix(BIRD, FEAR, Math.min(1, b.alarm)) : BIRD;
    px[i] = mix(px[i], sil, 0.9);
  }
  let out = '';
  for (let y = 0; y < PH; y += 2) {
    out += '  ';
    for (let x = 0; x < PW; x++) {
      const t = px[y * PW + x], bt = px[(y + 1) * PW + x];
      out += `\x1b[38;2;${t[0]};${t[1]};${t[2]};48;2;${bt[0]};${bt[1]};${bt[2]}m▀`;
    }
    out += RESET + '\n';
  }
  return out;
}

// 隼の通り道（リサジュー）。決定的に、むれを横切る。
const falcon = (F, t) => ({ x: F.p.W * (0.5 + 0.42 * Math.sin(t * 0.045)), y: F.p.H * (0.5 + 0.36 * Math.sin(t * 0.063 + 1)) });

const F = makeFlock(seed);
const steps = Number(flag('steps', 500));
advance(F, steps);

if (has('frames')) {
  const frames = Number(flag('frames', 90));
  process.stdout.write('\x1b[2J');
  for (let f = 0; f < frames; f++) {
    step(F, f > 10 ? falcon(F, f) : null);          // しばらく静けさ、やがて隼
    process.stdout.write('\x1b[H' + paint(F)
      + '  ' + fg(210, 200, 220, `群 「${seed}」  整列 ${(order(F) * 100).toFixed(0)}%  おびえ ${(alarmed(F) * 100).toFixed(0)}%`) + '\n');
    const until = Date.now() + 55; while (Date.now() < until) { /* やわらかな間 */ }
  }
  process.exit(0);
}

console.log('\n' + paint(F));
console.log('  ' + fg(214, 206, 226, `群 「${seed}」  ${F.p.N} 羽 ・ ${steps} 刻み`));
console.log('  ' + fg(150, 150, 170, `整列 ${(order(F) * 100).toFixed(0)}%  ・  いちばん近い仲間まで 約 ${(F.p.view).toFixed(0)} 以内`));
console.log('  ' + fg(120, 118, 140, '誰も率いていない。近くの数羽と、三つの約束だけ。') + '\n');
