/* 層 — 操作。種を入れて崖を掘り、侵食を待ち、縞に触れて年代記を読む。 */

import { drawCliff } from './render.js';
import { readRecord, deposit } from '../core/strata.js';

const $ = id => document.getElementById(id);
const cv = $('cliff'), ctx = cv.getContext('2d');
const tip = $('tip');

const S = { seed: 'nagori', years: 320, rects: [], reveal: 0, raf: 0 };

function fit() {
  const r = cv.parentElement.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(240, Math.floor(r.width * dpr));
  cv.height = Math.max(320, Math.floor((r.height || 520) * dpr));
  cv.style.width = r.width + 'px';
  cv.style.height = (r.height || 520) + 'px';
}

function paint() {
  S.rects = drawCliff(ctx, cv.width, cv.height, S.seed, S.years, S.reveal);
}

/* 侵食の演出：上から下へ、崖がゆっくり削り出される。 */
function erode() {
  cancelAnimationFrame(S.raf);
  S.reveal = 0;
  const t0 = performance.now();
  const dur = 1100;
  const step = (now) => {
    const k = Math.min(1, (now - t0) / dur);
    S.reveal = k < 1 ? (1 - Math.pow(1 - k, 3)) : 1;   // ease-out
    paint();
    if (k < 1) S.raf = requestAnimationFrame(step);
  };
  S.raf = requestAnimationFrame(step);
}

function chronicle() {
  const rec = readRecord(S.seed, S.years);
  const ul = $('record'); ul.innerHTML = '';
  if (!rec.length) { ul.innerHTML = '<li class="quiet">この大地に、際立つ出来事はなかった。穏やかな歳月だけが積もっている。</li>'; return; }
  for (const e of rec.slice(0, 14)) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="ago ev-${e.event}">${e.ago === 0 ? '今' : e.ago + '年前'}</span> ${e.line}`;
    ul.appendChild(li);
  }
  $('count').textContent = `${S.years}年の地層・${rec.length}本の縞`;
}

function dig(seed) {
  S.seed = (seed ?? $('seed').value ?? '').trim() || 'nagori';
  $('seed').value = S.seed;
  fit(); erode(); chronicle();
}

/* 縞に触れると、その年と粒度をそっと告げる。 */
function locate(ev) {
  const rect = cv.getBoundingClientRect();
  const y = (ev.clientY - rect.top) * (cv.height / rect.height);
  const x = (ev.clientX - rect.left) * (cv.width / rect.width);
  const hit = S.rects.find(r => y >= r.y && y < r.y + r.h && x < r.w);
  if (!hit) { tip.hidden = true; return; }
  const L = hit.layer, ago = S.years - L.year;
  const grainJa = { gravel: '礫', sand: '砂', silt: '泥', clay: '粘土' }[L.grain] || L.grain;
  const evJa = { flood: '・大水', ash: '・火山灰', drought: '・旱魃', quake: '・地震', bloom: '・繁茂' }[L.event] || '';
  tip.textContent = `${ago === 0 ? '今' : ago + '年前'}（第${L.year}年）／${grainJa}${evJa}`;
  tip.style.left = Math.min(rect.width - 140, ev.clientX - rect.left + 12) + 'px';
  tip.style.top = (ev.clientY - rect.top + 12) + 'px';
  tip.hidden = false;
}

$('dig').onclick = () => dig();
$('seed').addEventListener('keydown', e => { if (e.key === 'Enter') dig(); });
$('another').onclick = () => dig('地' + Math.floor(Math.random() * 1e6));
$('span').addEventListener('input', e => { S.years = +e.target.value; $('spanv').textContent = S.years + '年'; dig(S.seed); });
cv.addEventListener('mousemove', locate);
cv.addEventListener('mouseleave', () => { tip.hidden = true; });
cv.addEventListener('click', locate);
window.addEventListener('resize', () => { fit(); paint(); });

$('spanv').textContent = S.years + '年';
dig('nagori');
