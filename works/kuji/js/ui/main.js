/* 籤のへそ — 封を先に立て、くじを引き、証拠を渡し、たしかめる。 */

import { draw, commitment, verifyCommitment, verify, encodeEvidence, decodeEvidence } from '../core/draw.js';

const $ = id => document.getElementById(id);
const KEY = 'kuji.v1';

/* ----- 塩（種）をふる：端末の暗号乱数から。core はこれを受け取るだけ ----- */
function freshSalt() {
  const a = new Uint8Array(9);
  (crypto && crypto.getRandomValues) ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = (Math.random() * 256) | 0);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

let salt = freshSalt();
let lastInputs = null;

/* ----- 入力をまとめる ----- */
function readInputs() {
  const mode = document.querySelector('input[name=mode]:checked').value;
  return {
    entrants: $('entrants').value.split('\n'),
    mode,
    count: Math.max(1, parseInt($('count').value, 10) || 1),
    salt,
    words: $('words').value.split('\n'),
  };
}

function refreshSeal() {
  $('salt').textContent = salt;
  $('commit').textContent = commitment(salt);
}

function entrantCount() {
  const n = $('entrants').value.split('\n').map(s => s.trim()).filter(Boolean).length;
  $('nCount').textContent = n ? `${n} 人` : '';
}

/* ----- モードに合わせて人数欄を出し分け ----- */
function syncMode() {
  const mode = document.querySelector('input[name=mode]:checked').value;
  document.querySelectorAll('.mode').forEach(m => m.classList.toggle('on', m.querySelector('input').checked));
  $('countWrap').hidden = (mode === 'order');
  if (mode === 'pick') { $('countLabel').textContent = '当選'; $('countUnit').textContent = '人'; }
  if (mode === 'groups') { $('countLabel').textContent = '班の数'; $('countUnit').textContent = '班'; }
}

/* ----- 結果を描く ----- */
function renderResult(into, r) {
  if (r.mode === 'groups') {
    const wrap = document.createElement('div'); wrap.className = 'groups';
    r.groups.forEach((g, i) => {
      const box = document.createElement('div'); box.className = 'group';
      const h = document.createElement('h3'); h.textContent = `${i + 1} 班（${g.length}人）`;
      const mem = document.createElement('div'); mem.className = 'members';
      g.forEach(n => { const s = document.createElement('span'); s.textContent = n; mem.appendChild(s); });
      box.append(h, mem); wrap.appendChild(box);
    });
    into.replaceChildren(wrap);
    return;
  }
  const ul = document.createElement('ul'); ul.className = 'orderlist';
  const winners = new Set(r.winners || []);
  r.order.forEach(name => {
    const li = document.createElement('li');
    if (r.mode === 'pick' && winners.has(name)) li.className = 'win';
    const s = document.createElement('span'); s.className = 'name'; s.textContent = name;
    li.appendChild(s); ul.appendChild(li);
  });
  into.replaceChildren(ul);
}

const TITLES = { order: '順番', pick: '抽選の結果', groups: '組分け' };

/* ----- くじを引く ----- */
function doDraw() {
  const inputs = readInputs();
  let r;
  try { r = draw(inputs); }
  catch { return toast('先に参加者を入れてください'); }
  if (r.order.length < 2) return toast('参加者は 2 人以上で');
  lastInputs = inputs;
  $('resultTitle').textContent = TITLES[r.mode] || '結果';
  $('drawId').textContent = '銘 ' + r.id;
  renderResult($('resultBody'), r);
  $('result').hidden = false;
  $('result').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  save();
}

/* ----- たしかめる ----- */
function doVerify() {
  let inputs;
  try { inputs = decodeEvidence($('evIn').value.trim()); }
  catch { return toast('証拠を読めませんでした'); }
  let res;
  try { res = verify(inputs); }
  catch { return toast('この証拠では引けません'); }
  const r = res.fresh;
  const v = $('vVerdict');
  const commitGiven = $('commitIn').value.trim();
  let verdictOk = true, lines = [];
  lines.push('この証拠からは、いつ・誰が計算しても下の結果になります。');
  if (commitGiven) {
    const sealOk = verifyCommitment(commitGiven, inputs.salt);
    verdictOk = sealOk;
    lines.push(sealOk
      ? '封とも一致しました——結果は前もって封じられたとおり、あとから書き換えられていません。'
      : '⚠ 封と合いません。先に配られた封と、この証拠の塩が食いちがっています。');
  } else {
    lines.push('封（先に配られたハッシュ）も貼れば、結果が事前に封じられていたかまで確かめられます。');
  }
  v.className = 'verdict ' + (verdictOk ? 'ok' : 'ng');
  v.innerHTML = (verdictOk ? '✓ 確かに、この通り' : '✗ 食いちがいあり')
    + `<span class="sub">${lines.join('<br>')}</span>`;
  $('vTitle').textContent = '再現された' + (TITLES[r.mode] || '結果');
  $('vId').textContent = '銘 ' + r.id;
  renderResult($('vBody'), r);
  $('vResult').hidden = false;
}

/* ----- タブ ----- */
function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === name));
  $('drawpane').hidden = name !== 'draw';
  $('verifypane').hidden = name !== 'verify';
}

/* ----- 送る・写す ----- */
async function shareText(title, text, url) {
  if (url && navigator.share) { try { await navigator.share({ title, text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url || text); toast('写しました'); }
  catch { prompt(title, url || text); }
}

/* ----- 保存（手元だけ） ----- */
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      entrants: $('entrants').value, words: $('words').value,
      mode: document.querySelector('input[name=mode]:checked').value,
      count: $('count').value, salt,
    }));
  } catch { /* あふれても気にしない */ }
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!s) return;
    $('entrants').value = s.entrants || '';
    $('words').value = s.words || '';
    $('count').value = s.count || 1;
    if (s.salt) salt = s.salt;
    const radio = document.querySelector(`input[name=mode][value="${s.mode}"]`);
    if (radio) radio.checked = true;
  } catch { /* こわれていたら初期値 */ }
}

let toastTimer = null;
function toast(msg, ms = 2400) {
  const el = $('toast'); el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

/* ----- 配線 ----- */
$('entrants').addEventListener('input', () => { entrantCount(); save(); });
$('words').addEventListener('input', save);
$('count').addEventListener('input', save);
document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener('change', () => { syncMode(); save(); }));
$('reseed').addEventListener('click', () => { salt = freshSalt(); refreshSeal(); save(); toast('塩をふり直しました'); });
$('copyCommit').addEventListener('click', () => shareText('封', commitment(salt)));
$('go').addEventListener('click', doDraw);
$('shareResult').addEventListener('click', () => {
  if (!lastInputs) return;
  const url = location.href.split('#')[0] + '#k=' + encodeEvidence(lastInputs);
  shareText('籤', 'このくじ、確かめて', url);
});
$('copyEv').addEventListener('click', () => { if (lastInputs) shareText('証拠', encodeEvidence(lastInputs)); });
$('verifyGo').addEventListener('click', doVerify);
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));

/* ----- ひらく ----- */
function boot() {
  load();
  refreshSeal();
  entrantCount();
  syncMode();
  const m = String(location.hash || '').match(/[#&]k=([^&]+)/);
  if (m) {
    showTab('verify');
    $('evIn').value = m[1];
    doVerify();
  }
}
boot();
