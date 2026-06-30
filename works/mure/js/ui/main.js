/* ============================================================
   群 — 夕空にむれを放ち、うねりを見る。
   核（flock）が出した位置と速さを、夕暮れの空に影として描く。
   薄く重ね塗りして残像（うねりの尾）を残し、触れた先を隼にする。
   おびえれば空気がふるえ（環境音）、やがてむれはまた結ぶ。すべてこの画面の中だけ。
   ============================================================ */
import { makeFlock, step, order, alarmed } from '../core/flock.js';

const $ = (id) => document.getElementById(id);
const canvas = $('sky'), ctx = canvas.getContext('2d');

const WORLD = { W: 360, H: 240 };
let W = 1, H = 1, dpr = 1, scale = 1, ox = 0, oy = 0;
let F, seed, raf = 0, running = false;
let predator = null;                       // {x,y} ＝ 触れた先（隼）

// 夕空のグラデ：上は藍、地平は橙。
function skyGrad() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#231d44'); g.addColorStop(0.55, '#3a2f5e'); g.addColorStop(0.82, '#7a4f6e'); g.addColorStop(1, '#c8775a');
  return g;
}

const SYL = ['yu', 'gu', 're', 'mi', 'so', 'ka', 'na', 'to', 'ha', 'ru', 'shi', 'wa', 'no', 'me', 'ko', 'sa'];
function coinSeed() { let s = ''; for (let i = 0; i < 3; i++) s += SYL[(Math.random() * SYL.length) | 0]; return s; }

function setSeed(s) {
  seed = s; $('seedval').textContent = '種  ' + seed;
  history.replaceState(null, '', `${location.pathname}${location.search}#s=${encodeURIComponent(seed)}`);
}

function resize() {
  W = Math.max(1, window.innerWidth); H = Math.max(1, window.innerHeight);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  scale = Math.max(W / WORLD.W, H / WORLD.H);             // cover
  ox = (W - WORLD.W * scale) / 2; oy = (H - WORLD.H * scale) / 2;
  ctx.fillStyle = skyGrad(); ctx.fillRect(0, 0, W, H);
}

function newFlock(s) {
  setSeed(s || coinSeed());
  F = makeFlock(seed, { N: 180, W: WORLD.W, H: WORLD.H });
  for (let i = 0; i < 80; i++) step(F, null);              // 少し馴染ませてから見せる
  ctx.fillStyle = skyGrad(); ctx.fillRect(0, 0, W, H);
}

function bird(b) {
  const sx = ox + b.x * scale, sy = oy + b.y * scale;
  const a = Math.atan2(b.vy, b.vx), s = 2.2 * scale * 0.5 + scale * 0.7;
  const cos = Math.cos(a), sin = Math.sin(a);
  // くの字の影（進む向きに尖る）。
  ctx.beginPath();
  ctx.moveTo(sx + cos * s, sy + sin * s);
  ctx.lineTo(sx - cos * s * 0.7 - sin * s * 0.8, sy - sin * s * 0.7 + cos * s * 0.8);
  ctx.lineTo(sx - cos * s * 0.2, sy - sin * s * 0.2);
  ctx.lineTo(sx - cos * s * 0.7 + sin * s * 0.8, sy - sin * s * 0.7 - cos * s * 0.8);
  ctx.closePath();
  if (b.alarm > 0.25) ctx.fillStyle = `rgba(${110 + b.alarm * 60 | 0},${50},${56},0.96)`;
  else ctx.fillStyle = 'rgba(14,11,22,0.92)';
  ctx.fill();
}

let meterT = 0;
function frame() {
  step(F, predator);
  // 残像：夕空をうすく重ねて、うねりの尾を残す。
  ctx.globalAlpha = 0.26; ctx.fillStyle = skyGrad(); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  for (const b of F.birds) bird(b);
  if (predator) {                                          // 隼のしるし（淡い波紋）
    const px = ox + predator.x * scale, py = oy + predator.y * scale;
    ctx.beginPath(); ctx.arc(px, py, F.p.fearR * scale, 0, 7); ctx.strokeStyle = 'rgba(220,120,110,0.18)'; ctx.stroke();
  }
  audioTick();
  if (++meterT % 12 === 0) $('meter').textContent = `整列 ${(order(F) * 100).toFixed(0)}%`;
  raf = requestAnimationFrame(frame);
}

// ---- 触れる＝隼になる ----
function toWorld(e) {
  const t = e.touches ? e.touches[0] : e;
  return { x: (t.clientX - ox) / scale, y: (t.clientY - oy) / scale };
}
canvas.addEventListener('pointerdown', (e) => { predator = toWorld(e); startAudio(); });
canvas.addEventListener('pointermove', (e) => { if (predator) predator = toWorld(e); });
window.addEventListener('pointerup', () => { predator = null; });

// ---- 夕の音（環境音：低いドローンと、おびえで増す風）----
let actx, drone, wind, windGain, droneGain, soundOn = false;
function startAudio() {
  if (actx || !soundOn) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  droneGain = actx.createGain(); droneGain.gain.value = 0.05; droneGain.connect(actx.destination);
  for (const f of [55, 82.4, 110]) { const o = actx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = actx.createGain(); g.gain.value = 0.33; o.connect(g).connect(droneGain); o.start(); }
  // 風：ノイズをバンドパスに通し、群れのおびえで音量が上がる。
  const buf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  wind = actx.createBufferSource(); wind.buffer = buf; wind.loop = true;
  const bp = actx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.7;
  windGain = actx.createGain(); windGain.gain.value = 0.0;
  wind.connect(bp).connect(windGain).connect(actx.destination); wind.start();
}
function audioTick() {
  if (!actx) return;
  const target = 0.015 + alarmed(F) * 0.22;               // おびえるほど風が立つ
  windGain.gain.value += (target - windGain.gain.value) * 0.06;
}

function start() {
  $('intro').classList.add('gone'); $('bar').hidden = false;
  if (!running) { running = true; frame(); }
}

$('bOpen').addEventListener('click', start);
$('bAgain').addEventListener('click', () => newFlock());
$('bSound').addEventListener('click', (e) => { soundOn = !soundOn; e.target.classList.toggle('ghost', !soundOn); startAudio(); if (actx) actx.resume(); $('bSound').textContent = soundOn ? '♪ 鳴っている' : '♪ 夕の音'; });
$('bShare').addEventListener('click', async () => {
  try { if (navigator.share) await navigator.share({ title: '群', text: `群 — 種「${seed}」の空`, url: location.href }); else { await navigator.clipboard.writeText(location.href); toast('リンクをコピーしました'); } } catch (_) {}
});
function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; requestAnimationFrame(() => t.classList.add('on')); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 1700); }

window.addEventListener('resize', resize);
resize();
newFlock(decodeURIComponent((location.hash.match(/s=([^&]+)/) || [])[1] || '') || '');
