import { World } from '../core/world.js';
import { EV } from '../core/chronicle.js';
import { wordToKana } from '../core/phonology.js';
import { CONCEPTS } from '../core/meaning.js';
import { Camera, drawMap, drawMinimap } from './render.js';
import { renderDictionary, renderFeed, resetFeed, renderAnnals, drawChart } from './panels.js';
import { h, clear, download, toast } from './dom.js';

/* ============================================================
   言 — ループと、読者のまなざし。
   言語は core が生む。ここは、その一部始終を映す窓。
   ============================================================ */
const $ = id => document.getElementById(id);
const canvas = $('map');
const ctx = canvas.getContext('2d');
const miniCv = $('minimap'), miniCtx = miniCv.getContext('2d');
const chartCv = $('chart'), chartCtx = chartCv.getContext('2d');

let world = new World((Math.random() * 2 ** 31) | 0);
let cam = new Camera(innerWidth, innerHeight);
let selected = null;
let speed = 2;            // 年/フレーム
let fps = 60, lastFrame = performance.now();
let chronicleSeen = 0;
const opts = { showContact: true, selected: null, flashes: [] };

function resize() {
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
addEventListener('resize', resize);

/* ---------- カメラ ---------- */
let drag = false, lx = 0, ly = 0, moved = 0;
canvas.addEventListener('pointerdown', e => { drag = true; moved = 0; lx = e.clientX; ly = e.clientY; });
addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - lx, dy = e.clientY - ly;
  moved += Math.abs(dx) + Math.abs(dy);
  cam.x -= dx / cam.zoom; cam.y -= dy / cam.zoom; cam.clamp();
  lx = e.clientX; ly = e.clientY;
});
addEventListener('pointerup', e => { if (drag && moved < 5) pick(e); drag = false; });
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const before = cam.toWorld(e.offsetX, e.offsetY, canvas.clientWidth, canvas.clientHeight);
  cam.zoom *= Math.exp(-e.deltaY * 0.0013); cam.clamp();
  const after = cam.toWorld(e.offsetX, e.offsetY, canvas.clientWidth, canvas.clientHeight);
  cam.x += before.x - after.x; cam.y += before.y - after.y; cam.clamp();
}, { passive: false });

function pick(e) {
  const r = canvas.getBoundingClientRect();
  const p = cam.toWorld(e.clientX - r.left, e.clientY - r.top, canvas.clientWidth, canvas.clientHeight);
  let best = null, bestD = (16 / cam.zoom) ** 2;
  for (const d of world.aliveDemes()) {
    const dd = (d.x - p.x) ** 2 + (d.y - p.y) ** 2;
    if (dd < bestD) { bestD = dd; best = d; }
  }
  selected = best;
}

/* ---------- 操作 ---------- */
function setSpeed(s, btn) {
  speed = s;
  document.querySelectorAll('.spd').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}
$('bPause').onclick = e => setSpeed(0, e.currentTarget);
$('b1x').onclick = e => setSpeed(2, e.currentTarget);
$('b4x').onclick = e => setSpeed(8, e.currentTarget);
$('b16x').onclick = e => setSpeed(24, e.currentTarget);

$('bContact').classList.toggle('active', opts.showContact);
$('bContact').onclick = e => { opts.showContact = !opts.showContact; e.currentTarget.classList.toggle('active', opts.showContact); };

$('bNew').onclick = () => {
  if (!confirm('この言語史を閉じて、新しい無言の世界から始めますか？')) return;
  world = new World((Math.random() * 2 ** 31) | 0);
  cam = new Camera(canvas.clientWidth, canvas.clientHeight);
  selected = null; chronicleSeen = 0; opts.flashes.length = 0; resetFeed();
};
$('bSave').onclick = () => {
  download(`koto-${world.seed}-y${world.year}.json`, JSON.stringify(world.serialize()), 'application/json');
};
$('bLoad').onclick = () => {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    try {
      world = World.deserialize(JSON.parse(await f.text()));
      cam = new Camera(canvas.clientWidth, canvas.clientHeight);
      selected = null; chronicleSeen = world.chronicle.entries.length; opts.flashes.length = 0; resetFeed();
      toast('読み込みました', 'good');
    } catch (err) { toast('読めませんでした: ' + err.message, 'warn'); }
  };
  inp.click();
};
$('bDict').onclick = () => {
  if (!selected) { toast('まず群を選んでください', 'warn'); return; }
  exportDictionary(selected);
};

