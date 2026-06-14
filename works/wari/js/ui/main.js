/* 割のへそ — みんなと出費を集め、最小の送金へまとめる。 */

import { settle } from '../core/split.js';

const $ = id => document.getElementById(id);

const state = {
  cur: '¥',
  members: [],          // {id, name}
  expenses: [],         // {id, title, payer, amount, participants:[id], weights:{id:w}}
  mseq: 1, eseq: 1,
};

/* ----- 保存と共有（端末の中・リンクの中だけ） ----- */
const KEY = 'wari.v1';
function encode() {
  const idx = new Map(state.members.map((m, i) => [m.id, i]));
  const data = {
    c: state.cur,
    m: state.members.map(m => m.name),
    e: state.expenses.map(e => ({
      t: e.title, p: idx.get(e.payer), a: e.amount,
      q: e.participants.map(id => idx.get(id)).filter(i => i != null),
      w: e.participants.map(id => e.weights[id] ?? 1),
    })),
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(s) {
  try {
    const json = decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
    const d = JSON.parse(json);
    state.cur = d.c ?? '¥';
    state.members = (d.m || []).map((name, i) => ({ id: i + 1, name }));
    state.mseq = state.members.length + 1;
    state.eseq = 1;
    state.expenses = (d.e || []).map(e => {
      const participants = (e.q || []).map(i => i + 1);
      const weights = {};
      participants.forEach((id, k) => { weights[id] = (e.w && e.w[k] != null) ? e.w[k] : 1; });
      return { id: state.eseq++, title: e.t || '', payer: (e.p ?? 0) + 1, amount: e.a || 0, participants, weights };
    });
    return true;
  } catch { return false; }
}
function persist() {
  const code = encode();
  localStorage.setItem(KEY, code);
  history.replaceState(null, '', `${location.pathname}#d=${code}`);
}

/* ----- お金の表記 ----- */
const yen = n => `${state.cur}${Math.round(n).toLocaleString('ja-JP')}`;

/* ----- メンバー ----- */
function addMember(name) {
  name = name.trim();
  if (!name) return;
  state.members.push({ id: state.mseq++, name });
  renderAll(); persist();
}
function removeMember(id) {
  if (state.expenses.some(e => e.payer === id))
    return toast('この人が払った出費があるので消せません');
  state.members = state.members.filter(m => m.id !== id);
  for (const e of state.expenses) {
    e.participants = e.participants.filter(p => p !== id);
    delete e.weights[id];
  }
  renderAll(); persist();
}

function renderMembers() {
  const box = $('members'); box.innerHTML = '';
  if (!state.members.length) { box.innerHTML = '<span class="empty">まず参加者を足してください</span>'; return; }
  for (const m of state.members) {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.innerHTML = `${escapeHtml(m.name)}<button class="x" title="消す">×</button>`;
    chip.querySelector('.x').addEventListener('click', () => removeMember(m.id));
    box.appendChild(chip);
  }
}

/* ----- 出費フォーム ----- */
function renderExpenseForm() {
  const payer = $('exPayer');
  payer.innerHTML = state.members.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  const weighted = $('exWeighted').checked;
  const parts = $('exParts'); parts.innerHTML = '';
  for (const m of state.members) {
    const row = document.createElement('label');
    row.className = 'part';
    row.innerHTML = `<input type="checkbox" class="pck" value="${m.id}" checked>
      <span>${escapeHtml(m.name)}</span>
      <input type="number" class="pw" value="1" min="0" step="0.5" ${weighted ? '' : 'hidden'}>`;
    parts.appendChild(row);
  }
}

function addExpenseFromForm(ev) {
  ev.preventDefault();
  const title = $('exTitle').value.trim() || '出費';
  const payer = Number($('exPayer').value);
  const amount = Math.max(0, Math.round(Number($('exAmount').value) || 0));
  if (!state.members.length) return toast('先に参加者を足してください');
  if (!payer) return toast('払った人を選んでください');
  if (amount <= 0) return toast('金額を入れてください');
  const weighted = $('exWeighted').checked;
  const participants = [], weights = {};
  for (const row of $('exParts').querySelectorAll('.part')) {
    const ck = row.querySelector('.pck');
    if (!ck.checked) continue;
    const id = Number(ck.value);
    participants.push(id);
    weights[id] = weighted ? Math.max(0, Number(row.querySelector('.pw').value) || 0) : 1;
  }
  if (!participants.length) return toast('割る人を選んでください');
  state.expenses.push({ id: state.eseq++, title, payer, amount, participants, weights });
  $('exTitle').value = ''; $('exAmount').value = ''; $('exWeighted').checked = false;
  renderAll(); persist();
  $('exTitle').focus();
}

function removeExpense(id) {
  state.expenses = state.expenses.filter(e => e.id !== id);
  renderAll(); persist();
}

function nameOf(id) { const m = state.members.find(x => x.id === id); return m ? m.name : '？'; }

function renderExpenses() {
  const box = $('expenses'); box.innerHTML = '';
  if (!state.expenses.length) { box.innerHTML = '<span class="empty">出費はまだありません</span>'; return; }
  for (const e of state.expenses) {
    const div = document.createElement('div');
    div.className = 'ex';
    const who = e.participants.length === state.members.length ? '全員' : e.participants.map(nameOf).join('・');
    div.innerHTML = `<div class="exmain"><span class="extitle">${escapeHtml(e.title)}</span>
      <span class="exmeta">${escapeHtml(nameOf(e.payer))} が立て替え　·　${who}で割る</span></div>
      <span class="examt">${yen(e.amount)}</span><button class="x" title="消す">×</button>`;
    div.querySelector('.x').addEventListener('click', () => removeExpense(e.id));
    box.appendChild(div);
  }
}

/* ----- 精算結果 ----- */
function renderResult() {
  const total = state.expenses.reduce((s, e) => s + e.amount, 0);
  $('total').textContent = total ? `合計 ${yen(total)}` : '';

  if (state.members.length < 2 || !state.expenses.length) {
    $('balances').innerHTML = '<span class="empty">参加者と出費を入れると、ここに精算が出ます</span>';
    $('transfers').innerHTML = '';
    return;
  }
  const { balances, transfers } = settle(state.members.map(m => m.id), state.expenses);

  // 一人ずつの差引
  let bh = '';
  for (const m of state.members) {
    const v = balances.get(m.id) || 0;
    const cls = v > 0 ? 'plus' : v < 0 ? 'minus' : 'zero';
    const label = v > 0 ? `受け取る ${yen(v)}` : v < 0 ? `払う ${yen(-v)}` : '精算ずみ';
    bh += `<div class="bal ${cls}"><span class="bn">${escapeHtml(m.name)}</span><span class="bv">${label}</span></div>`;
  }
  $('balances').innerHTML = bh;

  // 送金（これが答え）
  if (!transfers.length) {
    $('transfers').innerHTML = '<div class="done">貸し借りはありません 🎉</div>';
    return;
  }
  let th = `<div class="tcap">送金は ${transfers.length} 回でおしまい</div>`;
  for (const t of transfers) {
    th += `<div class="tr"><span class="from">${escapeHtml(nameOf(t.from))}</span>
      <span class="arrow">→</span><span class="to">${escapeHtml(nameOf(t.to))}</span>
      <span class="tamt">${yen(t.amount)}</span></div>`;
  }
  $('transfers').innerHTML = th;
}

function renderAll() {
  renderMembers();
  renderExpenseForm();
  renderExpenses();
  renderResult();
  $('cur').value = state.cur;
}

/* ----- 細々 ----- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
let toastTimer = null;
function toast(msg, ms = 2600) {
  const el = $('toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

/* ----- 入力 ----- */
$('addMember').addEventListener('submit', e => { e.preventDefault(); addMember($('memberName').value); $('memberName').value = ''; $('memberName').focus(); });
$('addExpense').addEventListener('submit', addExpenseFromForm);
$('exWeighted').addEventListener('change', renderExpenseForm);
$('cur').addEventListener('change', () => { state.cur = $('cur').value; renderAll(); persist(); });
$('share').addEventListener('click', async () => {
  persist();
  const url = location.href;
  if (navigator.share) { try { await navigator.share({ title: '割', text: 'この精算を見て', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('リンクを写しました'); }
  catch { prompt('この精算のリンク', url); }
});
$('clear').addEventListener('click', () => {
  if (!confirm('参加者も出費も、すべて消します。よろしいですか？')) return;
  state.cur = '¥'; state.members = []; state.expenses = []; state.mseq = 1; state.eseq = 1;
  localStorage.removeItem(KEY);
  history.replaceState(null, '', location.pathname);
  renderAll();
});

/* ----- 起動：リンク → 保存 → 例 ----- */
function start() {
  const m = String(location.hash || '').match(/[#&]d=([^&]+)/);
  if (m && decode(m[1])) { renderAll(); return; }
  const saved = localStorage.getItem(KEY);
  if (saved && decode(saved)) { renderAll(); persist(); return; }
  // はじめての人へ、軽い例
  state.members = [{ id: 1, name: 'あなた' }, { id: 2, name: 'ともだち' }];
  state.mseq = 3;
  renderAll();
}
start();
