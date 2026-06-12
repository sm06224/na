import { buildList, normalizeProfile, progress, listToText, DEFAULT_PROFILE } from '../core/calc.js';

/* ============================================================
   備 — 画面。計算は core が行い、ここは入力と表を結ぶだけ。
   入力とチェックは localStorage（この端末）にだけ残る。
   ============================================================ */

const $ = id => document.getElementById(id);
const KEY_P = 'sonae.profile.v1';
const KEY_C = 'sonae.checked.v1';

let profile = load(KEY_P) || { ...DEFAULT_PROFILE };
let checked = new Set(load(KEY_C) || []);

function load(k) {
  try { return JSON.parse(localStorage.getItem(k)); } catch { return null; }
}
function save() {
  try {
    localStorage.setItem(KEY_P, JSON.stringify(profile));
    localStorage.setItem(KEY_C, JSON.stringify([...checked]));
  } catch { /* プライベートモード等では保存しないだけ */ }
}

/* ---------- 入力 ---------- */
const WHO = [
  { key: 'adults', label: '大人', sub: '中学生〜64歳' },
  { key: 'children', label: '子ども', sub: '小学生以下（乳幼児を除く）' },
  { key: 'infants', label: '乳幼児', sub: '0〜2歳ごろ' },
  { key: 'elderly', label: '高齢の家族', sub: '65歳以上' },
  { key: 'females', label: '生理用品を使う人', sub: '年齢を問わず' },
  { key: 'pets', label: 'ペット', sub: '犬・猫など' },
];

function renderSteppers() {
  const box = $('steppers');
  box.textContent = '';
  for (const w of WHO) {
    const row = document.createElement('div');
    row.className = 'step';
    const who = document.createElement('span');
    who.className = 'who';
    who.innerHTML = `${w.label}<small>${w.sub}</small>`;
    const minus = document.createElement('button');
    minus.textContent = '−';
    minus.setAttribute('aria-label', `${w.label}を減らす`);
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = profile[w.key];
    const plus = document.createElement('button');
    plus.textContent = '＋';
    plus.setAttribute('aria-label', `${w.label}を増やす`);
    minus.onclick = () => { profile[w.key] = Math.max(0, profile[w.key] - 1); refresh(); };
    plus.onclick = () => { profile[w.key] = Math.min(20, profile[w.key] + 1); refresh(); };
    row.append(who, minus, n, plus);
    box.append(row);
  }
}

function renderDays() {
  $('d3').classList.toggle('active', profile.days === 3);
  $('d7').classList.toggle('active', profile.days === 7);
}
$('d3').onclick = () => { profile.days = 3; refresh(); };
$('d7').onclick = () => { profile.days = 7; refresh(); };

/* ---------- リスト ---------- */
function renderList() {
  const list = buildList(profile);
  const box = $('list');
  box.textContent = '';
  for (const cat of list) {
    const sec = document.createElement('div');
    sec.className = 'cat';
    const h = document.createElement('h3');
    const done = cat.items.filter(i => checked.has(i.id)).length;
    h.innerHTML = `${cat.label} <span class="count">${done} / ${cat.items.length}</span>`;
    sec.append(h);
    for (const item of cat.items) {
      const row = document.createElement('label');
      row.className = 'item' + (checked.has(item.id) ? ' done' : '');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = checked.has(item.id);
      cb.onchange = () => {
        if (cb.checked) checked.add(item.id); else checked.delete(item.id);
        refresh();
      };
      const body = document.createElement('span');
      body.className = 'body';
      body.innerHTML = `<span class="name">${item.name}</span><br><span class="note">${item.note}</span>`;
      const qty = document.createElement('span');
      qty.className = 'qty';
      qty.innerHTML = `${item.qty}<small> ${item.unit}</small>`;
      row.append(cb, body, qty);
      sec.append(row);
    }
    box.append(sec);
  }
  const pr = progress(list, checked);
  $('bar').style.width = `${pr.rate * 100}%`;
  $('rate').textContent = pr.total
    ? `備え ${pr.done} / ${pr.total} 品目（${Math.round(pr.rate * 100)}%）`
    : '家族の人数を入れてください';

  const who = WHO.filter(w => profile[w.key] > 0).map(w => `${w.label}${profile[w.key]}`).join('・');
  $('printHead').textContent =
    `備蓄チェックリスト（${who || '—'}／${profile.days}日分） ` +
    `印刷日: ${new Date().toLocaleDateString('ja-JP')}　□ = これから準備`;
}

/* ---------- 操作 ---------- */
$('bPrint').onclick = () => window.print();
$('bCopy').onclick = async () => {
  const text = listToText(buildList(profile), profile);
  try {
    await navigator.clipboard.writeText(text);
    toast('コピーしました。メモアプリや家族のチャットに貼れます');
  } catch {
    toast('コピーできませんでした');
  }
};
$('bReset').onclick = () => {
  if (!confirm('チェックをすべて外しますか？（家族構成はそのまま）')) return;
  checked.clear();
  refresh();
};

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2600);
}

function refresh() {
  profile = normalizeProfile(profile);
  if (profile.days !== 3 && profile.days !== 7) profile.days = 7;
  save();
  renderSteppers();
  renderDays();
  renderList();
}

refresh();
