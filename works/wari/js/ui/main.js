/* 割のへそ — お金を「計画（予算）」と「実績」に分けて扱う。
   計画：人数割と一式の費用＋主賓の肩代わりから、一人あたりの会費を出す。
   実績：事前/当日/当日に払ったものを表に積み、精算で最小の送金に再分配する。 */

import { settle, mergeWeights } from '../core/split.js';
import { planBudget } from '../core/budget.js';

const $ = id => document.getElementById(id);

const LEDGER = [
  ['pre', '事前', '予約・前売り・買い出しなど、当日より前に払ったもの。'],
  ['day', '当日', 'その日に払ったもの。'],
  ['post', '事後', '打ち上げ・後日の支払いなど、終わってからのもの。'],
];
const TABS = [['plan', '計画'], ...LEDGER.map(([id, l]) => [id, l]), ['settle', '精算']];
const ledgerIndex = id => LEDGER.findIndex(p => p[0] === id);
const isLedger = id => LEDGER.some(p => p[0] === id);

const state = {
  cur: '¥',
  members: [],     // {id, name, weight}
  rows: [],        // 実績 {id, phase, item, amount, payer(id|null), participants, weighted, weights, memo, receipt}
  plan: { headcount: 0, freeGuests: 0, roundTo: 0, items: [], pseq: 1 },  // 計画
  settled: [],
  mseq: 1, rseq: 1,
  tab: 'plan',
};
let editing = null;
let pendingReceipt = null;

/* ===== 保存と共有 ===== */
const KEY = 'wari.v3', OLDKEY = 'wari.v2';
function encode() {
  const idx = new Map(state.members.map((m, i) => [m.id, i]));
  const data = {
    c: state.cur,
    m: state.members.map(m => m.name),
    mw: state.members.map(m => m.weight),
    pl: { h: state.plan.headcount, g: state.plan.freeGuests, r: state.plan.roundTo, i: state.plan.items.map(it => [it.name, it.kind === 'per' ? 1 : 0, it.amount]) },
    r: state.rows.map(r => {
      const o = { f: ledgerIndex(r.phase), t: r.item, a: r.amount, p: r.payer == null ? -1 : idx.get(r.payer), q: r.participants.map(id => idx.get(id)).filter(i => i != null) };
      if (r.memo) o.n = r.memo;
      if (r.weighted) { o.wt = 1; o.w = r.participants.map(id => r.weights[id] ?? 1); }
      return o;
    }),
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(s) {
  const d = JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))));
  state.cur = d.c ?? '¥';
  state.members = (d.m || []).map((name, i) => ({ id: i + 1, name, weight: (d.mw && d.mw[i] != null) ? d.mw[i] : 1 }));
  state.mseq = state.members.length + 1;
  state.settled = [];
  state.rseq = 1;
  const pl = d.pl || {};
  state.plan = {
    headcount: pl.h ?? state.members.length, freeGuests: pl.g ?? 0, roundTo: pl.r ?? 0,
    items: (pl.i || []).map(([name, k, amount]) => ({ id: 0, name, kind: k ? 'per' : 'fixed', amount })), pseq: 1,
  };
  state.plan.items.forEach(it => { it.id = state.plan.pseq++; });
  state.rows = (d.r || []).map(r => {
    const participants = (r.q || []).map(i => i + 1);
    const weights = {};
    if (r.wt) participants.forEach((id, k) => { weights[id] = (r.w && r.w[k] != null) ? r.w[k] : 1; });
    return {
      id: state.rseq++, phase: (LEDGER[r.f] || LEDGER[0])[0], item: r.t || '', amount: r.a || 0,
      payer: (r.p == null || r.p < 0) ? null : r.p + 1, participants, weighted: !!r.wt, weights, memo: r.n || '', receipt: null,
    };
  });
}
function saveLocal() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { toast('保存しきれませんでした（領収書が大きすぎるかも）'); }
}
function loadLocal() {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      const s = JSON.parse(raw);
      Object.assign(state, {
        cur: s.cur ?? '¥', members: s.members || [], rows: s.rows || [], settled: s.settled || [],
        mseq: s.mseq || (s.members?.length || 0) + 1, rseq: s.rseq || 1, tab: s.tab || 'plan',
        plan: s.plan || { headcount: (s.members?.length || 0), freeGuests: 0, roundTo: 0, items: [], pseq: 1 },
      });
      for (const m of state.members) if (m.weight == null) m.weight = 1;
      for (const r of state.rows) { if (!isLedger(r.phase)) r.phase = 'pre'; r.weighted = !!r.weighted; r.weights = r.weights || {}; if (!('receipt' in r)) r.receipt = null; if (!('memo' in r)) r.memo = ''; }
      if (!state.plan.items) state.plan.items = [];
      if (!state.plan.pseq) state.plan.pseq = state.plan.items.length + 1;
      if (!isLedger(state.tab) && state.tab !== 'plan' && state.tab !== 'settle') state.tab = 'plan';
      return true;
    } catch { /* fall through */ }
  }
  const old = localStorage.getItem(OLDKEY);
  if (old) {
    try {
      const s = JSON.parse(old);
      state.cur = s.cur ?? '¥';
      state.members = (s.members || []).map(m => ({ ...m, weight: m.weight ?? 1 }));
      state.mseq = s.mseq || state.members.length + 1;
      state.rseq = 1;
      state.rows = (s.expenses || []).map(e => ({
        id: state.rseq++, phase: 'day', item: e.title || '', amount: e.amount || 0, payer: e.payer ?? null,
        participants: e.participants || [], weighted: !!e.weighted, weights: e.weights || {}, memo: '', receipt: e.receipt ?? null,
      }));
      state.settled = s.settled || [];
      state.plan = { headcount: state.members.length, freeGuests: 0, roundTo: 0, items: [], pseq: 1 };
      return true;
    } catch { return false; }
  }
  return false;
}
function persist() { saveLocal(); history.replaceState(null, '', `${location.pathname}#d=${encode()}`); }

