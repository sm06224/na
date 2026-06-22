/* ============================================================
   影 — 操作と上演。灯りを掴んで動かせば影が振れ、切り絵を奥へ送れば
   影はふくらんで惚け、壁ぎわへ寄せれば締まる。一幕は #s= に畳めて、
   誰かと同じ影を分かち合える（会える種）。
   ============================================================ */

import { packScene, unpackScene, castPuppet } from '../core/kage.js';
import { PUPPETS, KINDS } from '../core/puppets.js';
import { makeView, render, thumbPath } from './render.js';

const DEPTH_MIN = 0.18, DEPTH_MAX = 0.95;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const canvas = document.getElementById('wall');
const ctx = canvas.getContext('2d');
let view = makeView(1, 1);
let selected = null;

/* 場面に立つ切り絵には、型の多角形（parts）を結びつけておく。
   射影も当たり判定も puppet.parts を読むので、ここで必ず付ける。 */
const withGeom = (p) => ({ ...p, parts: PUPPETS[p.kind].parts });

/* ---- 初めの一幕（または #s= で分かち合われた幕）---- */
function defaultScene() {
  return {
    lamp: { x: 0.5, y: 0.82 },
    puppets: [
      { kind: 'tsuki', x: 0.24, y: 0.18, depth: 0.92, scale: 0.24, rot: 0 },
      { kind: 'yama', x: 0.5, y: 0.66, depth: 0.88, scale: 0.72, rot: 0 },
      { kind: 'ki', x: 0.72, y: 0.6, depth: 0.72, scale: 0.3, rot: 0 },
      { kind: 'tori', x: 0.4, y: 0.42, depth: 0.62, scale: 0.2, rot: -0.18 },
    ].map(withGeom),
  };
}

function sceneFromHash() {
  const h = location.hash;
  if (!h.startsWith('#s=')) return null;
  try {
    const s = unpackScene(decodeURIComponent(h.slice(3)));
    s.puppets = s.puppets
      .filter((p) => PUPPETS[p.kind])
      .map((p) => withGeom({ ...p, depth: clamp(p.depth, DEPTH_MIN, DEPTH_MAX), scale: clamp(p.scale, 0.05, 1.2) }));
    if (!Number.isFinite(s.lamp.x)) return null;
    return s;
  } catch { return null; }
}

let scene = sceneFromHash() || defaultScene();

