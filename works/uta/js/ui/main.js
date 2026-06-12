import { World } from '../core/world.js';
import { EV } from '../core/chronicle.js';
import { melodyToKana } from '../core/scale.js';
import { OCCASIONS, OCCASION_IDS, occasionById } from '../core/occasions.js';
import { Camera, drawMap, drawMinimap } from './render.js';
import { renderSongbook, resetSongbook, renderFeed, resetFeed, renderAnnals, drawChart } from './panels.js';
import { Player } from './audio.js';
import { download, toast } from './dom.js';

/* ============================================================
   歌 — ループと、読者の耳。
   歌は core が生む。ここは、その歌声が聴こえる窓。
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
const player = new Player();
let nextSongAt = 0;       // 世界が次に歌う時刻 (performance.now ms)

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
  for (const f of world.aliveFlocks()) {
    const dd = (f.x - p.x) ** 2 + (f.y - p.y) ** 2;
    if (dd < bestD) { bestD = dd; best = f; }
  }
  selected = best;
  resetSongbook();
}

/* ---------- 演奏 ---------- */

/* 群の歌をひとつ歌わせて、地図に波紋を立てる */
function sing(flock, song, occ) {
  const pan = (flock.x - 100) / 110;
  const vel = 0.3 + Math.min(0.45, Math.sqrt(flock.pop) / 50);
  const dur = player.play(song.melody, { pan, vel });
  opts.flashes.push({ x: flock.x, y: flock.y, hue: occ.hue, t0: performance.now(), long: true });
  if (opts.flashes.length > 30) opts.flashes.shift();
  return dur;
}

/* 世界の合唱：おりおりに、どこかの群が愛唱歌を歌う */
function worldSings(now) {
  if (!player.enabled || now < nextSongAt) return;
  const alive = world.aliveFlocks();
  if (!alive.length) { nextSongAt = now + 2000; return; }
  // 人口の大きい群ほど声が届く
  let total = 0;
  for (const f of alive) total += f.pop;
  let r = Math.random() * total;
  let flock = alive[alive.length - 1];
  for (const f of alive) { r -= f.pop; if (r < 0) { flock = f; break; } }
  // 場は世界の切実さで（事件の最中はその歌が聴こえてくる）
  const oid = OCCASION_IDS[weightedIndex(OCCASION_IDS.map(id => world.relevance[id]))];
  const song = flock.repertoire.dominant(oid);
  if (!song) { nextSongAt = now + 900; return; }
  const dur = sing(flock, song, occasionById[oid]);
  nextSongAt = now + dur * 1000 + 700 + Math.random() * 1600;
}
function weightedIndex(ws) {
  let sum = 0; for (const w of ws) sum += w;
  let r = Math.random() * sum;
  for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r < 0) return i; }
  return ws.length - 1;
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

$('bSound').onclick = e => {
  player.setEnabled(!player.enabled);
  e.currentTarget.classList.toggle('active', player.enabled);
  e.currentTarget.textContent = player.enabled ? '♪ 歌が聴こえる' : '♪ 沈黙';
};

$('bContact').classList.toggle('active', opts.showContact);
$('bContact').onclick = e => { opts.showContact = !opts.showContact; e.currentTarget.classList.toggle('active', opts.showContact); };

