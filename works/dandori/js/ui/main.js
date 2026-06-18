/* 段取り — 操作。献立をえらび、配膳と台所を決めると段取りが出る。
   「いま実行」で、現在時刻に「今やること／次の一手」が光る。
   献立は端末から出ない（保存もこの中だけ）。 */

import { PRESETS, presetById, makeDish, totalMin, isIdle } from '../core/dishes.js';
import { schedule, hhmm, parseHHMM, activeAt, nextAfter } from '../core/schedule.js';
import { drawGantt } from './gantt.js';

const $ = id => document.getElementById(id);
const RES_JA = { hands: '手', heat: 'こんろ', oven: 'オーブン' };

const S = {
  menu: [],
  kitchen: { cooks: 1, burners: 2, ovens: 1 },
  serve: 19 * 60,
  live: false,
  now: 0,
  done: new Set(),     // チェックした工程 key
  plan: null,
};

/* ---------- 料理パレット ---------- */
function renderPalette() {
  const p = $('palette'); p.innerHTML = '';
  for (const d of PRESETS) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = `${d.emoji} ${d.name}`;
    b.onclick = () => { S.menu.push(cloneDish(d)); replan(); };
    p.appendChild(b);
  }
}
let uid = 0;
function cloneDish(d) {
  return { ...d, uid: ++uid, steps: d.steps.map(s => ({ ...s })) };
}

/* ---------- 献立リスト ---------- */
function renderMenu() {
  const m = $('menu'); m.innerHTML = '';
  $('empty').hidden = S.menu.length > 0;
  for (const d of S.menu) {
    const row = document.createElement('div'); row.className = 'item';
    const passive = d.steps.filter(isIdle).reduce((a, s) => a + s.min, 0);
    row.innerHTML = `<span class="nm">${d.emoji} ${d.name}</span>` +
      `<span class="meta">${totalMin(d)}分${passive ? `・放置${passive}分` : ''}</span>` +
      `<span class="fr">${'★'.repeat(d.fresh)}${'☆'.repeat(3 - d.fresh)}</span>`;
    const rm = document.createElement('button'); rm.className = 'rm'; rm.textContent = '×';
    rm.title = '外す';
    rm.onclick = () => { S.menu = S.menu.filter(x => x !== d); replan(); };
    row.appendChild(rm);
    m.appendChild(row);
  }
}

/* ---------- 計画 ---------- */
function replan() {
  renderMenu();
  if (!S.menu.length) { $('result').hidden = true; S.plan = null; return; }
  S.plan = schedule(S.menu, { serve: S.serve, kitchen: S.kitchen });
  $('result').hidden = false;
  renderSummary();
  renderSteps();
  paintGantt();
}

function renderSummary() {
  const p = S.plan;
  $('summary').innerHTML = `はじめる <span class="big">${hhmm(p.startAt)}</span>　→　配膳 <b>${hhmm(p.serve)}</b>` +
    `　<span class="meta" style="color:var(--quiet);font-size:12px">（${p.dishes.length}品・${RES_JA.hands}${S.kitchen.cooks}・こんろ${S.kitchen.burners}・オーブン${S.kitchen.ovens}）</span>`;
  const w = $('warnings'); w.innerHTML = '';
  for (const msg of p.warnings) { const d = document.createElement('div'); d.textContent = '⚠ ' + msg; w.appendChild(d); }
}

function stepKey(e) { return `${e.dishId}|${e.name}|${e.at}`; }

function renderSteps() {
  const ol = $('steps'); ol.innerHTML = '';
  const p = S.plan;
  const act = S.live ? new Set(activeAt(p, S.now).map(stepKey)) : new Set();
  const nxt = S.live ? nextAfter(p, S.now) : null;
  for (const e of p.events) {
    const li = document.createElement('li');
    const k = stepKey(e);
    const primary = e.res.includes('oven') ? 'oven' : e.res.includes('heat') ? 'heat' : e.res.includes('hands') ? 'hands' : 'idle';
    if (e.idle) li.classList.add('idle');
    if (S.live && act.has(k)) li.classList.add('now');
    else if (S.live && nxt && stepKey(nxt) === k) li.classList.add('next');
    if (S.done.has(k)) li.classList.add('done');
    const tag = e.idle ? '放置' : e.res.map(r => RES_JA[r]).join('・');
    li.innerHTML = `<span class="t">${hhmm(e.at)}</span><span class="dot ${primary}"></span>` +
      `<span class="nm">${e.emoji} <b>${e.dishName}</b>：${e.name} <span class="meta">（${e.min}分・${tag}）</span></span>`;
    li.onclick = () => { if (S.done.has(k)) S.done.delete(k); else S.done.add(k); renderSteps(); };
    ol.appendChild(li);
  }
}

