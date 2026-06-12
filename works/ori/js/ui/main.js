/* 織り機の前に座る。節を読み、一段ずつ織り、織りながら歌う。 */

import { kanaToMelody, melodyToKana, noteFreq, noteToKana } from '../core/kana.js';
import { weave, fingerprint, clothToSVG, DYES, WARP } from '../core/loom.js';

const $ = id => document.getElementById(id);
const canvas = $('cloth'), ctx = canvas.getContext('2d');

/* ----- 染め見本 ----- */
const KANAS = ['ど', 'れ', 'み', 'そ', 'ら', 'ド', 'レ', 'ミ', 'ソ', 'ラ'];
$('dyes').innerHTML = DYES.map((d, i) =>
  `<span class="dye"><i style="background:${d.hex}"></i><span class="k">${KANAS[i]}</span><span class="n">${d.name}</span></span>`
).join('');

/* ----- 音：織りながら歌う ----- */
let ac = null;
function sing(noteId, when = 0, dur = 0.22) {
  if (!$('sound').checked) return;
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  const t = ac.currentTime + when;
  const osc = ac.createOscillator(), g = ac.createGain();
  osc.type = 'triangle';
  osc.frequency.value = noteFreq(noteId);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.16, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(t); osc.stop(t + dur + 0.05);
}

/* ----- 描画 ----- */
let cloth = null, wovenRows = 0, anim = 0;

function fit() {
  if (!cloth) return;
  const box = $('stage').getBoundingClientRect();
  const pad = 36;
  const cw = Math.max(1, Math.min(
    (box.width - pad) / cloth.warp,
    (box.height - pad) / cloth.rows.length * (8 / 7)));
  const cell = Math.max(2, Math.floor(cw));
  const rowH = Math.max(2, Math.round(cell * 7 / 8));
  const dpr = window.devicePixelRatio || 1;
  canvas.width = cloth.warp * cell * dpr;
  canvas.height = cloth.rows.length * rowH * dpr;
  canvas.style.width = `${cloth.warp * cell}px`;
  canvas.style.height = `${cloth.rows.length * rowH}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cell, rowH };
}

let geom = null;

function drawRow(y) {
  const { cell, rowH } = geom;
  const { bits, deg } = cloth.rows[y];
  for (let x = 0; x < bits.length; x++) {
    // 経糸ごとのわずかな明暗が、糸の並びに見える
    const shade = (x % 2 ? 0 : -7) + ((x * 2654435761 >>> 28) % 5) - 2;
    ctx.fillStyle = tint(bits[x] ? DYES[deg].hex : WARP.hex, shade);
    ctx.fillRect(x * cell, y * rowH, cell, rowH - 1);
  }
}

function tint(hex, d) {
  const v = i => Math.max(0, Math.min(255, parseInt(hex.slice(i, i + 2), 16) + d));
  return `rgb(${v(1)},${v(3)},${v(5)})`;
}

function drawShuttle(y) {
  const { cell, rowH } = geom;
  ctx.fillStyle = 'rgba(255,240,210,.55)';
  ctx.fillRect(0, y * rowH, cloth.warp * cell, 1.5);
}

function hud() {
  const total = cloth.rows.length;
  const n = Math.min(wovenRows, total);
  const cur = n > 0 && n < total ? `　いま：${noteToKana(cloth.rows[n].note)}` : '';
  $('hud').textContent = `緯糸 ${n} / ${total} 段${cur}`;
}

function weaveLoop() {
  const total = cloth.rows.length;
  const perFrame = 2;
  for (let k = 0; k < perFrame && wovenRows < total; k++) {
    const r = cloth.rows[wovenRows];
    // 音の変わり目で、その音を歌う
    if (wovenRows === 0 || r.note !== cloth.rows[wovenRows - 1].note) {
      sing(r.note, 0, 0.18 + 0.1 * (r.note % 3));
    }
    drawRow(wovenRows);
    wovenRows++;
  }
  hud();
  if (wovenRows < total) {
    drawShuttle(wovenRows);
    anim = requestAnimationFrame(weaveLoop);
  } else {
    finish();
  }
}

function finish() {
  $('mei').textContent = fingerprint(cloth);
  $('meiBox').hidden = false;
  $('bSave').disabled = false;
  $('bWeave').textContent = '織り直す';
}

/* ----- 操作 ----- */
function start() {
  cancelAnimationFrame(anim);
  $('error').hidden = true;
  $('meiBox').hidden = true;
  $('bSave').disabled = true;
  let melody;
  try {
    melody = kanaToMelody($('kana').value);
  } catch (e) {
    $('error').textContent = e.message;
    $('error').hidden = false;
    return;
  }
  $('kana').value = melodyToKana(melody);
  cloth = weave(melody, {
    seed: (Number($('seed').value) || 0) >>> 0,
    warp: Number($('warp').value),
    rows: Number($('rows').value),
  });
  geom = fit();
  ctx.fillStyle = '#141210';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  wovenRows = 0;
  weaveLoop();
}

$('bWeave').addEventListener('click', start);

$('bSave').addEventListener('click', () => {
  const blob = new Blob([clothToSVG(cloth)], { type: 'image/svg+xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ori-${fingerprint(cloth)}.svg`;
  a.click();
  URL.revokeObjectURL(a.href);
});

window.addEventListener('resize', () => {
  if (!cloth) return;
  geom = fit();
  ctx.fillStyle = '#141210';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < wovenRows; y++) drawRow(y);
  if (wovenRows < cloth.rows.length) drawShuttle(wovenRows);
});

/* 最初の一枚は、手紙の節を黙って織っておく（音はクリック後の世界のもの） */
start();
