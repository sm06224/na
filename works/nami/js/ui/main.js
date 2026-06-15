/* 波のへそ — 触れれば落とし、長く押すほど大きな波、待てば雨。一歩ずつ進めて描く。 */

import { Water } from '../core/water.js';
import { fitView, drawWater } from './render.js';
import { plip, startCharge, updateCharge, stopCharge } from './audio.js';

const $ = id => document.getElementById(id);
const canvas = $('pond');
const ctx = canvas.getContext('2d');
const view = {};

const SIM_H = 150;                 // 格子の高さ（幅は画面の比で決める）
const HOLD_MIN = 70;               // これより短い押しは「ちょん」
const HOLD_FULL = 1200;            // これだけ押せば最大の波（ms）
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
  if (keep && keep.w === simW && keep.h === SIM_H) { water.cur.set(keep.cur); water.prev.set(keep.prev); }
}

/* ----- 画面の座標 → 格子の座標 ----- */
function toSim(px, py) {
  return { x: px / view.cssW * water.w, y: py / view.cssH * water.h };
}
function dropAt(px, py, amp, radius, sound, strength) {
  const { x, y } = toSim(px, py);
  water.drop(x, y, radius, amp);
  if (sound && !muted) plip(strength);
}
/* 押した長さ（ms）→ 0..1 */
function holdT(ms) {
  return Math.max(0, Math.min(1, (ms - HOLD_MIN) / (HOLD_FULL - HOLD_MIN)));
}

/* ----- 指（マウス・タッチ・ペンを一手に） ----- */
const presses = new Map();         // pointerId → { t0, x, y, dragged }
let charging = null;               // いま「ためて」いる pointerId

canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture?.(e.pointerId);
  presses.set(e.pointerId, { t0: performance.now(), x: e.clientX, y: e.clientY, dragged: false });
  lastTouch = performance.now();
  dropAt(e.clientX, e.clientY, 0.22, water.w * 0.012, false);   // 触れたしるし（小さく）
  charging = e.pointerId;
  if (!muted) startCharge();
});

canvas.addEventListener('pointermove', e => {
  const p = presses.get(e.pointerId);
  if (!p) return;
  lastTouch = performance.now();
  const d = Math.hypot(e.clientX - p.x, e.clientY - p.y);
  if (d < view.cssW * 0.012) return;            // 近すぎる点は間引く
  if (!p.dragged && charging === e.pointerId) { charging = null; stopCharge(); }  // なぞり始めたら「ため」を解く
  p.dragged = true; p.x = e.clientX; p.y = e.clientY;
  dropAt(e.clientX, e.clientY, 0.4, water.w * 0.013, false);    // 航跡
});

function endPress(e) {
  const p = presses.get(e.pointerId);
  if (!p) return;
  presses.delete(e.pointerId);
  lastTouch = performance.now();
  if (charging === e.pointerId) { charging = null; stopCharge(); }
  if (p.dragged) return;                         // なぞりは、すでに航跡を残した
  const t = holdT(performance.now() - p.t0);      // 押した長さ → 0..1
  const amp = 0.5 + t * 2.0;                       // 長いほど大きく
  const radius = water.w * (0.018 + t * 0.05);     // 長いほど広く
  dropAt(p.x, p.y, amp, radius, true, t);          // 大波＋深い水音
}
canvas.addEventListener('pointerup', endPress);
canvas.addEventListener('pointercancel', endPress);

/* ----- 待てば、雨 ----- */
let nextRain = 0;
function rain(now) {
  if (!started || now < nextRain) return;
  nextRain = now + 900 + Math.random() * 1600;
  if (now - lastTouch < 2600 || presses.size) return;   // 触っているうちは降らせない
  const px = Math.random() * view.cssW, py = Math.random() * view.cssH;
  dropAt(px, py, 0.2 + Math.random() * 0.2, water.w * 0.01, !muted, 0.12);
}

/* ----- 鼓動 ----- */
function frame(now) {
  requestAnimationFrame(frame);
  // 「ため」の含み音を、押した長さに合わせて深くする
  if (charging != null) {
    const p = presses.get(charging);
    if (p) updateCharge(holdT(now - p.t0));
  }
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
  if (muted) stopCharge(); else plip(0.3);
});

window.addEventListener('resize', fit);

/* ----- ひらく ----- */
$('bOpen').addEventListener('click', () => {
  $('intro').classList.add('gone');
  $('bar').hidden = false;
  started = true;
  lastTouch = performance.now();
  dropAt(view.cssW / 2, view.cssH * 0.42, 1, water.w * 0.03, !muted, 0.5);   // はじまりの一滴
});

fit();
requestAnimationFrame(frame);
