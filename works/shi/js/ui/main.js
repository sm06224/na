import { World } from '../core/world.js';
import { KIND } from '../core/chronicle.js';
import { ERAS } from '../core/tech.js';
import { Camera, bakeTerrain, bakePolitical, bakeRoads, drawMap, drawMinimap, PX, } from './render.js';
import { drawChart } from './charts.js';
import { renderInspector } from './inspector.js';
import { renderFeed, resetFeed, renderAnnals } from './feed.js';
import { SIZE } from '../core/terrain.js';

/* ============================================================
   史 — ループと読者の手。
   歴史は core が書く。ここは頁をめくる指にすぎない。
   ============================================================ */

const $ = id => document.getElementById(id);
const canvas = $('map');
const ctx = canvas.getContext('2d');
const miniCv = $('minimap'), miniCtx = miniCv.getContext('2d');
const chartCv = $('chart'), chartCtx = chartCv.getContext('2d');

let world = new World((Math.random() * 2 ** 31) | 0);
let layers = bakeLayers(world);
let cam = new Camera(canvas.clientWidth || innerWidth, canvas.clientHeight || innerHeight);
let selected = null;
let speed = 1;     // 月 / フレーム（0, 1, 4, 12）
let fps = 60, lastFrame = performance.now();
let chronicleSeen = 0;

const opts = {
  political: true,
  trade: false,
  labels: true,
  selected: null,
  flashes: [],
};

function bakeLayers(w) {
  const political = document.createElement('canvas');
  political.width = SIZE * PX; political.height = SIZE * PX;
  const roads = document.createElement('canvas');
  roads.width = SIZE * PX; roads.height = SIZE * PX;
  const L = { terrain: bakeTerrain(w), political, roads };
  bakePolitical(w, political);
  bakeRoads(w, roads);
  return L;
}

function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
addEventListener('resize', resize);

/* ---------- カメラ操作 ---------- */
let dragging = false, lastX = 0, lastY = 0, moved = 0;
canvas.addEventListener('pointerdown', e => {
  dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
});
addEventListener('pointermove', e => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  moved += Math.abs(dx) + Math.abs(dy);
  cam.x -= dx / cam.zoom;
  cam.y -= dy / cam.zoom;
  cam.clamp();
  lastX = e.clientX; lastY = e.clientY;
});
addEventListener('pointerup', e => {
  if (dragging && moved < 5) pick(e);
  dragging = false;
});
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const before = cam.toTile(e.offsetX, e.offsetY, canvas.clientWidth, canvas.clientHeight);
  cam.zoom *= Math.exp(-e.deltaY * 0.0013);
  cam.clamp();
  const after = cam.toTile(e.offsetX, e.offsetY, canvas.clientWidth, canvas.clientHeight);
  cam.x += before.x - after.x;   // ポインタの下を固定してズーム
  cam.y += before.y - after.y;
  cam.clamp();
}, { passive: false });

