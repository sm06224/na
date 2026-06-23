/* ============================================================
   計 — ノートの上演。左の textarea に書くたび、右に答えを並べる。
   行は一対一でそろえる（同じ行送り）。データは端末から出ない。
   ============================================================ */
import { run } from '../core/kei.js';

const src = document.getElementById('src');
const out = document.getElementById('out');
const toast = document.getElementById('toast');
const KEY = 'kei.note';

const EXAMPLES = {
  旅費: `# 京都ひとり旅 ― ふたり分の予算
新幹線   = 13320 円 * 2
宿       = 2 泊 * 8500 円 * 2
拝観料   = 5 か所 * 600 円 * 2
食事     = 3 食 * 2500 円 * 2
小計     = sum
予備     = 小計 + 15%
ひとり   = 予備 / 2`,
  単位: `# 単位は、混ぜても割っても、ひとりでに正しくなる
5 km in mi
180 cm in ft
2 TB / 50 MB/s in min
100 km / 2 h in km/h
60 mi/h in m/s
3 m * 4 m
8 GB / 4
# 為替は持たない。だから正直に断る:
100 USD + 3000 円`,
  暮らし: `# 毎日の暗算を、消えないノートに
時給     = 1200 円/h
今日     = 7.5 h
日給     = 時給 * 今日
週       = 日給 * 5 日

買い物
牛乳 = 218 円
卵   = 258 円
パン = 158 円
合計 = sum
税込 = 合計 + 8%`,
};

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function render() {
  const res = run(src.value);
  out.innerHTML = res.map((r) => {
    if (r.kind === 'blank') return '<div class="ln blank">&nbsp;</div>';
    if (r.error) return `<div class="ln err" title="${esc(r.error)}">⟨!⟩ ${esc(r.error)}</div>`;
    if (r.result === null) return '<div class="ln note">&nbsp;</div>';
    return `<div class="ln val">${esc(r.result)}</div>`;
  }).join('');
  out.scrollTop = src.scrollTop;
  try { localStorage.setItem(KEY, src.value); } catch {}
}

function load() {
  const h = location.hash;
  if (h.startsWith('#n=')) {
    try { return decodeURIComponent(escape(atob(decodeURIComponent(h.slice(3))))); } catch {}
  }
  try { const s = localStorage.getItem(KEY); if (s != null) return s; } catch {}
  return EXAMPLES.暮らし;
}

function setNote(text) { src.value = text; render(); src.focus(); }
function flash(msg) { toast.textContent = msg; toast.classList.add('on'); clearTimeout(flash.t); flash.t = setTimeout(() => toast.classList.remove('on'), 1900); }

src.addEventListener('input', render);
src.addEventListener('scroll', () => { out.scrollTop = src.scrollTop; });

document.getElementById('examples').addEventListener('click', (e) => {
  const ex = e.target.dataset && e.target.dataset.ex;
  if (ex && EXAMPLES[ex]) setNote(EXAMPLES[ex]);
});
document.getElementById('clear').addEventListener('click', () => setNote(''));
document.getElementById('share').addEventListener('click', async () => {
  const url = location.origin + location.pathname + '#n=' + encodeURIComponent(btoa(unescape(encodeURIComponent(src.value))));
  try { await navigator.clipboard.writeText(url); flash('このノートへのリンクを写しました'); }
  catch { location.hash = 'n=' + encodeURIComponent(btoa(unescape(encodeURIComponent(src.value)))); flash('上のリンクが、このノートです'); }
});

// タブで字下げ（フォーカスを逃がさない）
src.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const s = src.selectionStart, en = src.selectionEnd;
    src.value = src.value.slice(0, s) + '  ' + src.value.slice(en);
    src.selectionStart = src.selectionEnd = s + 2;
    render();
  }
});

setNote(load());
