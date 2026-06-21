/* 証 — 操作。打ち込んだ言葉（空なら「無」）を、その場で証に結晶させる。
   コア(akashi.js)をそのまま使う。紋章を描き、指紋を示し、旋律を鳴らす。 */
import { akashi, midiToHz } from '../core/akashi.js';

const $ = id => document.getElementById(id);
const cv = $('sigil'), ctx = cv.getContext('2d');
const dpr = Math.min(2, devicePixelRatio || 1);
cv.width = 420 * dpr; cv.height = 420 * dpr; ctx.scale(dpr, dpr);
let current = null, t0 = 0;

function render(input) {
  current = akashi(input);
  $('reading').innerHTML = `${current.name} <small>仮の読み</small>`;
  $('hex').textContent = current.hex;
  t0 = performance.now();
  document.documentElement.style.setProperty('--accent', `hsl(${current.sigil.hue} 80% 75%)`);
}

function draw() {
  requestAnimationFrame(draw);
  if (!current) return;
  const { n, cells, hue, hue2 } = current.sigil;
  const S = 420, pad = 46, cell = (S - pad * 2) / n;
  ctx.clearRect(0, 0, S, S);
  // 印章の地と縁
  const aura = ctx.createRadialGradient(S / 2, S * 0.46, 0, S / 2, S * 0.46, S * 0.6);
  aura.addColorStop(0, `hsl(${hue} 55% 16%)`); aura.addColorStop(1, '#0a0910');
  ctx.fillStyle = aura; roundRect(12, 12, S - 24, S - 24, 16); ctx.fill();
  ctx.strokeStyle = `hsla(${hue},50%,55%,0.45)`; ctx.lineWidth = 1.5; roundRect(12, 12, S - 24, S - 24, 16); ctx.stroke();
  // セルが順に立ち上がる（証が結晶する）
  const el = (performance.now() - t0) / 1000;
  let k = 0;
  const g = ctx.createLinearGradient(pad, pad, S - pad, S - pad);
  g.addColorStop(0, `hsl(${hue} 75% 64%)`); g.addColorStop(1, `hsl(${hue2} 70% 56%)`);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++, k++) {
    if (!cells[r][c]) continue;
    const appear = Math.min(1, Math.max(0, (el - k * 0.012) * 6));
    if (appear <= 0) continue;
    const x = pad + c * cell, y = pad + r * cell, m = cell * 0.12 + (1 - appear) * cell * 0.4;
    ctx.globalAlpha = appear; ctx.fillStyle = g;
    roundRect(x + m, y + m, cell - m * 2, cell - m * 2, cell * 0.18); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

/* 旋律：やわらかな鐘（forge.js と同じ響き） */
let actx = null;
function playTune() {
  if (!current) return;
  actx = actx || new (window.AudioContext || window.webkitAudioContext)();
  if (actx.state === 'suspended') actx.resume();
  const beat = 0.42; let t = actx.currentTime + 0.05;
  const master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination);
  for (const note of current.tune) {
    const f = midiToHz(note.midi);
    for (const [h, g, dec] of [[1, 1, 3.2], [2, 0.5, 5], [3, 0.25, 7]]) {
      const o = actx.createOscillator(), ga = actx.createGain();
      o.frequency.value = f * h; o.connect(ga); ga.connect(master);
      ga.gain.setValueAtTime(0, t); ga.gain.linearRampToValueAtTime(0.3 * g, t + 0.01);
      ga.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      o.start(t); o.stop(t + 1.05);
    }
    t += note.dur * beat;
  }
}

$('in').addEventListener('input', e => render(e.target.value));
$('play').addEventListener('click', playTune);
render('');             // 既定は「無」の証
requestAnimationFrame(draw);