function pick(e) {
  const rect = canvas.getBoundingClientRect();
  const t = cam.toTile(e.clientX - rect.left, e.clientY - rect.top,
    canvas.clientWidth, canvas.clientHeight);
  let best = null, bestD = Math.max(3, 14 / cam.zoom) ** 2;
  for (const c of world.settlements) {
    const d = (c.x + 0.5 - t.x) ** 2 + (c.y + 0.5 - t.y) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  selected = best;
}

/* ---------- 読者の手 ---------- */
function setSpeed(s, btn) {
  speed = s;
  document.querySelectorAll('.spd').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}
$('bPause').onclick = e => setSpeed(0, e.currentTarget);
$('b1x').onclick = e => setSpeed(1, e.currentTarget);
$('b4x').onclick = e => setSpeed(4, e.currentTarget);
$('b12x').onclick = e => setSpeed(12, e.currentTarget);

const toggles = [['bPolitical', 'political'], ['bTrade', 'trade'], ['bLabels', 'labels']];
for (const [btn, key] of toggles) {
  $(btn).classList.toggle('active', opts[key]);
  $(btn).onclick = e => {
    opts[key] = !opts[key];
    e.currentTarget.classList.toggle('active', opts[key]);
  };
}

$('bNew').onclick = () => {
  if (!confirm('この歴史書を閉じて、新しい世界の第一頁を開きますか？')) return;
  world = new World((Math.random() * 2 ** 31) | 0);
  layers = bakeLayers(world);
  cam = new Camera(canvas.clientWidth, canvas.clientHeight);
  selected = null;
  chronicleSeen = 0;
  opts.flashes.length = 0;
  resetFeed();
};

$('bSave').onclick = () => {
  const blob = new Blob([JSON.stringify(world.serialize())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `shi-${world.seed}-year${world.year}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};
$('fileLoad').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    world = World.deserialize(JSON.parse(await file.text()));
    layers = bakeLayers(world);
    selected = null;
    chronicleSeen = world.chronicle.entries.length;
    opts.flashes.length = 0;
    resetFeed();
  } catch (err) {
    alert('この歴史書は読めませんでした: ' + err.message);
  }
  e.target.value = '';
});
$('bLoad').onclick = () => $('fileLoad').click();

/* 全史の間 */
$('bAnnals').onclick = () => {
  $('annals').classList.add('open');
  renderAnnals($('annalsList'), world, $('annalsFilter').value);
};
$('annalsClose').onclick = () => $('annals').classList.remove('open');
$('annalsFilter').onchange = () => renderAnnals($('annalsList'), world, $('annalsFilter').value);

addEventListener('keydown', e => {
  if (e.key === ' ') {
    setSpeed(speed === 0 ? 1 : 0, speed === 0 ? $('b1x') : $('bPause'));
    e.preventDefault();
  }
  if (e.key === '1') setSpeed(1, $('b1x'));
  if (e.key === '2') setSpeed(4, $('b4x'));
  if (e.key === '3') setSpeed(12, $('b12x'));
  if (e.key === 'Escape') $('annals').classList.remove('open');
});

/* ---------- 出来事 → 地図の閃光 ---------- */
const FLASH_COLOR = {
  [KIND.CONQUEST]: 'rgba(255, 90, 80, %a)',
  [KIND.REBEL]: 'rgba(255, 200, 80, %a)',
  [KIND.PLAGUE]: 'rgba(160, 255, 110, %a)',
  [KIND.WONDER]: 'rgba(255, 226, 150, %a)',
  [KIND.NATION]: 'rgba(190, 140, 255, %a)',
};
function harvestFlashes() {
  const entries = world.chronicle.entries;
  for (; chronicleSeen < entries.length; chronicleSeen++) {
    const e = entries[chronicleSeen];
    if (e.x === undefined) continue;
    const color = FLASH_COLOR[e.kind];
    if (color) opts.flashes.push({ x: e.x, y: e.y, color, t0: performance.now() });
    if (opts.flashes.length > 40) opts.flashes.shift();
  }
}

/* ---------- メインループ ---------- */
let frame = 0;
function loop(now) {
  const dt = now - lastFrame;
  lastFrame = now;
  fps = fps * 0.95 + (1000 / Math.max(dt, 1)) * 0.05;

  for (let i = 0; i < speed; i++) world.step();

  if (world.politicalDirty) { bakePolitical(world, layers.political); world.politicalDirty = false; }
  if (world.roadsDirty) { bakeRoads(world, layers.roads); world.roadsDirty = false; }
  harvestFlashes();

  if (selected && !world.settlementById.has(selected.id)) selected = null;
  opts.selected = selected;

  drawMap(ctx, world, cam, layers, opts, canvas.clientWidth, canvas.clientHeight);

  frame++;
  if (frame % 4 === 0) {
    drawMinimap(miniCtx, world, cam, layers,
      canvas.clientWidth, canvas.clientHeight, miniCv.width, miniCv.height);
    drawChart(chartCtx, world, chartCv.width, chartCv.height);
    renderFeed($('events'), world);
    renderInspector($('info'), selected, world);

    const last = world.history[world.history.length - 1];
    $('hud').textContent =
      `紀元 ${world.year.toLocaleString()} 年 ${world.month + 1} 月 · ` +
      `人口 ${(last ? last.pop : 0).toLocaleString()} · ` +
      `都市 ${world.settlements.length} · 国 ${world.aliveNations().length} · ` +
      `${ERAS[world.worldEra()]}の時代 · ${Math.round(fps)} fps`;
    $('seed').textContent = `seed ${world.seed}`;
  }
  requestAnimationFrame(loop);
}

$('bBegin').addEventListener('click', () => $('intro').classList.add('gone'));

resize();
cam = new Camera(canvas.clientWidth, canvas.clientHeight);
setSpeed(1, $('b1x'));
requestAnimationFrame(loop);
