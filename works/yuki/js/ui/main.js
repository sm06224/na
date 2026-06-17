/* 雪 — 操作。種を入れて、ひとひらを降らせる。
   結晶が中心から外へ凍りついていくのを眺め、空からの手紙を読む。 */

import { grow, summary } from '../core/yuki.js';
import { drawSky, drawCrystal } from './render.js';

const $ = id => document.getElementById(id);
const cv = $('snow'), ctx = cv.getContext('2d');

const S = { seed: 'hatsuyuki', cr: null, reveal: 0, raf: 0, flakes: [] };

function fit() {
  const r = cv.parentElement.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(280, Math.floor(r.width * dpr));
  cv.height = Math.max(320, Math.floor((r.height || 540) * dpr));
  cv.style.width = r.width + 'px';
  cv.style.height = (r.height || 540) + 'px';
}

/* 背景の舞い落ちる雪（決定性とは無縁の、ただの情景）。 */
function seedFlakes() {
  S.flakes = [];
  const n = Math.floor(cv.width * cv.height / 26000);
  for (let i = 0; i < n; i++) S.flakes.push({
    x: Math.random() * cv.width, y: Math.random() * cv.height,
    r: 0.6 + Math.random() * 1.8, a: 0.08 + Math.random() * 0.22,
    vy: 0.2 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 0.3,
  });
}
function stepFlakes() {
  for (const f of S.flakes) {
    f.y += f.vy; f.x += f.vx;
    if (f.y > cv.height + 2) { f.y = -2; f.x = Math.random() * cv.width; }
  }
}

function paint() {
  drawSky(ctx, cv.width, cv.height, S.flakes);
  if (S.cr) drawCrystal(ctx, cv.width, cv.height, S.cr, S.reveal);
}

/* 結晶化の演出：中心から外へ、凍りついていく。やがて静かに舞いつづける。 */
function animate() {
  cancelAnimationFrame(S.raf);
  const t0 = performance.now();
  const dur = 1700;
  const loop = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    S.reveal = k < 1 ? 1 - Math.pow(1 - k, 3) : 1;   // ease-out
    stepFlakes();
    paint();
    S.raf = requestAnimationFrame(loop);              // 雪は降りつづける
  };
  S.raf = requestAnimationFrame(loop);
}

function tell() {
  const s = summary(S.seed, { R: 60, steps: 4000 });
  S.cr = s.crystal;
  $('name').textContent = s.name;
  $('habit').textContent = s.habitJa;
  $('weather').textContent = `${s.temp.toFixed(0)}℃ ・ 過飽和 ${(s.humid * 100 | 0)}%`;
  $('letter').textContent = s.letter;
  $('mei').textContent = s.mei;
  history.replaceState(null, '', `${location.pathname}${location.search}#s=${encodeURIComponent(S.seed)}`);
}

function fall(seed) {
  S.seed = (seed ?? $('seed').value ?? '').trim() || 'hatsuyuki';
  $('seed').value = S.seed;
  fit(); seedFlakes(); tell(); animate();
}

function share() {
  const url = location.href.split('#')[0] + '#s=' + encodeURIComponent(S.seed);
  navigator.clipboard?.writeText(url).then(() => {
    const b = $('share'); const t = b.textContent; b.textContent = 'うつした';
    setTimeout(() => (b.textContent = t), 1200);
  });
}

$('fall').onclick = () => fall();
$('seed').addEventListener('keydown', e => { if (e.key === 'Enter') fall(); });
$('another').onclick = () => fall('雪' + Math.floor(Math.random() * 1e6));
$('share').onclick = share;
window.addEventListener('resize', () => { fit(); seedFlakes(); paint(); });

const m = String(location.hash || '').match(/[#&]s=([^&]+)/);
fall(m ? decodeURIComponent(m[1]) : 'hatsuyuki');
