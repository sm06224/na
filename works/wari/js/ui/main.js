/* 割のへそ — みんなと出費を集め、傾斜をかけ、領収書を添え、
   最小の送金へまとめ、払い終えたらチェックする。 */

import { settle, mergeWeights } from '../core/split.js';

const $ = id => document.getElementById(id);

const state = {
  cur: '¥',
  members: [],          // {id, name, weight}
  expenses: [],         // {id, title, payer, amount, participants:[id], weighted, weights:{id:w}, receipt}
  settled: [],          // 支払い済みの送金キー
  mseq: 1, eseq: 1,
};
let pendingReceipt = null;   // 出費フォームでいま選んでいる領収書

/* ===== 保存と共有（端末の中・リンクの中だけ） ===== */
const KEY = 'wari.v2';
function encode() {
  const idx = new Map(state.members.map((m, i) => [m.id, i]));
  const data = {
    c: state.cur,
    m: state.members.map(m => m.name),
    mw: state.members.map(m => m.weight),
    e: state.expenses.map(e => {
      const o = { t: e.title, p: idx.get(e.payer), a: e.amount, q: e.participants.map(id => idx.get(id)).filter(i => i != null) };
      if (e.weighted) { o.wt = 1; o.w = e.participants.map(id => e.weights[id] ?? 1); }
      return o;
    }),
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(s) {
  const json = decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  const d = JSON.parse(json);
  state.cur = d.c ?? '¥';
  state.members = (d.m || []).map((name, i) => ({ id: i + 1, name, weight: (d.mw && d.mw[i] != null) ? d.mw[i] : 1 }));
  state.mseq = state.members.length + 1;
  state.eseq = 1;
  state.settled = [];
  state.expenses = (d.e || []).map(e => {
    const participants = (e.q || []).map(i => i + 1);
    const weights = {};
    if (e.wt) participants.forEach((id, k) => { weights[id] = (e.w && e.w[k] != null) ? e.w[k] : 1; });
    return { id: state.eseq++, title: e.t || '', payer: (e.p ?? 0) + 1, amount: e.a || 0, participants, weighted: !!e.wt, weights, receipt: null };
  });
}
function saveLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { toast('保存しきれませんでした（領収書が大きすぎるかも）'); }
}
function loadLocal() {
  const raw = localStorage.getItem(KEY);
  if (!raw) return false;
  try {
    const s = JSON.parse(raw);
    Object.assign(state, { cur: s.cur ?? '¥', members: s.members || [], expenses: s.expenses || [], settled: s.settled || [], mseq: s.mseq || (s.members?.length || 0) + 1, eseq: s.eseq || 1 });
    for (const m of state.members) if (m.weight == null) m.weight = 1;
    for (const e of state.expenses) { e.weighted = !!e.weighted; e.weights = e.weights || {}; if (!('receipt' in e)) e.receipt = null; }
    return true;
  } catch { return false; }
}
function persist() {
  saveLocal();
  history.replaceState(null, '', `${location.pathname}#d=${encode()}`);
}

/* ===== お金の表記 ===== */
const yen = n => `${state.cur}${Math.round(n).toLocaleString('ja-JP')}`;

/* ===== メンバー ===== */
function addMembers(text) {
  const names = String(text).split(/[,、\s]+/).map(s => s.trim()).filter(Boolean);
  for (const name of names) state.members.push({ id: state.mseq++, name: name.slice(0, 16), weight: 1 });
  if (names.length) { renderAll(); persist(); }
}
function addCount(n) {
  n = Math.max(0, Math.min(50, Math.floor(n) || 0));
  for (let k = 0; k < n; k++) {
    const i = state.members.length;
    const name = i < 26 ? String.fromCharCode(65 + i) : `${i + 1}`;
    state.members.push({ id: state.mseq++, name, weight: 1 });
  }
  if (n) { renderAll(); persist(); }
}
function renameMember(id) {
  const m = state.members.find(x => x.id === id); if (!m) return;
  const v = prompt('名前', m.name);
  if (v != null && v.trim()) { m.name = v.trim().slice(0, 16); renderAll(); persist(); }
}
function setWeight(id, w) {
  const m = state.members.find(x => x.id === id); if (!m) return;
  m.weight = Math.max(0, Number(w) || 0);
  renderResult(); persist();
}
function removeMember(id) {
  if (state.expenses.some(e => e.payer === id)) return toast('この人が払った出費があるので消せません');
  state.members = state.members.filter(m => m.id !== id);
  for (const e of state.expenses) { e.participants = e.participants.filter(p => p !== id); delete e.weights[id]; }
  renderAll(); persist();
}

function renderMembers() {
  const box = $('members'); box.innerHTML = '';
  if (!state.members.length) { box.innerHTML = '<span class="empty">まず参加者を足してください</span>'; return; }
  for (const m of state.members) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = `<button class="cn" title="名前を変える">${escapeHtml(m.name)}</button>
      <span class="cw">×<input class="cwin" type="number" min="0" step="0.5" value="${m.weight}"></span>
      <button class="x" title="消す">×</button>`;
    chip.querySelector('.cn').addEventListener('click', () => renameMember(m.id));
    chip.querySelector('.cwin').addEventListener('change', e => setWeight(m.id, e.target.value));
    chip.querySelector('.x').addEventListener('click', () => removeMember(m.id));
    box.appendChild(chip);
  }
}