function paintGantt() {
  const cv = $('gantt');
  const w = cv.parentElement.getBoundingClientRect().width;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rows = S.plan.dishes.length;
  const cssH = 40 + rows * 46;
  cv.width = Math.floor(w * dpr); cv.height = Math.floor(cssH * dpr);
  cv.style.width = w + 'px'; cv.style.height = cssH + 'px';
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
  drawGantt(ctx, w, cssH, S.plan, S.live ? S.now : null);
}

/* ---------- 台所のつまみ ---------- */
function clampKit(k, v) { const lim = { cooks: [1, 6], burners: [0, 6], ovens: [0, 3] }[k]; return Math.max(lim[0], Math.min(lim[1], v)); }
document.querySelectorAll('.stepper button').forEach(b => {
  b.onclick = () => {
    const k = b.dataset.k, d = +b.dataset.d;
    S.kitchen[k] = clampKit(k, S.kitchen[k] + d);
    $(k).textContent = S.kitchen[k];
    replan();
  };
});
$('serve').addEventListener('change', e => { const v = parseHHMM(e.target.value); if (v != null) { S.serve = v; replan(); } });

/* ---------- いま実行 ---------- */
let timer = 0;
function nowMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
$('live').addEventListener('change', e => {
  S.live = e.target.checked;
  if (S.live) { S.now = nowMin(); tick(); timer = setInterval(tick, 15000); }
  else { clearInterval(timer); replan(); }
});
function tick() { S.now = nowMin(); if (S.plan) { renderSteps(); paintGantt(); } }

/* ---------- 自作料理 ---------- */
function addCustomRow(name = '', min = 5) {
  const wrap = $('csteps');
  const row = document.createElement('div'); row.className = 'crow';
  row.innerHTML = `<input class="cn" type="text" placeholder="工程名（例：炒める）" value="${name}">` +
    `<input class="cm" type="number" min="1" max="600" value="${min}">分` +
    `<label><input type="checkbox" class="ch">手</label>` +
    `<label><input type="checkbox" class="ce">🔥</label>` +
    `<label><input type="checkbox" class="co">🔲</label>` +
    `<button class="rm" title="削除">×</button>`;
  row.querySelector('.rm').onclick = () => row.remove();
  wrap.appendChild(row);
}
$('caddstep').onclick = () => addCustomRow();
$('cadd').onclick = () => {
  const name = $('cname').value.trim() || '自作料理';
  const steps = [];
  for (const row of $('csteps').querySelectorAll('.crow')) {
    const nm = row.querySelector('.cn').value.trim();
    const min = +row.querySelector('.cm').value;
    if (!nm || !(min > 0)) continue;
    steps.push({ name: nm, min, hands: row.querySelector('.ch').checked, heat: row.querySelector('.ce').checked, oven: row.querySelector('.co').checked });
  }
  if (!steps.length) return;
  const d = makeDish(name, steps, { emoji: '🍽️', fresh: 2 });
  S.menu.push({ ...d, uid: ++uid });
  $('cname').value = ''; $('csteps').innerHTML = ''; addCustomRow();
  replan();
};

$('print').onclick = () => window.print();
window.addEventListener('resize', () => { if (S.plan) paintGantt(); });

/* ---------- 初期献立（すぐ試せるように） ---------- */
renderPalette();
addCustomRow('炒める', 6);
for (const id of ['gohan', 'miso', 'karaage', 'salad']) S.menu.push(cloneDish(presetById[id]));
replan();
