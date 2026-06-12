import {
  SCALES, SPAN, freqOf, degreeFromY, panFromX, hueOf, EchoLoop,
} from '../core/music.js';
import { Engine } from './audio.js';

/* ============================================================
   奏 — ひとつの画面に、何本でも指を。
   楽理は core が、声は audio が。ここは指と光を結ぶだけ。
   ============================================================ */

const $ = id => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');

let scale = SCALES[0];
const engine = new Engine();
const echo = new EchoLoop(8, 0.55, 0.13);
const ripples = [];   // { x, y, hue, t0, gen }
const motes = [];     // ただよう光の粒（場のいきもの）
let W = 0, H = 0;

function resize() {
  W = canvas.clientWidth; H = canvas.clientHeight;
  canvas.width = W * devicePixelRatio;
  canvas.height = H * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
addEventListener('resize', resize);

/* ---------- 弾く ---------- */
function strike(xNorm, yNorm, gain = 1, fromEcho = 0) {
  const degree = degreeFromY(yNorm);
  const freq = freqOf(scale, degree);
  const pan = panFromX(xNorm);
  const bright = 0.35 + 0.5 * (degree / (SPAN - 1));
  engine.pluck(freq, pan, gain, bright);
  ripples.push({ x: xNorm, y: yNorm, hue: hueOf(scale, degree), t0: performance.now(), gen: fromEcho });
  if (ripples.length > 80) ripples.shift();
  if (!fromEcho) echo.add({ x: xNorm, y: yNorm, degree }, performance.now() / 1000);
  return degree;
}

/* ---------- 指（何本でも） ---------- */
const fingers = new Map();   // pointerId -> 最後に鳴らした段
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId);
  engine.ensure();
  const d = strike(e.clientX / W, e.clientY / H);
  fingers.set(e.pointerId, d);
});
canvas.addEventListener('pointermove', e => {
  if (!fingers.has(e.pointerId)) return;
  const d = degreeFromY(e.clientY / H);
  if (d !== fingers.get(e.pointerId)) {
    // 段をまたいだら、そこでまた鳴る（なぞれば走句になる）
    strike(e.clientX / W, e.clientY / H, 0.75);
    fingers.set(e.pointerId, d);
  }
});
const lift = e => fingers.delete(e.pointerId);
canvas.addEventListener('pointerup', lift);
canvas.addEventListener('pointercancel', lift);

/* ---------- 鍵盤（同じ画面のもうひとり） ----------
   ホーム段 A〜; が低い列、Q〜P がその 1 オクターブ上。 */
const ROW_LOW = 'asdfghjkl;';
const ROW_HIGH = 'qwertyuiop';
const held = new Set();
addEventListener('keydown', e => {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  let degree = -1;
  if (ROW_LOW.includes(k)) degree = ROW_LOW.indexOf(k);
  if (ROW_HIGH.includes(k)) degree = ROW_HIGH.indexOf(k) + 5;   // 5 段 = 1 オクターブ上
  if (degree < 0 || degree >= SPAN || held.has(k)) return;
  held.add(k);
  engine.ensure();
  const x = 0.5 + (degree - SPAN / 2) * 0.04 + (Math.random() - 0.5) * 0.04;
  const y = 1 - (degree + 0.5) / SPAN;
  strike(x, y);
});
addEventListener('keyup', e => held.delete(e.key.toLowerCase()));

/* ---------- 操作 ---------- */
function renderChips() {
  const box = $('scales');
  box.textContent = '';
  for (const s of SCALES) {
    const b = document.createElement('button');
    b.className = 'chip' + (s === scale ? ' active' : '');
    b.textContent = s.label;
    b.title = s.gloss;
    b.onclick = () => {
      scale = s;
      engine.ensure();
      engine.startDrone(freqOf(scale, 0));
      document.body.style.setProperty('--hueA', s.hueA);
      renderChips();
    };
    box.append(b);
  }
}
$('bEcho').onclick = e => {
  echo.enabled = !echo.enabled;
  if (!echo.enabled) echo.clear();
  e.currentTarget.classList.toggle('active', echo.enabled);
};
$('bDrone').onclick = e => {
  engine.droneOn = !engine.droneOn;
  e.currentTarget.classList.toggle('active', engine.droneOn);
  engine.ensure();
  if (engine.droneOn) engine.startDrone(freqOf(scale, 0)); else engine.stopDrone();
};

$('bBegin').addEventListener('click', () => {
  $('intro').classList.add('gone');
  engine.ensure();
  engine.startDrone(freqOf(scale, 0));
});

/* ---------- 光 ---------- */
function initMotes() {
  for (let i = 0; i < 50; i++) {
    motes.push({ x: Math.random(), y: Math.random(), v: 0.006 + Math.random() * 0.02, r: Math.random() * 1.4 + 0.4, p: Math.random() * Math.PI * 2 });
  }
}

function loop(now) {
  // こだまが還ってくる
  for (const back of echo.poll(now / 1000)) {
    strike(back.x, back.y, back.gain * 0.6, back.gen);
  }

  ctx.fillStyle = 'rgba(7, 8, 14, 0.32)';
  ctx.fillRect(0, 0, W, H);

  // ただよう粒
  for (const m of motes) {
    m.y -= m.v / 60;
    m.x += Math.sin(now / 4000 + m.p) * 0.0003;
    if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
    ctx.fillStyle = `hsla(${scale.hueA}, 50%, 75%, ${0.05 + 0.04 * Math.sin(now / 900 + m.p)})`;
    ctx.beginPath();
    ctx.arc(m.x * W, m.y * H, m.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 音の波紋（こだまは細く薄く）
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    const age = (now - r.t0) / 1900;
    if (age > 1) { ripples.splice(i, 1); continue; }
    const x = r.x * W, y = r.y * H;
    const fade = (1 - age) * (r.gen ? 0.45 : 1);
    const rad = 6 + age * (90 + 60 * (1 - r.y));
    ctx.strokeStyle = `hsla(${r.hue}, 85%, 70%, ${0.55 * fade})`;
    ctx.lineWidth = r.gen ? 1 : 2;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = `hsla(${r.hue}, 85%, 80%, ${0.3 * fade})`;
    ctx.beginPath(); ctx.arc(x, y, rad * 0.55, 0, Math.PI * 2); ctx.stroke();
    // 中心のともしび
    const grd = ctx.createRadialGradient(x, y, 0, x, y, 26 * fade + 2);
    grd.addColorStop(0, `hsla(${r.hue}, 90%, 75%, ${0.5 * fade})`);
    grd.addColorStop(1, 'transparent');
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(x, y, 26 * fade + 2, 0, Math.PI * 2); ctx.fill();
  }

  requestAnimationFrame(loop);
}

resize();
initMotes();
renderChips();
ctx.fillStyle = '#07080e';
ctx.fillRect(0, 0, W, H);
requestAnimationFrame(loop);