/* ===== 領収書（端末の中で縮小して持つ） ===== */
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1100, scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      try { resolve(c.toDataURL('image/jpeg', 0.72)); } catch (e) { reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像を読めません')); };
    img.src = url;
  });
}
function renderReceiptPrev() {
  const box = $('exReceiptPrev'); box.innerHTML = '';
  if (!pendingReceipt) return;
  box.innerHTML = `<img src="${pendingReceipt}" alt="領収書"><button type="button" class="rcpx" title="外す">×</button>`;
  box.querySelector('img').addEventListener('click', () => openLight(pendingReceipt));
  box.querySelector('.rcpx').addEventListener('click', () => { pendingReceipt = null; renderReceiptPrev(); });
}

/* ===== 出費 ===== */
function renderExpenseForm() {
  $('exPayer').innerHTML = state.members.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  const weighted = $('exWeighted').checked;
  const parts = $('exParts'); parts.innerHTML = '';
  for (const m of state.members) {
    const row = document.createElement('label');
    row.className = 'part';
    row.innerHTML = `<input type="checkbox" class="pck" value="${m.id}" checked>
      <span>${escapeHtml(m.name)}</span>
      <input type="number" class="pw" value="${m.weight}" min="0" step="0.5" ${weighted ? '' : 'hidden'}>`;
    parts.appendChild(row);
  }
}
function addExpenseFromForm(ev) {
  ev.preventDefault();
  if (!state.members.length) return toast('先に参加者を足してください');
  const title = $('exTitle').value.trim() || '出費';
  const payer = Number($('exPayer').value);
  const amount = Math.max(0, Math.round(Number($('exAmount').value) || 0));
  if (!payer) return toast('払った人を選んでください');
  if (amount <= 0) return toast('金額を入れてください');
  const weighted = $('exWeighted').checked;
  const participants = [], weights = {};
  for (const row of $('exParts').querySelectorAll('.part')) {
    const ck = row.querySelector('.pck'); if (!ck.checked) continue;
    const id = Number(ck.value); participants.push(id);
    if (weighted) weights[id] = Math.max(0, Number(row.querySelector('.pw').value) || 0);
  }
  if (!participants.length) return toast('割る人を選んでください');
  state.expenses.push({ id: state.eseq++, title, payer, amount, participants, weighted, weights, receipt: pendingReceipt });
  $('exTitle').value = ''; $('exAmount').value = ''; $('exWeighted').checked = false;
  pendingReceipt = null; renderReceiptPrev();
  renderAll(); persist();
  $('exTitle').focus();
}
function removeExpense(id) { state.expenses = state.expenses.filter(e => e.id !== id); renderAll(); persist(); }
function nameOf(id) { const m = state.members.find(x => x.id === id); return m ? m.name : '？'; }

function renderExpenses() {
  const box = $('expenses'); box.innerHTML = '';
  if (!state.expenses.length) { box.innerHTML = '<span class="empty">出費はまだありません</span>'; return; }
  for (const e of state.expenses) {
    const div = document.createElement('div');
    div.className = 'ex';
    const who = e.participants.length === state.members.length ? '全員' : e.participants.map(nameOf).join('・');
    const tilt = e.weighted ? '　·　傾斜あり' : '';
    div.innerHTML = `${e.receipt ? `<img class="exrcp" src="${e.receipt}" alt="領収書">` : ''}
      <div class="exmain"><span class="extitle">${escapeHtml(e.title)}</span>
      <span class="exmeta">${escapeHtml(nameOf(e.payer))} が立て替え　·　${who}で割る${tilt}</span></div>
      <span class="examt">${yen(e.amount)}</span><button class="x" title="消す">×</button>`;
    if (e.receipt) div.querySelector('.exrcp').addEventListener('click', () => openLight(e.receipt));
    div.querySelector('.x').addEventListener('click', () => removeExpense(e.id));
    box.appendChild(div);
  }
}

/* ===== 精算 ===== */
function resolved() {
  const base = {}; for (const m of state.members) base[m.id] = m.weight;
  return state.expenses.map(e => ({
    payer: e.payer, amount: e.amount, participants: e.participants,
    weights: mergeWeights(e.participants, base, e.weighted ? e.weights : {}),
  }));
}
const tkey = t => `${t.from}>${t.to}>${t.amount}`;

