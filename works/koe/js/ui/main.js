/* 声 — 操作。上のパッドで母音をえらび（あいうえおの間をなめらかに）、
   下の鍵盤で五音の高さを鳴らす。重ねて押せば合唱になる。
   「歌う」で、種の合唱がことばのない歌を自動で歌う。 */

import { VOWELS, VOWEL_IDS, degreeHz, choir, phrase, voiceName, scaleVowel } from '../core/koe.js';
import { Engine } from './audio.js';

const cv = document.getElementById('stage'), ctx = cv.getContext('2d');
const engine = new Engine();
const $ = id => document.getElementById(id);

const F2MAX = 2300, F2MIN = 850, F1MIN = 300, F1MAX = 820;
const labelPos = v => ({ nx: (F2MAX - v.f[1]) / (F2MAX - F2MIN), ny: (v.f[0] - F1MIN) / (F1MAX - F1MIN) });
function formantFromPad(nx, ny) {
  nx = Math.max(0, Math.min(1, nx)); ny = Math.max(0, Math.min(1, ny));
  const F2 = F2MAX - nx * (F2MAX - F2MIN), F1 = F1MIN + ny * (F1MAX - F1MIN);
  return { f: [F1, F2, 2600], bw: [80, 100, 120], g: [1, 0.5, 0.2] };
}
function nearestVowel(nx, ny) {
  let best = 'a', bd = 9;
  for (const id of VOWEL_IDS) { const p = labelPos(VOWELS[id]); const d = (p.nx - nx) ** 2 + (p.ny - ny) ** 2; if (d < bd) { bd = d; best = id; } }
  return best;
}

const KEYS = 8;                                // 五音の鍵盤の数
const S = {
  started: false, seed: 'koe', rootMidi: 57,
  pad: { nx: labelPos(VOWELS.a).nx, ny: labelPos(VOWELS.a).ny },
  vowel: formantFromPad(labelPos(VOWELS.a).nx, labelPos(VOWELS.a).ny),
  keyVoices: new Map(), padPtr: null, pressed: new Set(),
  auto: false, choir: null, autoVoices: [], autoIdx: 0, autoNext: 0, autoNotes: [], curVowelId: 'a',
};

function fit() {
  const r = cv.parentElement.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = Math.max(280, r.width * dpr | 0); cv.height = Math.max(360, (r.height || 520) * dpr | 0);
  cv.style.width = r.width + 'px'; cv.style.height = (r.height || 520) + 'px';
}
addEventListener('resize', fit); fit();

const padRect = () => ({ x: 0, y: 0, w: cv.width, h: cv.height * 0.58 });
const keyRect = () => ({ x: 0, y: cv.height * 0.6, w: cv.width, h: cv.height * 0.4 });
const keyAt = (px) => Math.max(0, Math.min(KEYS - 1, Math.floor(px / cv.width * KEYS)));

/* ---------- 音 ---------- */
function setPadVowel(nx, ny) {
  S.pad = { nx, ny }; S.vowel = formantFromPad(nx, ny); S.curVowelId = nearestVowel(nx, ny);
  const now = engine.ctx ? engine.ctx.currentTime : 0;
  for (const v of S.keyVoices.values()) v.voice.setVowel(S.vowel, now, 0.06);
}
function pressKey(id, key) {
  const f0 = degreeHz(S.rootMidi, key);
  const v = engine.voice(); v.on(f0, S.vowel, engine.ctx.currentTime, 0.5);
  S.keyVoices.set(id, { voice: v, key }); S.pressed.add(key);
}
function releaseKey(id) {
  const kv = S.keyVoices.get(id); if (!kv) return;
  kv.voice.off(); S.pressed.delete(kv.key); S.keyVoices.delete(id);
}

/* ---------- 自動歌唱 ---------- */
function startAuto() {
  S.choir = choir(S.seed); S.rootMidi = S.choir.rootMidi;
  S.autoNotes = phrase(S.seed, 4); S.autoIdx = 0; S.autoNext = engine.ctx.currentTime + 0.1;
  S.autoVoices = S.choir.singers.map(() => engine.voice());
  S.auto = true; $('sing').textContent = '■ とめる';
}
function stopAuto() {
  S.auto = false; for (const v of S.autoVoices) v.off(); S.autoVoices = []; $('sing').textContent = '♪ 歌う';
}
function autoTick() {
  if (!S.auto || !engine.ctx) return;
  const beat = 0.5;
  while (engine.ctx.currentTime + 0.05 >= S.autoNext) {
    const note = S.autoNotes[S.autoIdx % S.autoNotes.length];
    const dur = note.dur * beat;
    S.curVowelId = note.vowel; const lp = labelPos(VOWELS[note.vowel]); S.pad = lp;
    S.choir.singers.forEach((s, i) => {
      const f0 = degreeHz(S.choir.rootMidi, note.degree) * Math.pow(2, s.detune / 1200);
      const vw = scaleVowel(VOWELS[note.vowel], s.tract);
      const v = S.autoVoices[i]; v.setVib(s.vibR);
      if (!v.active) v.on(f0, vw, S.autoNext, 0.4); else { v.glideTo(f0, S.autoNext); v.setVowel(vw, S.autoNext, 0.12); }
    });
    S.autoIdx++; S.autoNext += dur;
  }
}