/* ===== お金 ===== */
const yen = n => `${state.cur}${Math.round(n).toLocaleString('ja-JP')}`;
const nameOf = id => { const m = state.members.find(x => x.id === id); return m ? m.name : '？'; };

/* ===== メンバー ===== */
function addMembers(text) {
  const names = String(text).split(/[,、\s]+/).map(s => s.trim()).filter(Boolean);
  for (const name of names) state.members.push({ id: state.mseq++, name: name.slice(0, 16), weight: 1 });
  if (names.length) { if (state.plan.headcount < state.members.length) state.plan.headcount = state.members.length; renderAll(); persist(); }
}
function addCount(n) {
  n = Math.max(0, Math.min(50, Math.floor(n) || 0));
  for (let k = 0; k < n; k++) {
    const i = state.members.length;
    state.members.push({ id: state.mseq++, name: i < 26 ? String.fromCharCode(65 + i) : `${i + 1}`, weight: 1 });
  }
  if (n) { if (state.plan.headcount < state.members.length) state.plan.headcount = state.members.length; renderAll(); persist(); }
}
function renameMember(id) {
  const m = state.members.find(x => x.id === id); if (!m) return;
  const v = prompt('名前', m.name);
  if (v != null && v.trim()) { m.name = v.trim().slice(0, 16); renderAll(); persist(); }
}
function setWeight(id, w) {
  const m = state.members.find(x => x.id === id); if (!m) return;
  m.weight = Math.max(0, Number(w) || 0); renderAll(); persist();
}
function removeMember(id) {
  if (state.rows.some(r => r.payer === id)) return toast('この人が払った行があるので消せません');
  state.members = state.members.filter(m => m.id !== id);
  for (const r of state.rows) { r.participants = r.participants.filter(p => p !== id); delete r.weights[id]; }
  renderAll(); persist();
}
function renderMembers() {
  const box = $('members'); box.innerHTML = '';
  if (!state.members.length) { box.innerHTML = '<span class="empty">参加者を足してください（計画は人数だけでも使えます）</span>'; return; }
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

/* ===== タブ ===== */
function renderTabs() {
  const nav = $('tabs'); nav.innerHTML = '';
  for (const [id, label] of TABS) {
    const b = document.createElement('button');
    b.className = 'tab' + (state.tab === id ? ' on' : '');
    const sum = id === 'plan' ? planBudget(planArgs()).total : id === 'settle' ? actualTotal() : phaseTotal(id);
    b.innerHTML = `<span class="tlabel">${label}</span>${sum ? `<span class="tsum">${yen(sum)}</span>` : ''}`;
    b.addEventListener('click', () => { state.tab = id; persist(); renderView(); renderTabs(); });
    nav.appendChild(b);
  }
}
const phaseTotal = ph => state.rows.filter(r => r.phase === ph).reduce((s, r) => s + r.amount, 0);
const actualTotal = () => state.rows.filter(r => r.payer != null).reduce((s, r) => s + r.amount, 0);

/* ===== 表示の切替 ===== */
function renderView() {
  $('planview').hidden = state.tab !== 'plan';
  $('phaseview').hidden = !isLedger(state.tab);
  $('settleview').hidden = state.tab !== 'settle';
  if (state.tab === 'plan') renderPlan();
  else if (state.tab === 'settle') renderSettle();
  else renderPhase();
}

/* ===== 計画（予算） ===== */
function planArgs() {
  return { headcount: state.plan.headcount, freeGuests: state.plan.freeGuests, roundTo: state.plan.roundTo, items: state.plan.items };
}
function renderPlan() {
  $('plN').value = state.plan.headcount || 0;
  $('plFree').value = state.plan.freeGuests || 0;
  $('plRound').value = String(state.plan.roundTo || 0);
  const body = $('plItems'); body.innerHTML = '';
  if (!state.plan.items.length) {
    body.innerHTML = `<tr class="emptyrow"><td colspan="3">費用を足してください（例：料理 5000円/人、会場代 30000円 一式）</td></tr>`;
  } else {
    for (const it of state.plan.items) {
      const tr = document.createElement('tr');
      const kindLabel = it.kind === 'per' ? `人数割 ×${state.plan.headcount || 0}` : '一式';
      tr.innerHTML = `<td>${escapeHtml(it.name || '（無題）')}</td>
        <td class="kindcell">${kindLabel}</td>
        <td class="num"><input class="amt" type="number" min="0" step="1" value="${it.amount}"><button class="x" title="消す">×</button></td>`;
      tr.querySelector('.amt').addEventListener('change', e => { it.amount = Math.max(0, Math.round(Number(e.target.value) || 0)); renderPlan(); renderTabs(); persist(); });
      tr.querySelector('.x').addEventListener('click', () => { state.plan.items = state.plan.items.filter(x => x.id !== it.id); renderPlan(); renderTabs(); persist(); });
      body.appendChild(tr);
    }
  }
  const b = planBudget(planArgs());
  const free = b.freeGuests ? `主賓 ${b.freeGuests}人：無料　·　` : '';
  let html = `<div class="planbig">会費 <b>${yen(b.fee)}</b> <span class="per">/ 人</span></div>
    <div class="plansub">${free}払う ${b.payers}人</div>`;
  if (b.total > 0) {
    html += `<div class="planbreak">
      総額 ${yen(b.total)}（人数割 ${yen(b.perTotal)} ＋ 一式 ${yen(b.fixed)}）<br>
      一人あたり実費 ${yen(b.rawFee)}${state.plan.roundTo ? ` → ${state.plan.roundTo}円単位で ${yen(b.fee)}` : ''}<br>
      集金 ${yen(b.collected)}　·　余り ${yen(b.surplus)}</div>`;
  }
  $('plResult').innerHTML = html;
}

/* ===== 実績の表 ===== */
function renderPhase() {
  const [, label, desc] = LEDGER.find(p => p[0] === state.tab) || LEDGER[0];
  const rows = state.rows.filter(r => r.phase === state.tab);
  const planned = rows.filter(r => r.payer == null).length;
  $('phaseinfo').innerHTML = `<b>実績・${label}</b>　${desc}`;
  const body = $('ledgerBody'); body.innerHTML = '';
  if (!rows.length) {
    body.innerHTML = `<tr class="emptyrow"><td colspan="3">まだありません。下の「＋」で足してください。</td></tr>`;
  } else {
    for (const r of rows) {
      const tr = document.createElement('tr');
      const memo = r.memo ? `<span class="rmemo">${escapeHtml(r.memo)}</span>` : '';
      const rcp = r.receipt ? `<img class="rrcp" src="${r.receipt}" alt="領収書">` : '';
      const payer = r.payer == null ? '<span class="unpaid">（未）</span>' : escapeHtml(nameOf(r.payer));
      const who = r.participants.length && r.participants.length !== state.members.length ? `　<span class="rwho">${r.participants.length}人で割る</span>` : '';
      tr.innerHTML = `<td class="citem">${rcp}<span class="ritem">${escapeHtml(r.item || '（無題）')}</span>${memo}${who}</td>
        <td class="cpay">${payer}</td><td class="num">${yen(r.amount)}</td>`;
      tr.addEventListener('click', e => { if (e.target.classList.contains('rrcp')) { e.stopPropagation(); openLight(r.receipt); return; } openEditor(r); });
      body.appendChild(tr);
    }
  }
  const sum = phaseTotal(state.tab);
  $('ledgerFoot').innerHTML = rows.length
    ? `<tr><td>小計　${rows.length} 件${planned ? `（うち未払い ${planned}）` : ''}</td><td></td><td class="num">${yen(sum)}</td></tr>`
    : '';
}

/* ===== 精算 ===== */
function resolved() {
  const base = {}; for (const m of state.members) base[m.id] = m.weight;
  return state.rows
    .filter(r => r.payer != null && r.amount > 0 && r.participants.length)
    .map(r => ({ payer: r.payer, amount: r.amount, participants: r.participants, weights: mergeWeights(r.participants, base, r.weighted ? r.weights : {}) }));
}
const tkey = t => `${t.from}>${t.to}>${t.amount}`;
function renderSettle() {
  const total = actualTotal();
  $('settleinfo').innerHTML = `<b>精算</b>　実費 ${yen(total)}　·　立て替えを最小の送金で再分配します。`;
  if (state.members.length < 2 || !resolved().length) {
    $('balances').innerHTML = '<span class="empty">参加者と、払った人のある出費（実績）を入れると、ここに精算が出ます</span>';
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
  const keys = new Set(transfers.map(tkey));
  state.settled = state.settled.filter(k => keys.has(k));
  if (!transfers.length) { $('transfers').innerHTML = '<div class="done">貸し借りはありません 🎉</div>'; return; }
  const remaining = transfers.filter(t => !state.settled.includes(tkey(t))).length;
  let th = `<div class="tcap">送金 ${transfers.length} 回　·　残り ${remaining} 件</div>`;
  for (const t of transfers) {
    const done = state.settled.includes(tkey(t));
    th += `<label class="tr ${done ? 'paid' : ''}"><input type="checkbox" class="tck" data-k="${tkey(t)}" ${done ? 'checked' : ''}>
      <span class="from">${escapeHtml(nameOf(t.from))}</span><span class="arrow">→</span>
      <span class="to">${escapeHtml(nameOf(t.to))}</span><span class="tamt">${yen(t.amount)}</span></label>`;
  }
  $('transfers').innerHTML = th;
  for (const ck of $('transfers').querySelectorAll('.tck'))
    ck.addEventListener('change', () => {
      const k = ck.dataset.k, i = state.settled.indexOf(k);
      if (i >= 0) state.settled.splice(i, 1); else state.settled.push(k);
      renderSettle(); persist();
    });
}

/* ===== 行エディタ（実績） ===== */
function openEditor(row) {
  if (!state.members.length) return toast('先に参加者を足してください');
  editing = row ? row.id : null;
  pendingReceipt = row ? row.receipt : null;
  $('edTitle').textContent = row ? '出費をなおす' : '出費を足す';
  $('edPhase').innerHTML = LEDGER.map(([id, l]) => `<option value="${id}">${l}</option>`).join('');
  $('edPhase').value = row ? row.phase : (isLedger(state.tab) ? state.tab : 'day');
  $('edItem').value = row ? row.item : '';
  $('edAmount').value = row ? (row.amount || '') : '';
  $('edMemo').value = row ? row.memo : '';
  $('edPayer').innerHTML = `<option value="">（未・予定）</option>` + state.members.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('');
  $('edPayer').value = row && row.payer != null ? String(row.payer) : '';
  $('edWeighted').checked = row ? row.weighted : false;
  renderEditorParts(row);
  renderEdReceipt();
  $('edDelete').hidden = !row;
  $('editor').hidden = false;
}
function renderEditorParts(row) {
  const weighted = $('edWeighted').checked;
  const parts = $('edParts'); parts.innerHTML = '';
  for (const m of state.members) {
    const checked = row ? row.participants.includes(m.id) : true;
    const w = row && row.weights[m.id] != null ? row.weights[m.id] : m.weight;
    const lab = document.createElement('label');
    lab.className = 'part';
    lab.innerHTML = `<input type="checkbox" class="pck" value="${m.id}" ${checked ? 'checked' : ''}>
      <span>${escapeHtml(m.name)}</span>
      <input type="number" class="pw" value="${w}" min="0" step="0.5" ${weighted ? '' : 'hidden'}>`;
    parts.appendChild(lab);
  }
}
function saveEditor() {
  const phase = $('edPhase').value;
  const item = $('edItem').value.trim() || '（無題）';
  const amount = Math.max(0, Math.round(Number($('edAmount').value) || 0));
  const memo = $('edMemo').value.trim();
  const pv = $('edPayer').value;
  const payer = pv === '' ? null : Number(pv);
  const weighted = $('edWeighted').checked;
  const participants = [], weights = {};
  for (const lab of $('edParts').querySelectorAll('.part')) {
    const ck = lab.querySelector('.pck'); if (!ck.checked) continue;
    const id = Number(ck.value); participants.push(id);
    if (weighted) weights[id] = Math.max(0, Number(lab.querySelector('.pw').value) || 0);
  }
  if (payer != null && amount <= 0) return toast('金額を入れてください');
  if (payer != null && !participants.length) return toast('割る人を選んでください');
  const data = { phase, item, amount, payer, participants, weighted, weights, memo, receipt: pendingReceipt };
  if (editing != null) { const r = state.rows.find(x => x.id === editing); if (r) Object.assign(r, data); }
  else state.rows.push({ id: state.rseq++, ...data });
  state.tab = phase;
  closeEditor(); renderAll(); persist();
}
function deleteRow() {
  if (editing != null) state.rows = state.rows.filter(r => r.id !== editing);
  closeEditor(); renderAll(); persist();
}
function closeEditor() { $('editor').hidden = true; editing = null; pendingReceipt = null; }
function currentEditingRow() { return editing != null ? state.rows.find(r => r.id === editing) : null; }

/* ===== 領収書 ===== */
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
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('no')); };
    img.src = url;
  });
}
function renderEdReceipt() {
  const box = $('edReceiptPrev'); box.innerHTML = '';
  if (!pendingReceipt) return;
  box.innerHTML = `<img src="${pendingReceipt}" alt="領収書"><button type="button" class="rcpx" title="外す">×</button>`;
  box.querySelector('img').addEventListener('click', () => openLight(pendingReceipt));
  box.querySelector('.rcpx').addEventListener('click', () => { pendingReceipt = null; renderEdReceipt(); });
}

