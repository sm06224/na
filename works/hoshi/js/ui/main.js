/* 星のへそ — 種を選び、空をひらき、星座にふれる。 */

import { makeSky, WIDTH } from '../core/sky.js';
import { drawSky, pickConstellation } from './render.js';

const $ = id => document.getElementById(id);
const canvas = $('sky');
const ctx = canvas.getContext('2d');

let sky = null;
let selected = null;
const view = { w: 0, h: 0, scale: 1, offX: 0, offY: 0, baseOffX: 0, baseOffY: 0 };
let drift = 0, driftDir = 1;
let dragging = false, moved = false, lastX = 0, lastY = 0, downX = 0, downY = 0;

/* ----- 種 ----- */
function seedFromHash() {
  const m = String(location.hash || '').match(/[#&]s=(\d+)/);
  return m ? (Number(m[1]) >>> 0) : null;
}
function setSeed(seed) {
  sky = makeSky(seed >>> 0);
  selected = null;
  $('card').hidden = true;
  $('seedval').textContent = `種 ${sky.seed}　・　${sky.constellations.length} 星座　・　一番星 ${sky.leadStar.name}`;
  history.replaceState(null, '', `${location.pathname}${location.search}#s=${sky.seed}`);
  fit(true);
}

/* ----- 画面合わせ ----- */
function fit(recenter = false) {
  const dpr = window.devicePixelRatio || 1;
  view.w = window.innerWidth; view.h = window.innerHeight;
  canvas.width = view.w * dpr; canvas.height = view.h * dpr;
  canvas.style.width = view.w + 'px'; canvas.style.height = view.h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  view.scale = Math.max(view.w / WIDTH, view.h / WIDTH) * 1.22;
  const world = WIDTH * view.scale;
  if (recenter) {
    view.baseOffX = (view.w - world) / 2;
    view.baseOffY = (view.h - world) / 2;
  }
  clampBase();
}
function clampBase() {
  const world = WIDTH * view.scale;
  view.baseOffX = Math.min(0, Math.max(view.w - world, view.baseOffX));
  view.baseOffY = Math.min(0, Math.max(view.h - world, view.baseOffY));
}

/* ----- 鼓動 ----- */
function frame(t) {
  requestAnimationFrame(frame);
  if (!sky) return;
  // ごく緩やかな漂い（天の巡り）
  drift += driftDir * 0.06;
  if (Math.abs(drift) > 22) driftDir *= -1;
  view.offX = view.baseOffX + drift;
  view.offY = view.baseOffY + drift * 0.18;
  drawSky(ctx, sky, view, t, selected);
}

/* ----- 指 ----- */
function onDown(x, y) { dragging = true; moved = false; lastX = downX = x; lastY = downY = y; }
function onMove(x, y) {
  if (!dragging) return;
  const dx = x - lastX, dy = y - lastY;
  if (Math.abs(x - downX) + Math.abs(y - downY) > 6) moved = true;
  view.baseOffX += dx; view.baseOffY += dy;
  clampBase();
  lastX = x; lastY = y;
}
function onUp(x, y) {
  dragging = false;
  if (moved) return;
  const hit = pickConstellation(sky, view, x, y);
  if (hit) selectConstellation(hit);
  else { selected = null; $('card').hidden = true; }
}

canvas.addEventListener('mousedown', e => onDown(e.clientX, e.clientY));
window.addEventListener('mousemove', e => onMove(e.clientX, e.clientY));
window.addEventListener('mouseup', e => onUp(e.clientX, e.clientY));
canvas.addEventListener('touchstart', e => { const t = e.touches[0]; onDown(t.clientX, t.clientY); }, { passive: true });
canvas.addEventListener('touchmove', e => { const t = e.touches[0]; onMove(t.clientX, t.clientY); }, { passive: true });
canvas.addEventListener('touchend', e => { const t = e.changedTouches[0]; onUp(t.clientX, t.clientY); });

function selectConstellation(c) {
  selected = c;
  $('cName').textContent = c.name;
  $('cLead').textContent = `${c.stars.length} つ星　・　主星 ${c.lead.name}`;
  $('cMyth').textContent = c.myth;
  $('card').hidden = false;
}
$('cardClose').addEventListener('click', () => { selected = null; $('card').hidden = true; });

/* ----- ボタン ----- */
$('bAnother').addEventListener('click', () => setSeed((Math.random() * 1e9) >>> 0));
$('bLead').addEventListener('click', () => {
  // 一番星の星座（あれば）を選び、その中心へ寄せる
  const L = sky.leadStar;
  const c = sky.constellations.find(c => c.stars.includes(L));
  view.baseOffX = view.w / 2 - L.x * view.scale;
  view.baseOffY = view.h / 2 - L.y * view.scale;
  clampBase();
  if (c) selectConstellation(c);
  else toast(sky.leadStar.myth, 5000);
});
$('bShare').addEventListener('click', async () => {
  const url = location.href.split('#')[0] + `#s=${sky.seed}`;
  const data = { title: '星', text: `種 ${sky.seed} の夜空です。一番星は「${sky.leadStar.name}」`, url };
  if (navigator.share) { try { await navigator.share(data); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('リンクを写しました'); }
  catch { prompt('この空のリンク', url); }
});

let toastTimer = null;
function toast(msg, ms = 3200) {
  const el = $('toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

window.addEventListener('resize', () => fit(false));

/* ----- ひらく ----- */
$('bOpen').addEventListener('click', () => {
  $('intro').classList.add('gone');
  $('bar').hidden = false;
});

/* 起動：リンクの種があればそれを、なければ今日の空（20260613） */
setSeed(seedFromHash() ?? 20260613);
requestAnimationFrame(frame);