/* 全史 */
$('bAnnals').onclick = () => { $('annals').classList.add('open'); renderAnnals($('annalsList'), world, $('annalsFilter').value); };
$('annalsClose').onclick = () => $('annals').classList.remove('open');
$('annalsFilter').onchange = () => renderAnnals($('annalsList'), world, $('annalsFilter').value);

addEventListener('keydown', e => {
  if (e.key === ' ') { setSpeed(speed === 0 ? 2 : 0, speed === 0 ? $('b1x') : $('bPause')); e.preventDefault(); }
  if (e.key === '1') setSpeed(2, $('b1x'));
  if (e.key === '2') setSpeed(8, $('b4x'));
  if (e.key === '3') setSpeed(24, $('b16x'));
  if (e.key === 'Escape') $('annals').classList.remove('open');
});

/* 言語史 → 地図の波紋 */
const FLASH_KINDS = new Set([EV.BIRTH, EV.SHIFT, EV.SPLIT, EV.BORROW, EV.DEATH]);
function harvestFlashes() {
  const es = world.chronicle.entries;
  for (; chronicleSeen < es.length; chronicleSeen++) {
    const e = es[chronicleSeen];
    if (e.x === undefined || !FLASH_KINDS.has(e.kind)) continue;
    const hue = e.conceptId ? (CONCEPTS.find(c => c.id === e.conceptId)?.hue ?? 0) : 0;
    opts.flashes.push({ x: e.x, y: e.y, hue, t0: performance.now() });
    if (opts.flashes.length > 30) opts.flashes.shift();
  }
}

function exportDictionary(d) {
  const lines = [`# ${d.name}語 辞書（紀元 ${world.year} 年）`, ''];
  for (const c of CONCEPTS) {
    const es = d.lexicon.entries(c.id).slice().sort((a, b) => b.strength - a.strength);
    if (!es.length) { lines.push(`${c.label}（${c.gloss}）: —`); continue; }
    const main = wordToKana(es[0].form);
    const syn = es.slice(1, 5).map(e => wordToKana(e.form)).join('、');
    lines.push(`${c.label}（${c.gloss}）: ${main}${syn ? `　［異形: ${syn}］` : ''}`);
  }
  download(`${d.name}go-jisho.txt`, lines.join('\n'));
}

/* ---------- ループ ---------- */
let frame = 0;
function loop(now) {
  const dt = now - lastFrame; lastFrame = now;
  fps = fps * 0.95 + (1000 / Math.max(dt, 1)) * 0.05;

  for (let i = 0; i < speed; i++) world.step();
  harvestFlashes();
  if (selected && selected.diedAt !== null) selected = null;
  opts.selected = selected;

  drawMap(ctx, world, cam, opts, canvas.clientWidth, canvas.clientHeight);

  frame++;
  if (frame % 4 === 0) {
    drawMinimap(miniCtx, world, cam, miniCv.width, miniCv.height, canvas.clientWidth, canvas.clientHeight);
    drawChart(chartCtx, world, chartCv.width, chartCv.height);
    renderFeed($('events'), world);
    renderDictionary($('dict'), world, selected);
    const last = world.history[world.history.length - 1];
    $('hud').textContent =
      `紀元 ${world.year.toLocaleString()} 年 · ${world.aliveDemes().length} の言語 · ` +
      `${last ? last.words : 0} 語 · 理解度 ${last ? (last.comprehension * 100 | 0) : 0}% · ${Math.round(fps)} fps`;
    $('seed').textContent = `seed ${world.seed}`;
  }
  requestAnimationFrame(loop);
}

$('bBegin').addEventListener('click', () => $('intro').classList.add('gone'));

resize();
cam = new Camera(canvas.clientWidth, canvas.clientHeight);
setSpeed(2, $('b1x'));
requestAnimationFrame(loop);
