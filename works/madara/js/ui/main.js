/* ============================================================
   斑 — 無地の肌に種火を落とし、模様が育つのを見る。
   核（grayscott・classify・render）が紙の上で解く反応拡散を、
   小さな格子で走らせ、引き伸ばしてやわらかく描く。
   なでれば種火が撒かれ、模様が割れて、またひとりでに結ぶ。
   育ちきると、肌は自分が誰の毛皮かを名のる。すべてこの画面の中だけ。
   ============================================================ */
import { makeField, step } from '../core/grayscott.js';
import { identify } from '../core/classify.js';
import { makePalette, renderRGBA } from '../core/render.js';

const $ = (id) => document.getElementById(id);
const canvas = $('coat'), ctx = canvas.getContext('2d');

let W = 1, H = 1, dpr = 1, N = 110;
let off, offctx, imgdata;
let field, palette, seed, raf = 0, frames = 0, named = false;
const STEPS_PER_FRAME = 10;    // 1 フレームに何刻み進めるか（育つ速さ）

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
  history.replaceState(null, '', `${location.pathname}${location.search}#m=${encodeURIComponent(seed)}`);
}

function resize() {
  W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function buildOffscreen() {
  N = field.N;
  off = document.createElement('canvas'); off.width = N; off.height = N;
  offctx = off.getContext('2d');
  imgdata = offctx.createImageData(N, N);
}

function newCoat(s) {
  setSeed(s || coinSeed());
  // 画面の縦横比にあわせ、正方の格子をひとつ（短辺基準で密度を決める）。
  field = makeField(seed, { N: 110 });
  palette = makePalette(seed);
  buildOffscreen();
  frames = 0; named = false;
  $('name').classList.remove('on'); $('name').hidden = true;
}

// 肌が育ちきったら、棲む獣の名を名のらせる。
function reveal() {
  const id = identify(field);
  if (id.coat === 'void') return;
  $('namekana').textContent = `${id.kana}（${id.en}）の肌 — ${coatWord(id.coat)}`;
  $('namenote').textContent = id.note;
  $('name').hidden = false;
  requestAnimationFrame(() => $('name').classList.add('on'));
  named = true;
}
const coatWord = (c) => ({ spots: '斑', stripes: '縞', maze: '迷路', holes: '孔' }[c] || '');

function draw() {
  const buf = renderRGBA(field, palette);     // N*N*4
  imgdata.data.set(buf);
  offctx.putImageData(imgdata, 0, 0);
  // 短辺いっぱいに正方を写し、はみ出しは中心寄せ（肌が画面を覆う）。
  const side = Math.max(W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, (W - side) / 2, (H - side) / 2, side, side);
}

function tick() {
  for (let s = 0; s < STEPS_PER_FRAME; s++) step(field);
  draw();
  frames++;
  if (!named && frames > 420) reveal();          // ~4200 刻みで素性が定まる
  raf = requestAnimationFrame(tick);
}

// 種火を撒く：触れたところの V を立て、U を落とす（模様の核になる）。
function spark(cx, cy, r = 5) {
  const { U, V } = field, n = N;
  // 画面座標 → 格子座標（短辺基準の正方写像の逆）。
  const side = Math.max(W, H);
  const gx = ((cx - (W - side) / 2) / side * n) | 0;
  const gy = ((cy - (H - side) / 2) / side * n) | 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (dx * dx + dy * dy > r * r) continue;
    const x = ((gx + dx) % n + n) % n, y = ((gy + dy) % n + n) % n, i = y * n + x;
    U[i] = 0.4; V[i] = 0.3;
  }
  if (named) { $('name').classList.remove('on'); named = false; }   // 触れたら、また名は伏せる
}

let drawing = false;
function pointerXY(e) {
  const t = e.touches ? e.touches[0] : e;
  return [t.clientX, t.clientY];
}
canvas.addEventListener('pointerdown', (e) => { drawing = true; const [x, y] = pointerXY(e); spark(x, y); });
canvas.addEventListener('pointermove', (e) => { if (drawing) { const [x, y] = pointerXY(e); spark(x, y); } });
window.addEventListener('pointerup', () => { drawing = false; });

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  requestAnimationFrame(() => t.classList.add('on'));
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 1800);
}

function start() {
  $('intro').classList.add('gone');
  $('bar').hidden = false;
  if (!raf) tick();
}

$('bOpen').addEventListener('click', start);
$('bAgain').addEventListener('click', () => { newCoat(); if ($('intro').classList.contains('gone')) {} });
$('bShare').addEventListener('click', async () => {
  const url = location.href;
  try {
    if (navigator.share) await navigator.share({ title: '斑', text: `斑 — 種「${seed}」の肌`, url });
    else { await navigator.clipboard.writeText(url); toast('リンクをコピーしました'); }
  } catch (_) { /* 取り消しは黙って */ }
});

window.addEventListener('resize', resize);

// 起動：URL に種があればそれを、なければ拵える。
resize();
const hash = decodeURIComponent((location.hash.match(/m=([^&]+)/) || [])[1] || '');
newCoat(hash || '');
draw();
