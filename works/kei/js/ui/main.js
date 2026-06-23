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
  旅費: `# 京都ひとり旅 ― ふたり分の予算（単価×数で、数え単位は約分される）
新幹線 = 13320 円 * 2
宿     = 8500 円/泊 * 2 泊 * 2
拝観料 = 600 円/か所 * 5 か所 * 2
食事   = 2500 円/食 * 3 食 * 2
小計   = sum
予備   = 小計 + 15%
ひとり = 予備 / 2`,
  単位: `# 単位は、混ぜても割っても、ひとりでに正しくなる
5 km in mi
2 TB / 50 MB/s in min
100 km / 2 h in km/h
3 m * 4 m

# 知らない語（区間・個…）は、そのまま「数え単位」になって運ばれる
シフト数 = 24 時間/日 / (8 時間/区間)
12 個 / 4 人
500 円/個 * 12 個

# 為替は持たない。だから正直に断る:
100 USD + 3000 円
100 USD in JPY`,
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
  理科: `# 組み立て単位（力・エネルギー・仕事率）も、変換はおのずと合う
体重     = 70 kg
重力     = 9.8 m/s^2
力       = 体重 * 重力 in N
位置エネルギー = 力 * 3 m in J

# 電気代（消費電力 × 時間 → kWh → 円）
消費電力 = 1200 W
一時間分 = 消費電力 * 1 h in kWh
電気代   = 一時間分 * 31 円/kWh

100 km/h in m/s
2000 kcal in kJ

# 温度・定数・SI接頭辞
180 °C in °F
2 GHz in MHz
円の面積 = pi * (3 cm)^2 in cm^2`,
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