/* ===== ライトボックス・細々 ===== */
function openLight(src) { $('lightimg').src = src; $('lightbox').hidden = false; }
$('lightbox').addEventListener('click', () => { $('lightbox').hidden = true; $('lightimg').src = ''; });
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
let toastTimer = null;
function toast(msg, ms = 2600) { const el = $('toast'); el.textContent = msg; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms); }

function renderAll() { renderMembers(); renderTabs(); renderView(); $('cur').value = state.cur; }

/* ===== 入力 ===== */
$('addMember').addEventListener('submit', e => { e.preventDefault(); addMembers($('memberName').value); $('memberName').value = ''; $('memberName').focus(); });
$('addCount').addEventListener('click', () => { addCount(Number($('memberCount').value)); $('memberCount').value = ''; });
$('addRow').addEventListener('click', () => openEditor(null));
$('edClose').addEventListener('click', closeEditor);
$('edSave').addEventListener('click', saveEditor);
$('edDelete').addEventListener('click', deleteRow);
$('edWeighted').addEventListener('change', () => renderEditorParts(currentEditingRow()));
$('edReceipt').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  try { toast('領収書を取り込み中…', 1500); pendingReceipt = await compressImage(file); renderEdReceipt(); }
  catch { toast('画像を読めませんでした'); }
});
/* 計画の入力 */
$('plN').addEventListener('change', () => { state.plan.headcount = Math.max(0, Math.floor(Number($('plN').value) || 0)); renderPlan(); renderTabs(); persist(); });
$('plFree').addEventListener('change', () => { state.plan.freeGuests = Math.max(0, Math.floor(Number($('plFree').value) || 0)); renderPlan(); persist(); });
$('plRound').addEventListener('change', () => { state.plan.roundTo = Number($('plRound').value) || 0; renderPlan(); persist(); });
$('plAdd').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('plName').value.trim() || '費用';
  const kind = $('plKind').value === 'per' ? 'per' : 'fixed';
  const amount = Math.max(0, Math.round(Number($('plAmount').value) || 0));
  if (amount <= 0) return toast('金額を入れてください');
  state.plan.items.push({ id: state.plan.pseq++, name: name.slice(0, 24), kind, amount });
  $('plName').value = ''; $('plAmount').value = '';
  renderPlan(); renderTabs(); persist(); $('plName').focus();
});
$('cur').addEventListener('change', () => { state.cur = $('cur').value; renderAll(); persist(); });
$('share').addEventListener('click', async () => {
  persist();
  const url = location.href;
  if (navigator.share) { try { await navigator.share({ title: '割', text: 'この会計を見て', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('リンクを写しました（領収書は手元に残ります）'); }
  catch { prompt('この会計のリンク', url); }
});
$('clear').addEventListener('click', () => {
  if (!confirm('参加者も計画も出費も領収書も、すべて消します。よろしいですか？')) return;
  Object.assign(state, { cur: '¥', members: [], rows: [], settled: [], mseq: 1, rseq: 1, tab: 'plan', plan: { headcount: 0, freeGuests: 0, roundTo: 0, items: [], pseq: 1 } });
  pendingReceipt = null; localStorage.removeItem(KEY); localStorage.removeItem(OLDKEY);
  history.replaceState(null, '', location.pathname);
  renderAll();
});

/* ===== 起動 ===== */
function start() {
  const m = String(location.hash || '').match(/[#&]d=([^&]+)/);
  if (m) { try { decode(m[1]); renderAll(); persist(); return; } catch { /* 壊れたリンク */ } }
  if (loadLocal()) { renderAll(); return; }
  state.members = [{ id: 1, name: 'あなた', weight: 1 }, { id: 2, name: 'ともだち', weight: 1 }];
  state.mseq = 3; state.plan.headcount = 2;
  renderAll();
}
start();
