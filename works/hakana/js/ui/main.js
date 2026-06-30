/* ============================================================
   儚 — 膜を張り、息をかけ、消えるまでを見る。
   核（flow・film・render）が出した干渉色のバッファを、低解像で描き、
   なめらかに引き伸ばし、ブルームでほのかに発光させる。
   なでれば膜が寄り、ふれれば破れて、また張る。すべてこの端末の中だけ。
   ============================================================ */
import { makeFilm, breathe, blackFraction } from '../core/flow.js';
import { buildScale } from '../core/film.js';
import { renderRGBA } from '../core/render.js';

const $ = (id) => document.getElementById(id);
const canvas = $('film'), ctx = canvas.getContext('2d');
const scale = buildScale();

let W = 1, H = 1, dpr = 1, RW = 1, RH = 1;
let off, offctx, imgdata;
let film, seed, t = 0, last = 0, raf = 0, running = false;
const SPEED = 1.0;                       // 時の進み（消えるまで ~12–16 秒）

// 読みやすい種をひとつ拵える（共有できる名前）。
const SYL = ['ka', 'mi', 'na', 're', 'su', 'ya', 'ko', 'ha', 'ru', 'mo', 'shi', 'ra', 'to', 'wa', 'no', 'me'];
function coinSeed() {
  let s = '';
  for (let i = 0; i < 3; i++) s += SYL[(Math.random() * SYL.length) | 0];
  return s;
}

function setSeed(s) {
  seed = s;
  $('seedval').textContent = '種  ' + seed;
  history.replaceState(null, '', `${location.pathname}${location.search}#h=${encodeURIComponent(seed)}`);
}

function resize() {
  W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rs = Math.min(1, 360 / Math.max(W, H));     // 物理は低解像で。引き伸ばしてやわらかく。
  RW = Math.max(2, Math.round(W * rs)); RH = Math.max(2, Math.round(H * rs));
  off = document.createElement('canvas'); off.width = RW; off.height = RH;
  offctx = off.getContext('2d');
  imgdata = offctx.createImageData(RW, RH);
}

function newFilm(s) {
  setSeed(s || coinSeed());
  film = makeFilm(seed);
  t = 0; last = 0;
}

// 息・指のあとは、ゆっくり消える。
function fadeBreaths() {
  const b = film.breaths;
  for (let i = b.length - 1; i >= 0; i--) { b[i].amp *= 0.95; if (Math.abs(b[i].amp) < 4) b.splice(i, 1); }
}

function draw() {
  const buf = renderRGBA(film, scale, RW, RH, t);
  imgdata.data.set(buf);
  offctx.putImageData(imgdata, 0, 0);
  ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(off, 0, 0, W, H);
  // ブルーム：ぼかして重ね、膜をほのかに発光させる。
  ctx.globalCompositeOperation = 'lighter'; ctx.filter = 'blur(16px)'; ctx.globalAlpha = 0.45;
  ctx.drawImage(off, 0, 0, W, H);
  ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

function frame(now) {
  if (!running) return;
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
  t += dt * SPEED;
  fadeBreaths();
  draw();
  $('clock') && ($('clock').textContent = t.toFixed(1) + 's');
  if (blackFraction(film, t) > 0.84) { burst(); newFilm(); }   // ほとんど黒い膜＝破れ。また張る。
  raf = requestAnimationFrame(frame);
}

function start() {
  if (running) return;
  running = true; last = 0; raf = requestAnimationFrame(frame);
}

let toastT = 0;
function toast(msg) {
  const el = $('toast'); el.hidden = false; el.textContent = msg; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1600);
}

function burst() { toast('ぱちん'); }

// ── 触れる ───────────────────────────────────────────────
function atEvent(e) {
  const x = (e.touches ? e.touches[0].clientX : e.clientX) / W;
  const y = (e.touches ? e.touches[0].clientY : e.clientY) / H;
  return [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))];
}
let moved = false;
canvas.addEventListener('pointerdown', () => { moved = false; });
canvas.addEventListener('pointermove', (e) => {
  if (e.pressure > 0 || e.buttons) { moved = true; const [x, y] = atEvent(e); breathe(film, x, y, 200, 0.07); }
  else { const [x, y] = atEvent(e); breathe(film, x, y, 70, 0.06); }   // そっとなでる
});
canvas.addEventListener('pointerup', (e) => { if (!moved) { burst(); newFilm(); } });

// ── ボタン ───────────────────────────────────────────────
$('bOpen').addEventListener('click', () => { $('intro').classList.add('gone'); $('bar').hidden = false; start(); });
$('bAgain').addEventListener('click', () => newFilm());
$('bShare').addEventListener('click', async () => {
  const url = location.href;
  try { await navigator.clipboard.writeText(url); toast('この膜の在りかを写しました'); }
  catch { toast(url); }
});
window.addEventListener('resize', resize);

// ── 立ち上げ ─────────────────────────────────────────────
resize();
const m = String(location.hash || '').match(/[#&]h=([^&]+)/);
newFilm(m ? decodeURIComponent(m[1]) : coinSeed());
draw();   // 序章の背後で一枚見せておく

// テスト用の小さな窓
window.__hakana = {
  step: (dt = 0.2) => { t += dt; fadeBreaths(); draw(); return t; },
  breathe: (x, y) => breathe(film, x, y),
  black: () => blackFraction(film, t),
  seed: () => seed, newFilm, start,
};
start();
