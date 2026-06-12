import { melodyToKana } from '../core/scale.js';
import { OCCASIONS } from '../core/occasions.js';
import { EV, MAJOR } from '../core/chronicle.js';
import { h, clear } from './dom.js';

/* ============================================================
   パネル — 歌集・歌史・年表。core が生んだ音楽を文字と線で読む。
   ============================================================ */

const ICON = {
  [EV.GENESIS]: '◦', [EV.BIRTH]: '✦', [EV.DEATH]: '†', [EV.VAR]: '♪',
  [EV.SHIFT]: '↝', [EV.SPLIT]: '⋔', [EV.SPREAD]: '⇄',
  [EV.FLOCKDEATH]: '…', [EV.WORLDEVENT]: '!',
};
const iconOf = k => ICON[k] || '·';

/* ----- 歌集（選んだ群のいま） ----- */
let songbookKey = '';
export function renderSongbook(el, world, flock, onPlay) {
  if (!flock) {
    if (songbookKey !== 'empty') {
      clear(el).append(h('div', { class: 'dim hint' }, '地図の群をクリックすると、その民の歌集が読めます'));
      songbookKey = 'empty';
    }
    return;
  }
  // 毎フレーム作り直さない（内容が変わった時だけ）
  const sig = flock.id + ':' + OCCASIONS.map(o => {
    const d = flock.repertoire.dominant(o.id);
    return d ? `${d.sid}.${d.strength.toFixed(1)}` : '-';
  }).join(',');
  if (sig === songbookKey) return;
  songbookKey = sig;

  const rows = [];
  for (const o of OCCASIONS) {
    const list = flock.repertoire.entries(o.id).slice().sort((a, b) => b.strength - a.strength);
    const dom = list[0];
    rows.push(h('div', { class: 'song-row' },
      h('span', { class: 'occ', style: { color: `hsl(${o.hue}, 60%, 70%)` } }, o.label),
      dom
        ? h('button', {
            class: 'melody', title: `うたう（覚えやすさ ${Math.round(dom.mem * 100)}・愛され度 ${dom.strength.toFixed(1)}）`,
            onclick: () => onPlay(dom, flock, o),
          }, '♪ ', melodyToKana(dom.melody))
        : h('span', { class: 'melody none' }, 'まだ歌がない'),
      h('span', { class: 'alts' }, dom && list.length > 1 ? `異節 ${list.length - 1}` : ''),
      dom && h('div', { class: 'strength-bar' },
        h('i', { style: { width: `${(dom.strength / 8) * 100}%`, background: `hsl(${o.hue}, 60%, 55%)` } })),
    ));
  }
  clear(el).append(
    h('div', { class: 'songbook-head' },
      h('span', { class: 'swatch', style: { background: `hsl(${flock.hue}, 65%, 58%)` } }),
      h('b', {}, `${flock.name}の民`),
      h('span', { class: 'dim small' },
        ` 人口 ${Math.round(flock.pop)} · ${flock.repertoire.size()} の歌`)),
    h('div', { class: 'song-list' }, rows),
  );
}
export function resetSongbook() { songbookKey = ''; }

/* ----- 歌史フィード ----- */
let feedSeen = 0;
const feedItems = [];
export function resetFeed() { feedSeen = 0; feedItems.length = 0; }
export function renderFeed(el, world) {
  const es = world.chronicle.entries;
  if (feedSeen > es.length) feedSeen = 0;   // 世界が変わった
  let added = false;
  for (; feedSeen < es.length; feedSeen++) {
    const e = es[feedSeen];
    if (!MAJOR.has(e.kind) && e.kind !== EV.WORLDEVENT && e.kind !== EV.VAR) continue;
    feedItems.push(e);
    added = true;
  }
  if (feedItems.length > 9) feedItems.splice(0, feedItems.length - 9);
  if (!added) return;
  clear(el).append(feedItems.map(e =>
    h('div', { class: `ev ev-${e.kind}` },
      h('span', { class: 'ev-year' }, e.year),
      h('span', { class: 'ev-ic' }, iconOf(e.kind)),
      h('span', { class: 'ev-text' }, e.text))));
}

/* ----- 全史 ----- */
const FILTERS = {
  major: e => MAJOR.has(e.kind),
  birth: e => e.kind === EV.BIRTH,
  death: e => e.kind === EV.DEATH || e.kind === EV.FLOCKDEATH,
  vary: e => e.kind === EV.VAR || e.kind === EV.SHIFT,
  spread: e => e.kind === EV.SPREAD || e.kind === EV.SPLIT,
  all: () => true,
};
export function renderAnnals(el, world, filter) {
  const fn = FILTERS[filter] || FILTERS.major;
  const list = world.chronicle.entries.filter(fn).slice(-400).reverse();
  clear(el).append(list.length
    ? list.map(e => h('div', { class: `ev ev-${e.kind}` },
        h('span', { class: 'ev-year' }, e.year),
        h('span', { class: 'ev-ic' }, iconOf(e.kind)),
        h('span', { class: 'ev-text' }, e.text)))
    : h('div', { class: 'dim hint' }, 'まだ何も起きていません'));
}

/* ----- 年表グラフ（歌 = 白、群 = 紫、覚えやすさ = 緑） ----- */
export function drawChart(ctx, world, w, h) {
  ctx.fillStyle = '#080709';
  ctx.fillRect(0, 0, w, h);
  const hist = world.history;
  if (hist.length < 2) return;
  const n = hist.length;
  let maxSongs = 1;
  for (const s of hist) maxSongs = Math.max(maxSongs, s.songs);

  const line = (get, max, color, lw = 1.2) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * (w - 8) + 4;
      const y = h - 4 - (get(hist[i]) / max) * (h - 10);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  line(s => s.songs, maxSongs, 'rgba(245,240,235,0.85)');
  line(s => s.flocks, 16, 'rgba(205,164,255,0.8)');
  line(s => s.catchiness, 1, 'rgba(154,245,180,0.85)');

  ctx.font = '9px ui-sans-serif';
  ctx.fillStyle = 'rgba(235,238,250,0.5)';
  ctx.textAlign = 'left';
  const last = hist[n - 1];
  ctx.fillText(`歌 ${last.songs}`, 6, 12);
  ctx.fillStyle = 'rgba(205,164,255,0.7)';
  ctx.fillText(`群 ${last.flocks}`, 6, 23);
  ctx.fillStyle = 'rgba(154,245,180,0.7)';
  ctx.fillText(`覚えやすさ ${(last.catchiness * 100 | 0)}`, 6, 34);
}