/* ---------- 描画 ---------- */
function draw() {
  requestAnimationFrame(draw);
  if (S.started) autoTick();
  const W = cv.width, H = cv.height;
  ctx.fillStyle = '#0a0710'; ctx.fillRect(0, 0, W, H);
  const pr = padRect(), kr = keyRect();

  // 母音空間のパッド
  ctx.fillStyle = '#120c1b'; ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
  ctx.strokeStyle = 'rgba(200,150,255,.12)'; ctx.lineWidth = 1;
  ctx.strokeRect(pr.x + 6, pr.y + 6, pr.w - 12, pr.h - 12);
  ctx.fillStyle = 'rgba(190,170,220,.4)'; ctx.font = '11px ui-monospace,monospace';
  ctx.textAlign = 'left'; ctx.fillText('← 舌：前　　後 →', 12, pr.h - 12);
  ctx.save(); ctx.translate(14, pr.h / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('← 口：開く　閉じる →', 0, 0); ctx.restore();
  // 五母音の点
  for (const id of VOWEL_IDS) {
    const p = labelPos(VOWELS[id]); const x = pr.x + 12 + p.nx * (pr.w - 24), y = pr.y + 12 + p.ny * (pr.h - 24);
    const on = id === S.curVowelId;
    ctx.fillStyle = on ? '#ffd9a0' : 'rgba(190,160,230,.5)';
    ctx.font = `${on ? 700 : 400} ${on ? 34 : 24}px ui-sans-serif,system-ui,sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(VOWELS[id].ja, x, y);
  }
  // いまの母音カーソル
  const cxp = pr.x + 12 + S.pad.nx * (pr.w - 24), cyp = pr.y + 12 + S.pad.ny * (pr.h - 24);
  const glow = ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, 46);
  glow.addColorStop(0, 'rgba(255,210,150,.5)'); glow.addColorStop(1, 'rgba(255,210,150,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cxp, cyp, 46, 0, 7); ctx.fill();
  ctx.strokeStyle = '#ffd9a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cxp, cyp, 12, 0, 7); ctx.stroke();

  // 鍵盤
  for (let k = 0; k < KEYS; k++) {
    const x = kr.x + k / KEYS * kr.w, w = kr.w / KEYS;
    const on = S.pressed.has(k);
    ctx.fillStyle = on ? 'rgba(255,200,140,.85)' : (k % 5 === 0 ? '#1c1426' : '#160f1f');
    ctx.fillRect(x + 1, kr.y, w - 2, kr.h);
    ctx.strokeStyle = 'rgba(200,160,255,.12)'; ctx.strokeRect(x + 1, kr.y, w - 2, kr.h);
    if (on) {
      const orb = ctx.createRadialGradient(x + w / 2, kr.y + kr.h * 0.4, 0, x + w / 2, kr.y + kr.h * 0.4, w * 0.7);
      orb.addColorStop(0, 'rgba(255,230,180,.7)'); orb.addColorStop(1, 'rgba(255,230,180,0)');
      ctx.fillStyle = orb; ctx.fillRect(x, kr.y, w, kr.h);
    }
  }
  // 大きな今の母音
  ctx.globalAlpha = 0.12; ctx.fillStyle = '#ffd9a0';
  ctx.font = `800 ${pr.h * 0.5}px ui-sans-serif,system-ui,sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(VOWELS[S.curVowelId].ja, W / 2, pr.h * 0.42); ctx.globalAlpha = 1;
}
requestAnimationFrame(draw);

/* ---------- 入力 ---------- */
function pos(ev) { const r = cv.getBoundingClientRect(); return { x: (ev.clientX - r.left) * cv.width / r.width, y: (ev.clientY - r.top) * cv.height / r.height }; }
cv.addEventListener('pointerdown', ev => {
  ev.preventDefault(); engine.resume(); if (!S.started) return; if (S.auto) return;
  const p = pos(ev), pr = padRect();
  if (p.y < pr.h) { S.padPtr = ev.pointerId; setPadVowel((p.x - 12) / (pr.w - 24), (p.y - 12) / (pr.h - 24)); }
  else { pressKey(ev.pointerId, keyAt(p.x)); }
}, { passive: false });
cv.addEventListener('pointermove', ev => {
  if (!S.started || S.auto) return; const p = pos(ev), pr = padRect();
  if (S.padPtr === ev.pointerId) setPadVowel((p.x - 12) / (pr.w - 24), (p.y - 12) / (pr.h - 24));
  else if (S.keyVoices.has(ev.pointerId)) {
    const kv = S.keyVoices.get(ev.pointerId), k = keyAt(p.x);
    if (k !== kv.key && p.y >= pr.h) { kv.voice.glideTo(degreeHz(S.rootMidi, k)); S.pressed.delete(kv.key); kv.key = k; S.pressed.add(k); }
  }
});
function up(ev) { if (S.padPtr === ev.pointerId) S.padPtr = null; releaseKey(ev.pointerId); }
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.style.touchAction = 'none';

/* ---------- ボタン ---------- */
for (const id of VOWEL_IDS) { const b = document.querySelector(`[data-v="${id}"]`); if (b) b.onclick = () => { const p = labelPos(VOWELS[id]); setPadVowel(p.nx, p.ny); }; }
$('sing').onclick = () => { engine.resume(); if (!S.started) return; S.auto ? stopAuto() : startAuto(); };
$('seed').addEventListener('change', e => { S.seed = e.target.value.trim() || 'koe'; if (S.auto) { stopAuto(); startAuto(); } });
$('another').onclick = () => { S.seed = '声' + (Math.random() * 1e6 | 0); $('seed').value = S.seed; if (S.auto) { stopAuto(); startAuto(); } };

/* ---------- 起動 ---------- */
const overlay = document.getElementById('overlay');
function launch() { if (S.started) return; engine.start(); S.started = true; overlay.classList.add('gone'); }
$('launch').onclick = launch; overlay.onclick = launch;
