/* 雷のへそ — 種を選び、稲妻を呼び、閃光のあとに由来が立つ。 */

import { makeBolt, boltFingerprint, GRID_W } from '../core/bolt.js';
import { fitView, drawStorm } from './render.js';
import { thunder } from './audio.js';

const $ = id => document.getElementById(id);
const canvas = $('sky');
const ctx = canvas.getContext('2d');
const view = { w: 0, h: 0, scale: 1, offX: 0, offY: 0 };

let bolt = null;
let strikeAt = -1e9;
let cardTimer = null;

const LETTER_SEED = 20260614;   // この空が割れた日 — 稲妻「ガネト」

/* ----- 画面合わせ ----- */
function fit() {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  fitView(view, w, h);
}

/* ----- 稲妻を呼ぶ ----- */
function strike(seed) {
  bolt = makeBolt(seed >>> 0);
  strikeAt = performance.now();
  $('card').hidden = true;
  $('seedval').textContent = `種 ${bolt.seed}　・　${bolt.kind}　・　銘 ${boltFingerprint(bolt)}`;
  history.replaceState(null, '', `${location.pathname}${location.search}#s=${bolt.seed}`);

  // 近い稲妻ほど鋭く、間も短い（細い一閃＝近い）
  const nearness = 0.35 + 0.55 * (1 - bolt.span.w / GRID_W);
  clearTimeout(cardTimer);
  cardTimer = setTimeout(() => { thunder(nearness); showCard(); }, 320);
}

function reflash() {
  if (bolt) strike(bolt.seed);
}

function showCard() {
  if (!bolt) return;
  $('cName').textContent = bolt.name;
  $('cKind').textContent = `${bolt.kind}　・　${bolt.cells.length} 折れ　・　銘 ${boltFingerprint(bolt)}`;
  $('cStruck').textContent = bolt.struck;
  $('cTale').textContent = bolt.tale;
  $('card').hidden = false;
}

/* ----- 鼓動 ----- */
function frame(now) {
  requestAnimationFrame(frame);
  drawStorm(ctx, bolt, view, now, strikeAt);
}

/* ----- 指：空にふれると、別の稲妻が落ちる ----- */
let downX = 0, downY = 0;
function onDown(x, y) { downX = x; downY = y; }
function onUp(x, y) {
  if (Math.abs(x - downX) + Math.abs(y - downY) > 10) return;   // ドラッグは無視
  strike((Math.random() * 1e9) >>> 0);
}
canvas.addEventListener('mousedown', e => onDown(e.clientX, e.clientY));
canvas.addEventListener('mouseup', e => onUp(e.clientX, e.clientY));
canvas.addEventListener('touchstart', e => { const t = e.touches[0]; onDown(t.clientX, t.clientY); }, { passive: true });
canvas.addEventListener('touchend', e => { const t = e.changedTouches[0]; onUp(t.clientX, t.clientY); });

/* ----- ボタン ----- */
$('cardClose').addEventListener('click', () => { $('card').hidden = true; });
$('bAgain').addEventListener('click', reflash);
$('bLetter').addEventListener('click', () => strike(LETTER_SEED));
$('bShare').addEventListener('click', async () => {
  const url = location.href.split('#')[0] + `#s=${bolt.seed}`;
  const data = { title: '雷', text: `種 ${bolt.seed} の稲妻「${bolt.name}」（${bolt.kind}）`, url };
  if (navigator.share) { try { await navigator.share(data); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('リンクを写しました'); }
  catch { prompt('この雷のリンク', url); }
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
  strike(seedFromHash() ?? LETTER_SEED);
});

fit();
requestAnimationFrame(frame);
