/* 種のへそ — 種を選び、草木を呼び、芽ぐんだあとに由来が立つ。 */

import { makePlant, plantFingerprint } from '../core/plant.js';
import { fitView, drawPlant } from './render.js';

const $ = id => document.getElementById(id);
const canvas = $('field');
const ctx = canvas.getContext('2d');
const view = { w: 0, h: 0, scale: 1, offX: 0, offY: 0 };

let plant = null;
let sproutAt = -1e9;

const LETTER_SEED = 20260615;   // この土に最初に蒔かれた種 — 草木「ユツヤ」

function fit() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fitView(view, w, h, plant);
}

/* ----- 種を蒔く ----- */
function sow(seed) {
  plant = makePlant(seed >>> 0);
  sproutAt = performance.now();
  fitView(view, window.innerWidth, window.innerHeight, plant);
  $('card').hidden = true;
  $('seedval').textContent = `種 ${plant.seed}　・　${plant.season} の ${plant.kind}　・　銘 ${plantFingerprint(plant)}`;
  history.replaceState(null, '', `${location.pathname}${location.search}#s=${plant.seed}`);
  clearTimeout(cardTimer);
  cardTimer = setTimeout(showCard, 2700);
}
let cardTimer = null;

function resow() { if (plant) sow(plant.seed); }

function showCard() {
  if (!plant) return;
  $('cName').textContent = plant.name;
  $('cKind').textContent = `${plant.season} の ${plant.kind}　・　${plant.nodes.length} 節　・　銘 ${plantFingerprint(plant)}`;
  $('cLine').textContent = plant.line;
  $('cTale').textContent = plant.tale;
  $('card').hidden = false;
}

/* ----- 鼓動 ----- */
function frame(now) {
  requestAnimationFrame(frame);
  drawPlant(ctx, plant, view, now, sproutAt);
}

/* ----- 指：土にふれると、別の種が芽ぐむ ----- */
let downX = 0, downY = 0;
function onDown(x, y) { downX = x; downY = y; }
function onUp(x, y) {
  if (Math.abs(x - downX) + Math.abs(y - downY) > 10) return;   // ドラッグは無視
  sow((Math.random() * 1e9) >>> 0);
}
canvas.addEventListener('mousedown', e => onDown(e.clientX, e.clientY));
canvas.addEventListener('mouseup', e => onUp(e.clientX, e.clientY));
canvas.addEventListener('touchstart', e => { const t = e.touches[0]; onDown(t.clientX, t.clientY); }, { passive: true });
canvas.addEventListener('touchend', e => { const t = e.changedTouches[0]; onUp(t.clientX, t.clientY); });

/* ----- ボタン ----- */
$('cardClose').addEventListener('click', () => { $('card').hidden = true; });
$('bAgain').addEventListener('click', resow);
$('bLetter').addEventListener('click', () => sow(LETTER_SEED));
$('bShare').addEventListener('click', async () => {
  const url = location.href.split('#')[0] + `#s=${plant.seed}`;
  const data = { title: '種', text: `種 ${plant.seed} の草木「${plant.name}」（${plant.season}の${plant.kind}）`, url };
  if (navigator.share) { try { await navigator.share(data); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('リンクを写しました'); }
  catch { prompt('この草木のリンク', url); }
});

let toastTimer = null;
function toast(msg, ms = 3000) {
  const el = $('toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

window.addEventListener('resize', fit);

/* ----- ひらく ----- */
function seedFromHash() {
  const m = String(location.hash || '').match(/[#&]s=(\d+)/);
  return m ? (Number(m[1]) >>> 0) : null;
}
$('bOpen').addEventListener('click', () => {
  $('intro').classList.add('gone');
  $('bar').hidden = false;
  sow(seedFromHash() ?? LETTER_SEED);
});

fit();
requestAnimationFrame(frame);
