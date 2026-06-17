/* 響 — 操作。種を入れて物体を鋳り、触れて鳴らす。
   目を閉じても、風がときおりそっと鳴らす。ただ聴くための場所。 */

import { cast, describe } from '../core/hibiki.js';
import { Engine } from './audio.js';
import { layout, draw, pick } from './render.js';

const $ = id => document.getElementById(id);
const cv = $('stage'), ctx = cv.getContext('2d');
const engine = new Engine();

const S = { seed: 'kanata', ens: null, objs: [], ripples: [], wind: true, raf: 0, lastWind: 0 };

function fit() {
  const r = cv.parentElement.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(280, Math.floor(r.width * dpr));
  cv.height = Math.max(320, Math.floor((r.height || 520) * dpr));
  cv.style.width = r.width + 'px'; cv.style.height = (r.height || 520) + 'px';
  if (S.ens) S.objs = layout(S.ens, cv.width, cv.height);
}

function ringObject(o, velocity) {
  o.pulse = Math.min(1.4, 0.7 + velocity);
  engine.hit(o.i, velocity, o.pan);
  S.ripples.push({ x: o.x, y: o.y, hue: o.hue, r0: o.r, spread: o.r * 6, life: 1 });
}

function loop(now) {
  // 風：目を閉じていても、ときおり柔らかい物がひとつ鳴る。
  if (S.wind && now - S.lastWind > 1400 + Math.random() * 2600) {
    S.lastWind = now;
    if (S.objs.length) ringObject(S.objs[(Math.random() * S.objs.length) | 0], 0.18 + Math.random() * 0.22);
  }
  for (const o of S.objs) o.pulse *= 0.92;
  S.ripples = S.ripples.filter(r => (r.life -= 0.018) > 0);
  draw(ctx, cv.width, cv.height, S.objs, S.ripples);
  S.raf = requestAnimationFrame(loop);
}

function recast(seed) {
  S.seed = (seed ?? $('seed').value ?? '').trim() || 'kanata';
  $('seed').value = S.seed;
  S.ens = cast(S.seed);
  engine.setEnsemble(S.ens, S.seed);
  fit();
  const d = describe(S.seed);
  $('name').textContent = d.name;
  $('about').textContent = `${d.material} ・ ${d.scale}旋 ・ ${d.count}つ ・ 余韻 ${d.t60}s`;
  history.replaceState(null, '', `${location.pathname}${location.search}#s=${encodeURIComponent(S.seed)}`);
}

/* 触れて鳴らす（マルチタッチ可）。 */
function at(ev) {
  const r = cv.getBoundingClientRect();
  const x = (ev.clientX - r.left) * (cv.width / r.width);
  const y = (ev.clientY - r.top) * (cv.height / r.height);
  const o = pick(S.objs, x, y);
  if (o) { engine.ensure(); ringObject(o, 0.85); }
}
cv.addEventListener('pointerdown', e => { e.preventDefault(); at(e); }, { passive: false });
cv.style.touchAction = 'none';

$('cast').onclick = () => { engine.ensure(); recast(); };
$('seed').addEventListener('keydown', e => { if (e.key === 'Enter') { engine.ensure(); recast(); } });
$('another').onclick = () => { engine.ensure(); recast('響' + Math.floor(Math.random() * 1e6)); };
$('wind').onclick = () => { S.wind = !S.wind; $('wind').textContent = S.wind ? '風：あり' : '風：なし'; };
$('share').onclick = () => {
  const url = location.href.split('#')[0] + '#s=' + encodeURIComponent(S.seed);
  navigator.clipboard?.writeText(url).then(() => { const b = $('share'), t = b.textContent; b.textContent = 'うつした'; setTimeout(() => b.textContent = t, 1200); });
};
window.addEventListener('resize', fit);

const m = String(location.hash || '').match(/[#&]s=([^&]+)/);
recast(m ? decodeURIComponent(m[1]) : 'kanata');
S.raf = requestAnimationFrame(loop);
