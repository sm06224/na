import { wordToKana, wordToRoma } from '../core/phonology.js';
import { CONCEPTS, conceptById } from '../core/meaning.js';
import { EV } from '../core/chronicle.js';
import { h, clear } from './dom.js';

/* ============================================================
   辞書 — 選んだ群の言語の「今」。
   概念ごとの優勢語、競合する同義語、定着度。これが言語の肖像。
   ============================================================ */
export function renderDictionary(root, world, selected) {
  clear(root);
  if (!selected || selected.diedAt !== null) {
    root.append(h('div', { class: 'dim hint' }, '地図の群をクリックすると、その言語の辞書が読めます'));
    return;
  }
  const d = selected;
  root.append(h('div', { class: 'dict-head' },
    h('span', { class: 'swatch', style: { background: `hsl(${d.hue},65%,58%)` } }),
    h('b', {}, `${d.name}語`),
    h('span', { class: 'dim small' }, ` 人口 ${Math.round(d.pop)} · ${d.lexicon.size()} 語`),
  ));

  const list = h('div', { class: 'dict-list' });
  for (const c of CONCEPTS) {
    const entries = d.lexicon.entries(c.id).slice().sort((a, b) => b.strength - a.strength);
    const dom = entries[0];
    const row = h('div', { class: 'dict-row' },
      h('span', { class: 'concept', style: { color: `hsl(${c.hue},60%,68%)` }, title: c.gloss }, c.label),
      dom
        ? h('span', { class: 'word', title: `${wordToRoma(dom.form)} · 定着 ${dom.strength.toFixed(1)} · 用例 ${dom.uses}` },
            wordToKana(dom.form))
        : h('span', { class: 'word none' }, '—'),
      // 競合する同義語（小さく）
      entries.length > 1
        ? h('span', { class: 'synonyms' },
            ...entries.slice(1, 4).map(e =>
              h('span', { class: 'syn', title: `定着 ${e.strength.toFixed(1)}` }, wordToKana(e.form))))
        : null,
    );
    // 定着度バー
    if (dom) {
      row.append(h('span', { class: 'strength-bar' },
        h('i', { style: { width: `${(dom.strength / 8) * 100}%`, background: `hsl(${c.hue},60%,55%)` } })));
    }
    list.append(row);
  }
  root.append(list);
}

/* ============================================================
   言語史フィード — 流れる出来事。
   ============================================================ */
const ICON = {
  [EV.GENESIS]: '◌', [EV.BIRTH]: '✦', [EV.DEATH]: '†', [EV.SHIFT]: '↝',
  [EV.SPLIT]: '⋔', [EV.BORROW]: '⇄', [EV.DEMEDEATH]: '✝', [EV.WORLDEVENT]: '☄',
};
let lastLen = 0;
export function renderFeed(root, world) {
  if (world.chronicle.entries.length === lastLen) return;
  lastLen = world.chronicle.entries.length;
  clear(root);
  for (const e of world.chronicle.recent(9).reverse()) {
    root.append(h('div', { class: `ev ev-${e.kind}` },
      h('span', { class: 'ev-year' }, e.year),
      h('span', { class: 'ev-ic' }, ICON[e.kind] || '·'),
      h('span', { class: 'ev-text' }, e.text)));
  }
}
export function resetFeed() { lastLen = -1; }

/* 全史パネル（フィルタつき） */
const FILTERS = {
  major: e => [EV.GENESIS, EV.BIRTH, EV.SPLIT, EV.DEMEDEATH, EV.DEATH].includes(e.kind),
  birth: e => e.kind === EV.BIRTH,
  death: e => e.kind === EV.DEATH || e.kind === EV.DEMEDEATH,
  shift: e => e.kind === EV.SHIFT,
  dialect: e => e.kind === EV.SPLIT || e.kind === EV.BORROW,
  all: () => true,
};
export function renderAnnals(listEl, world, filter) {
  const f = FILTERS[filter] || FILTERS.major;
  const items = world.chronicle.entries.filter(f).slice(-600);
  clear(listEl);
  for (const e of items) {
    listEl.append(h('div', { class: `ev ev-${e.kind}` },
      h('span', { class: 'ev-year' }, e.year),
      h('span', { class: 'ev-ic' }, ICON[e.kind] || '·'),
      h('span', { class: 'ev-text' }, e.text)));
  }
  if (!items.length) listEl.append(h('div', { class: 'dim', style: { padding: '1em' } }, 'まだ何も書かれていない'));
  listEl.scrollTop = listEl.scrollHeight;
}

/* ============================================================
   年表グラフ — 語彙数（白）・群数（紫）・理解度（緑）。
   ============================================================ */
export function drawChart(ctx, world, w, h) {
  ctx.clearRect(0, 0, w, h);
  const hist = world.history;
  if (hist.length < 2) return;
  let maxW = 10, maxD = 3;
  for (const s of hist) { if (s.words > maxW) maxW = s.words; if (s.demes > maxD) maxD = s.demes; }
  const X = i => (i / (hist.length - 1)) * (w - 4) + 2;
  const line = (get, max, style, lw = 1.2) => {
    ctx.strokeStyle = style; ctx.lineWidth = lw; ctx.beginPath();
    hist.forEach((s, i) => {
      const y = h - 4 - (get(s) / max) * (h - 10);
      i ? ctx.lineTo(X(i), y) : ctx.moveTo(X(i), y);
    });
    ctx.stroke();
  };
  line(s => s.demes, maxD, 'rgba(190,140,255,0.7)');
  line(s => s.comprehension, 1, 'rgba(120,210,150,0.8)');
  line(s => s.words, maxW, 'rgba(235,240,255,0.95)', 1.6);
  const last = hist[hist.length - 1];
  ctx.font = '9px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(235,240,255,0.6)'; ctx.fillText(`語彙 ${last.words}`, 6, 11);
  ctx.fillStyle = 'rgba(190,140,255,0.75)'; ctx.fillText(`群 ${last.demes}`, 6, 22);
  ctx.fillStyle = 'rgba(120,210,150,0.8)'; ctx.fillText(`理解 ${(last.comprehension * 100 | 0)}%`, 6, 33);
}