function renderResult() {
  const total = state.expenses.reduce((s, e) => s + e.amount, 0);
  $('total').textContent = total ? `合計 ${yen(total)}` : '';
  if (state.members.length < 2 || !state.expenses.length) {
    $('balances').innerHTML = '<span class="empty">参加者と出費を入れると、ここに精算が出ます</span>';
    $('transfers').innerHTML = ''; return;
  }
  const { balances, transfers } = settle(state.members.map(m => m.id), resolved());

  let bh = '';
  for (const m of state.members) {
    const v = balances.get(m.id) || 0;
    const cls = v > 0 ? 'plus' : v < 0 ? 'minus' : 'zero';
    const label = v > 0 ? `受け取る ${yen(v)}` : v < 0 ? `払う ${yen(-v)}` : '精算ずみ';
    bh += `<div class="bal ${cls}"><span class="bn">${escapeHtml(m.name)}</span><span class="bv">${label}</span></div>`;
  }
  $('balances').innerHTML = bh;

  // 古い「済」キーは捨てる（出費が変われば送金も変わる）
  const keys = new Set(transfers.map(tkey));
  state.settled = state.settled.filter(k => keys.has(k));

  if (!transfers.length) { $('transfers').innerHTML = '<div class="done">貸し借りはありません 🎉</div>'; return; }
  const remaining = transfers.filter(t => !state.settled.includes(tkey(t))).length;
  let th = `<div class="tcap">送金 ${transfers.length} 回　·　残り ${remaining} 件</div>`;
  for (const t of transfers) {
    const done = state.settled.includes(tkey(t));
    th += `<label class="tr ${done ? 'paid' : ''}">
      <input type="checkbox" class="tck" data-k="${tkey(t)}" ${done ? 'checked' : ''}>
      <span class="from">${escapeHtml(nameOf(t.from))}</span><span class="arrow">→</span>
      <span class="to">${escapeHtml(nameOf(t.to))}</span>
      <span class="tamt">${yen(t.amount)}</span></label>`;
  }
  $('transfers').innerHTML = th;
  for (const ck of $('transfers').querySelectorAll('.tck'))
    ck.addEventListener('change', () => { toggleSettled(ck.dataset.k); });
}
function toggleSettled(k) {
  const i = state.settled.indexOf(k);
  if (i >= 0) state.settled.splice(i, 1); else state.settled.push(k);
  renderResult(); persist();
}

function renderAll() { renderMembers(); renderExpenseForm(); renderExpenses(); renderResult(); $('cur').value = state.cur; }

/* ===== ライトボックス ===== */
function openLight(src) { $('lightimg').src = src; $('lightbox').hidden = false; }
$('lightbox').addEventListener('click', () => { $('lightbox').hidden = true; $('lightimg').src = ''; });

/* ===== 細々 ===== */
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
let toastTimer = null;
function toast(msg, ms = 2600) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms); }

/* ===== 入力 ===== */
$('addMember').addEventListener('submit', e => { e.preventDefault(); addMembers($('memberName').value); $('memberName').value = ''; $('memberName').focus(); });
$('addCount').addEventListener('click', () => { addCount(Number($('memberCount').value)); $('memberCount').value = ''; });
$('addExpense').addEventListener('submit', addExpenseFromForm);
$('exWeighted').addEventListener('change', renderExpenseForm);
$('exReceipt').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try { toast('領収書を取り込み中…', 1500); pendingReceipt = await compressImage(file); renderReceiptPrev(); }
  catch { toast('画像を読めませんでした'); }
});
$('cur').addEventListener('change', () => { state.cur = $('cur').value; renderAll(); persist(); });
$('share').addEventListener('click', async () => {
  persist();
  const url = location.href;
  if (navigator.share) { try { await navigator.share({ title: '割', text: 'この精算を見て', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('リンクを写しました（領収書は手元に残ります）'); }
  catch { prompt('この精算のリンク', url); }
});
$('clear').addEventListener('click', () => {
  if (!confirm('参加者も出費も領収書も、すべて消します。よろしいですか？')) return;
  Object.assign(state, { cur: '¥', members: [], expenses: [], settled: [], mseq: 1, eseq: 1 });
  pendingReceipt = null; localStorage.removeItem(KEY);
  history.replaceState(null, '', location.pathname);
  renderReceiptPrev(); renderAll();
});

/* ===== 起動：リンク → 保存 → 例 ===== */
function start() {
  const m = String(location.hash || '').match(/[#&]d=([^&]+)/);
  if (m) { try { decode(m[1]); renderAll(); persist(); return; } catch { /* 壊れたリンクは無視 */ } }
  if (loadLocal()) { renderAll(); return; }
  state.members = [{ id: 1, name: 'あなた', weight: 1 }, { id: 2, name: 'ともだち', weight: 1 }];
  state.mseq = 3;
  renderAll();
}
start();
