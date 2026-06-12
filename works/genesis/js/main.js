import { World, CFG } from './world.js';
import { Camera, bakeFertility, drawWorld, drawMinimap } from './render.js';
import { drawChart } from './charts.js';
import { drawBrain, renderInfo } from './inspector.js';
import { torusDist2 } from './util.js';

/* ============================================================
   生 — メインループと神の手（UI）。
   世界は world.js の法則だけで回る。ここはそれを眺める窓。
   ============================================================ */

const $ = id => document.getElementById(id);
const canvas = $('view');
const ctx = canvas.getContext('2d');
const miniCv = $('minimap'), miniCtx = miniCv.getContext('2d');
const chartCv = $('chart'), chartCtx = chartCv.getContext('2d');
const brainCv = $('brain'), brainCtx = brainCv.getContext('2d');

let world = new World((Math.random() * 2 ** 31) | 0);
let fertCanvas = bakeFertility(world);
const cam = new Camera();
let selected = null;
let speed = 1;            // 0 = 一時停止, 1, 4, 16
let lastFrame = performance.now();
let fps = 60;

function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
addEventListener('resize', resize);

/* ---------- カメラ操作 ---------- */
let dragging = false, lastX = 0, lastY = 0, moved = 0;
canvas.addEventListener('pointerdown', e => {
  dragging = true; moved = 0;
  lastX = e.clientX; lastY = e.clientY;
});
addEventListener('pointermove', e => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  moved += Math.abs(dx) + Math.abs(dy);
  cam.x = ((cam.x - dx / cam.zoom) % CFG.WORLD + CFG.WORLD) % CFG.WORLD;
  cam.y = ((cam.y - dy / cam.zoom) % CFG.WORLD + CFG.WORLD) % CFG.WORLD;
  if (moved > 4) cam.follow = null;
  lastX = e.clientX; lastY = e.clientY;
});
addEventListener('pointerup', e => {
  if (dragging && moved < 5) pick(e);
  dragging = false;
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const f = Math.exp(-e.deltaY * 0.0012);
  cam.zoom = Math.min(3.5, Math.max(0.06, cam.zoom * f));
}, { passive: false });

function pick(e) {
  const rect = canvas.getBoundingClientRect();
  const p = cam.screenToWorld(e.clientX - rect.left, e.clientY - rect.top,
    canvas.clientWidth, canvas.clientHeight);
  let best = null, bestD = (28 / cam.zoom) ** 2;
  for (const c of world.creatures) {
    const d = torusDist2(p.x, p.y, c.x, c.y, CFG.WORLD);
    if (d < bestD) { bestD = d; best = c; }
  }
  selected = best;
  cam.follow = null;
  $('bFollow').classList.remove('active');
}

/* ---------- 神の手（コントロール） ---------- */
function setSpeed(s, btn) {
  speed = s;
  document.querySelectorAll('.spd').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}
$('bPause').onclick = e => setSpeed(0, e.currentTarget);
$('b1x').onclick = e => setSpeed(1, e.currentTarget);
$('b4x').onclick = e => setSpeed(4, e.currentTarget);
$('b16x').onclick = e => setSpeed(16, e.currentTarget);

$('bFollow').onclick = e => {
  if (!selected) return;
  cam.follow = (cam.follow === selected) ? null : selected;
  e.currentTarget.classList.toggle('active', cam.follow !== null);
};

$('bReset').onclick = () => {
  if (!confirm('この宇宙を畳んで、新しい種から世界をやり直しますか？')) return;
  world = new World((Math.random() * 2 ** 31) | 0);
  fertCanvas = bakeFertility(world);
  selected = null; cam.follow = null;
};

$('bSave').onclick = () => {
  const blob = new Blob([JSON.stringify(world.serialize())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sei-world-${world.seed}-step${world.step_}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};

$('fileLoad').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    world = World.deserialize(data);
    fertCanvas = bakeFertility(world);
    selected = null; cam.follow = null;
  } catch (err) {
    alert('この世界は読み込めませんでした: ' + err.message);
  }
  e.target.value = '';
});
$('bLoad').onclick = () => $('fileLoad').click();

$('growth').addEventListener('input', e => {
  world.plantGrowth = +e.target.value;
  $('growthVal').textContent = e.target.value;
});

addEventListener('keydown', e => {
  if (e.key === ' ') { setSpeed(speed === 0 ? 1 : 0, speed === 0 ? $('b1x') : $('bPause')); e.preventDefault(); }
  if (e.key === '1') setSpeed(1, $('b1x'));
  if (e.key === '2') setSpeed(4, $('b4x'));
  if (e.key === '3') setSpeed(16, $('b16x'));
});

/* ---------- 年表の表示 ---------- */
const KIND_ICON = { genesis: '◌', emerge: '❋', extinct: '✝', rain: '☂', info: '·' };
let lastEventCount = 0;
function renderEvents() {
  if (world.events.length === lastEventCount) return;
  lastEventCount = world.events.length;
  const recent = world.events.slice(-7).reverse();
  $('events').innerHTML = recent.map(ev =>
    `<div class="ev ev-${ev.kind}"><span class="ev-step">${ev.step}</span>` +
    `<span class="ev-ic">${KIND_ICON[ev.kind] || '·'}</span>${ev.text}</div>`
  ).join('');
}

/* ---------- メインループ ---------- */
let frame = 0;
function loop(now) {
  const dt = now - lastFrame;
  lastFrame = now;
  fps = fps * 0.95 + (1000 / Math.max(dt, 1)) * 0.05;

  for (let i = 0; i < speed; i++) world.step();

  // 選択個体が死んでいたら手放す
  if (selected && !selected.alive) { selected = null; cam.follow = null; }

  drawWorld(ctx, world, cam, selected, fertCanvas,
    canvas.clientWidth, canvas.clientHeight);

  frame++;
  if (frame % 3 === 0) {
    drawMinimap(miniCtx, world, cam, miniCv.width, miniCv.height);
    drawChart(chartCtx, world, chartCv.width, chartCv.height);
    renderEvents();
    renderInfo($('info'), selected, world);

    const alive = new Set(world.creatures.map(c => c.speciesId)).size;
    $('hud').textContent =
      `第 ${world.step_.toLocaleString()} 拍 · ${world.creatures.length} 匹 · ` +
      `${alive} 種 · 最深 ${world.maxGeneration} 世代 · ${Math.round(fps)} fps`;
    $('seed').textContent = `seed ${world.seed}`;
  }
  drawBrain(brainCtx, selected, brainCv.width, brainCv.height);

  requestAnimationFrame(loop);
}

resize();
setSpeed(1, $('b1x'));
requestAnimationFrame(loop);