$('bNew').onclick = () => {
  if (!confirm('この歌の歴史を閉じて、新しい静寂の世界から始めますか？')) return;
  world = new World((Math.random() * 2 ** 31) | 0);
  cam = new Camera(canvas.clientWidth, canvas.clientHeight);
  selected = null; chronicleSeen = 0; opts.flashes.length = 0; resetFeed(); resetSongbook();
};
$('bSave').onclick = () => {
  download(`uta-${world.seed}-y${world.year}.json`, JSON.stringify(world.serialize()), 'application/json');
};
$('bLoad').onclick = () => {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json';
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    try {
      world = World.deserialize(JSON.parse(await f.text()));
      cam = new Camera(canvas.clientWidth, canvas.clientHeight);
      selected = null; chronicleSeen = world.chronicle.entries.length; opts.flashes.length = 0;
      resetFeed(); resetSongbook();
      toast('読み込みました', 'good');
    } catch (err) { toast('読めませんでした: ' + err.message, 'warn'); }
  };
  inp.click();
};
$('bBook').onclick = () => {
  if (!selected) { toast('まず群を選んでください', 'warn'); return; }
  exportSongbook(selected);
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

/* 歌史 → 地図の波紋 */
const FLASH_KINDS = new Set([EV.BIRTH, EV.VAR, EV.SHIFT, EV.SPLIT, EV.SPREAD, EV.DEATH]);
function harvestFlashes() {
  const es = world.chronicle.entries;
  if (chronicleSeen > es.length) chronicleSeen = 0;
  for (; chronicleSeen < es.length; chronicleSeen++) {
    const e = es[chronicleSeen];
    if (e.x === undefined || !FLASH_KINDS.has(e.kind)) continue;
    const hue = e.occasionId ? (occasionById[e.occasionId]?.hue ?? 0) : 0;
    opts.flashes.push({ x: e.x, y: e.y, hue, t0: performance.now() });
    if (opts.flashes.length > 30) opts.flashes.shift();
  }
}

function exportSongbook(f) {
  const lines = [`# ${f.name}の民の歌集（紀元 ${world.year} 年）`, '',
    '低いオクターブはひらがな、高いオクターブはカタカナ。「ー」は伸ばし。', ''];
  for (const o of OCCASIONS) {
    const list = f.repertoire.entries(o.id).slice().sort((a, b) => b.strength - a.strength);
    if (!list.length) { lines.push(`${o.label}（${o.gloss}）: —`); continue; }
    const main = melodyToKana(list[0].melody);
    const alt = list.slice(1, 4).map(s => melodyToKana(s.melody)).join('、');
    lines.push(`${o.label}（${o.gloss}）: ${main}${alt ? `　［異節: ${alt}］` : ''}`);
  }
  download(`${f.name}-kashu.txt`, lines.join('\n'));
}

/* ---------- ループ ---------- */
let frame = 0;
function loop(now) {
  const dt = now - lastFrame; lastFrame = now;
  fps = fps * 0.95 + (1000 / Math.max(dt, 1)) * 0.05;

  for (let i = 0; i < speed; i++) world.step();
  harvestFlashes();
  worldSings(now);
  if (selected && selected.diedAt !== null) { selected = null; resetSongbook(); }
  opts.selected = selected;

  drawMap(ctx, world, cam, opts, canvas.clientWidth, canvas.clientHeight);

  frame++;
  if (frame % 4 === 0) {
    drawMinimap(miniCtx, world, cam, miniCv.width, miniCv.height, canvas.clientWidth, canvas.clientHeight);
    drawChart(chartCtx, world, chartCv.width, chartCv.height);
    renderFeed($('events'), world);
    renderSongbook($('songbook'), world, selected, (song, flock, occ) => {
      player.setEnabled(true);
      $('bSound').classList.add('active');
      $('bSound').textContent = '♪ 歌が聴こえる';
      sing(flock, song, occ);
    });
    const last = world.history[world.history.length - 1];
    $('hud').textContent =
      `紀元 ${world.year.toLocaleString()} 年 · ${world.aliveFlocks().length} の群 · ` +
      `${last ? last.songs : 0} の歌 · 覚えやすさ ${last ? (last.catchiness * 100 | 0) : 0} · ${Math.round(fps)} fps`;
    $('seed').textContent = `seed ${world.seed}`;
  }
  requestAnimationFrame(loop);
}

$('bBegin').addEventListener('click', () => {
  $('intro').classList.add('gone');
  // ボタンを押した手が、そのまま音への扉になる
  player.setEnabled(true);
  $('bSound').classList.add('active');
  $('bSound').textContent = '♪ 歌が聴こえる';
});

resize();
cam = new Camera(canvas.clientWidth, canvas.clientHeight);
setSpeed(2, $('b1x'));
requestAnimationFrame(loop);
