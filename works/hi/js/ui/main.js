/* 碑 — 操作。台帳(names.jsonl)を読み、石に名を浮かべる。
   名に触れると、その人の手紙（季節・一言・会える種）が静かにひらく。
   コアと同じ台帳を読むだけ。名は永遠にオープンな issue #120 に積もる。 */
import { parseLedger } from '../core/hi.js';

const stone = document.getElementById('stone');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function load() {
  let text;
  try { const r = await fetch('names.jsonl', { cache: 'no-store' }); if (!r.ok) throw 0; text = await r.text(); }
  catch {
    stone.innerHTML = '<p class="err">台帳をここで読めませんでした（file:// では塞がれます）。<br><a href="stele.svg">石碑（SVG）を見る</a> か、サーバー越しに開いてください。</p>';
    return;
  }
  const entries = parseLedger(text);
  let html = '<div class="crest">碑</div>';
  entries.forEach((e, i) => {
    const label = (e.glyph ? e.glyph + ' ' : '') + esc(e.name);
    html += `<div class="name" style="animation-delay:${0.15 + i * 0.22}s" data-i="${i}">`;
    html += `<span class="n">${label}</span>`;
    if (e.tended) html += `<span class="t">${esc(e.tended)}</span>`;
    html += '<div class="more">';
    if (e.era) html += `<p class="era">${esc(e.era)}</p>`;
    if (e.word) html += `<p class="word">「${esc(e.word)}」</p>`;
    if (e.seed) html += `<p class="seed">会える種：\n${esc(e.seed)}</p>`;
    if (e.via) html += `<p class="via">${esc(e.via)}</p>`;
    html += '</div></div>';
  });
  html += '<div class="foot-crest">無一物中無尽蔵</div>';
  stone.innerHTML = html;
  stone.querySelectorAll('.name').forEach(el => el.addEventListener('click', () => el.classList.toggle('open')));
}
load();
