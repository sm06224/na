/* 波のへそ — 触れれば落とし、待てば雨、いつも一歩ずつ進めて描く。 */

import { Water } from '../core/water.js';
import { fitView, drawWater } from './render.js';
import { plip } from './audio.js';

const $ = id => document.getElementById(id);
const canvas = $('pond');
const ctx = canvas.getContext('2d');
const view = {};

const SIM_H = 150;                 // 格子の高さ（幅は画面の比で決める）
let water = null;
let muted = false;
let lastTouch = -1e9;
let started = false;

/* ----- 画面合わせ：格子を作り直して水面を張る ----- */
function fit() {
  const dpr = window.devicePixelRatio || 1;
  const cssW = window.innerWidth, cssH = window.innerHeight;
  canvas.width = cssW * dpr; canvas.height = cssH * dpr;
  canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const simW = Math.max(120, Math.min(320, Math.round(SIM_H * cssW / cssH)));
  const keep = water;
  water = new Water(simW, SIM_H);
  fitView(view, water, cssW, cssH);
  // 大きさが同じなら、それまでの波をそのまま引き継ぐ
  if (keep && keep.w === simW && keep.h === SIM_H) { water.cur.set(keep.cur); water.prev.set(keep.prev); }
}

/* ----- 画面の座標 → 格子の座標 ----- */
function toSim(px, py) {
  return { x: px / view.cssW * water.w, y: py / view.cssH * water.h };
}

/* ----- 波紋を落とす ----- */
function dropAt(px, py, amp, radius, sound) {
  const { x, y } = toSim(px, py);
  water.drop(x, y, radius ?? water.w * 0.02, amp);
  if (sound && !muted) plip(Math.min(1, amp));
}

/* ----- 指：触れると生まれ、なぞると航跡になる ----- */
let dragging = false, lastDx = 0, lastDy = 0;
function down(px, py) {
  dragging = true; lastTouch = performance.now();
  lastDx = px; lastDy = py;
  dropAt(px, py, 0.95, water.w * 0.022, true);
}
function move(px, py) {
  if (!dragging) return;
  lastTouch = performance.now();
  const d = Math.hypot(px - lastDx, py - lastDy);
  if (d < view.cssW * 0.012) return;            // 近すぎる点は間引く
  lastDx = px; lastDy = py;
  dropAt(px, py, 0.4, water.w * 0.013, false);   // 航跡はそっと
}
function up() { dragging = false; }

canvas.addEventListener('mousedown', e => down(e.clientX, e.clientY));
canvas.addEventListener('mousemove', e => move(e.clientX, e.clientY));
window.addEventListener('mouseup', up);
canvas.addEventListener('touchstart', e => { for (const t of e.touches) down(t.clientX, t.clientY); }, { passive: true });
canvas.addEventListener('touchmove', e => { for (const t of e.touches) move(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
window.addEventListener('touchend', up);

/* ----- 待てば、雨 ----- */
let nextRain = 0;
function rain(now) {
  if (!started) return;
  if (now < nextRain) return;
  nextRain = now + 900 + Math.random() * 1600;
  if (now - lastTouch < 2600) return;            // 触っているうちは降らせない
  const px = Math.random() * view.cssW, py = Math.random() * view.cssH;
  dropAt(px, py, 0.22 + Math.random() * 0.2, water.w * 0.01, !muted);
}

/* ----- 鼓動 ----- */
function frame(now) {
  requestAnimationFrame(frame);
  if (water) {
    water.step(); water.step();                  // 一こまに二歩、波を活かす
    rain(now);
    drawWater(ctx, water, view, now);
  }
}

/* ----- ボタン ----- */
$('bStill').addEventListener('click', () => { if (water) water.reset(); });
$('bMute').addEventListener('click', () => {
  muted = !muted;
  $('bMute').textContent = muted ? '音を出す' : '音を消す';
  if (!muted) plip(0.3);
});

window.addEventListener('resize', fit);

/* ----- ひらく ----- */
$('bOpen').addEventListener('click', () => {
  $('intro').classList.add('gone');
  $('bar').hidden = false;
  started = true;
  lastTouch = performance.now();
  // はじまりの一滴
  dropAt(view.cssW / 2, view.cssH * 0.42, 1, water.w * 0.03, !muted);
});

fit();
requestAnimationFrame(frame);