/* ---- 当たり判定 ---- */
function pointInParts(parts, x, y) {
  let inside = false;
  for (const part of parts) {
    for (let i = 0, j = part.length - 1; i < part.length; j = i++) {
      const [xi, yi] = part[i], [xj, yj] = part[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

function lampHitPx(px, py) {
  const [lx, ly] = view.toPx(scene.lamp.x, scene.lamp.y);
  return Math.hypot(px - lx, py - ly) < view.unit * 0.05;
}

// 触れるのは「影」そのもの。当たり判定は壁に落ちた影の形で。
function shadowParts(pup) {
  return castPuppet(scene.lamp, pup).parts.map((part) => part.map((v) => [v.x, v.y]));
}
// 重なったら、画面でいちばん手前に見える影を選ぶ。描画は深さの降順
// （浅い＝灯りに近いものほど後に描かれて上に来る）。当たり判定もそれに揃える：
// 当たった影のうち深さ最小（同値なら後から足した方）を返す。
function puppetAt(sx, sy) {
  let best = null, bestDepth = Infinity, bestIdx = -1;
  for (let i = 0; i < scene.puppets.length; i++) {
    const pup = scene.puppets[i];
    if (!pointInParts(shadowParts(pup), sx, sy)) continue;
    if (pup.depth < bestDepth || (pup.depth === bestDepth && i > bestIdx)) {
      best = pup; bestDepth = pup.depth; bestIdx = i;
    }
  }
  return best;
}

/* ---- ポインタ操作（灯り・切り絵を掴んで動かす／二本指で深さ）---- */
const pointers = new Map();
let drag = null;     // { kind:'lamp'|'puppet', ox, oy }
let pinch = null;    // 二本指の開始時の {dist, depth}

function evStage(e) {
  const r = canvas.getBoundingClientRect();
  const px = (e.clientX - r.left) * (canvas.width / r.width) / dpr;
  const py = (e.clientY - r.top) * (canvas.height / r.height) / dpr;
  return { px, py, sx: view.toStage(px, py)[0], sy: view.toStage(px, py)[1] };
}

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  const p = evStage(e);
  pointers.set(e.pointerId, p);

  if (pointers.size === 2 && selected) {
    const [a, b] = [...pointers.values()];
    pinch = { dist: Math.hypot(a.px - b.px, a.py - b.py), depth: selected.depth };
    drag = null;
    return;
  }
  if (lampHitPx(p.px, p.py)) {
    drag = { kind: 'lamp', ox: p.sx - scene.lamp.x, oy: p.sy - scene.lamp.y };
    return;
  }
  const hit = puppetAt(p.sx, p.sy);
  if (hit) {
    select(hit);
    // 影を指の下に保つ逆射影：切り絵の位置 = 灯り + (指 − 灯り)·深さ。
    drag = { kind: 'puppet',
      ox: hit.x - (scene.lamp.x + (p.sx - scene.lamp.x) * hit.depth),
      oy: hit.y - (scene.lamp.y + (p.sy - scene.lamp.y) * hit.depth) };
  } else {
    select(null);
    drag = { kind: 'lamp', ox: 0, oy: 0 };   // 何も無いところを引けば、灯りそのもの
    scene.lamp.x = p.sx; scene.lamp.y = p.sy;
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) return;
  const p = evStage(e);
  pointers.set(e.pointerId, p);

  if (pinch && pointers.size >= 2 && selected) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.px - b.px, a.py - b.py);
    selected.depth = clamp(pinch.depth * (pinch.dist / Math.max(1, d)), DEPTH_MIN, DEPTH_MAX);
    syncPanel();
    return;
  }
  if (!drag) return;
  if (drag.kind === 'lamp') {
    scene.lamp.x = clamp(p.sx - drag.ox, -0.2, 1.2);
    scene.lamp.y = clamp(p.sy - drag.oy, -0.2, 1.2);
  } else if (selected) {
    selected.x = scene.lamp.x + (p.sx - scene.lamp.x) * selected.depth + drag.ox;
    selected.y = scene.lamp.y + (p.sy - scene.lamp.y) * selected.depth + drag.oy;
  }
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (pointers.size === 0) drag = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

// マウスホイールで、選んだ切り絵の深さ（奥⇄手前）。
canvas.addEventListener('wheel', (e) => {
  if (!selected) return;
  e.preventDefault();
  selected.depth = clamp(selected.depth + e.deltaY * 0.0006, DEPTH_MIN, DEPTH_MAX);
  syncPanel();
}, { passive: false });

/* ---- 選択と操作パネル ---- */
const panel = document.getElementById('panel');
const sDepth = document.getElementById('s-depth');
const sScale = document.getElementById('s-scale');
const sRot = document.getElementById('s-rot');

function select(pup) {
  selected = pup;
  panel.hidden = !pup;
  syncPanel();
}
function syncPanel() {
  if (!selected) return;
  sDepth.value = String(selected.depth);
  sScale.value = String(selected.scale);
  sRot.value = String(selected.rot || 0);
}
sDepth.addEventListener('input', () => { if (selected) selected.depth = +sDepth.value; });
sScale.addEventListener('input', () => { if (selected) selected.scale = +sScale.value; });
sRot.addEventListener('input', () => { if (selected) selected.rot = +sRot.value; });
document.getElementById('b-del').addEventListener('click', () => {
  if (!selected) return;
  scene.puppets = scene.puppets.filter((p) => p !== selected);
  select(null);
});

/* ---- 道具箱（切り絵を足す）---- */
const tray = document.getElementById('tray');
for (const kind of KINDS) {
  const b = document.createElement('button');
  b.className = 'piece';
  b.title = PUPPETS[kind].name;
  b.innerHTML = `<svg viewBox="0 0 40 40" width="34" height="34"><path d="${thumbPath(kind)}" fill="#1a1416"/></svg>`;
  b.addEventListener('click', () => {
    const pup = withGeom({ kind, x: scene.lamp.x, y: clamp(scene.lamp.y - 0.28, 0.1, 0.9), depth: 0.55, scale: 0.3, rot: 0 });
    scene.puppets.push(pup);
    select(pup);
  });
  tray.appendChild(b);
}

/* ---- 分かち合う（#s= の会える種）---- */
const toast = document.getElementById('toast');
document.getElementById('b-share').addEventListener('click', async () => {
  const url = location.origin + location.pathname + '#s=' + encodeURIComponent(packScene(scene));
  try { await navigator.clipboard.writeText(url); flash('この影へのリンクを写しました'); }
  catch { location.hash = 's=' + encodeURIComponent(packScene(scene)); flash('上のリンクが、この影への道です'); }
});
let toastT = 0;
function flash(msg) { toast.textContent = msg; toast.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toast.classList.remove('on'), 2200); }

/* ---- 画面サイズ ---- */
let dpr = 1;
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  view = makeView(w, h);
}
window.addEventListener('resize', resize);
resize();

/* ---- 上演（毎フレーム、炎は揺れる）---- */
const start = performance.now();
function loop(now) {
  render(ctx, view, scene, (now - start) / 1000, selected);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ---- 幕開け ---- */
const intro = document.getElementById('intro');
document.getElementById('b-open').addEventListener('click', () => intro.classList.add('gone'));
if (sceneFromHash()) intro.classList.add('gone');   // 分かち合われた影は、すぐ見せる
