import { KIND, MAJOR } from '../core/chronicle.js';

/* ============================================================
   史書の頁 — 流れる近況と、開けば全史が読める「全史の間」。
   ============================================================ */

export const KIND_ICON = {
  [KIND.GENESIS]: '◌', [KIND.FOUND]: '⌂', [KIND.NATION]: '👑',
  [KIND.ERA]: '⚙', [KIND.WAR]: '⚔', [KIND.BATTLE]: '⚔',
  [KIND.CONQUEST]: '🔥', [KIND.PEACE]: '🕊', [KIND.RULER]: '✦',
  [KIND.REBEL]: '⚡', [KIND.FALL]: '✝', [KIND.PLAGUE]: '☠',
  [KIND.DISASTER]: '〜', [KIND.WONDER]: '◈', [KIND.ANNEX]: '⊕',
};

const FILTERS = {
  all: () => true,
  major: e => MAJOR.has(e.kind),
  war: e => [KIND.WAR, KIND.BATTLE, KIND.CONQUEST, KIND.PEACE, KIND.REBEL, KIND.FALL].includes(e.kind),
  state: e => [KIND.NATION, KIND.FALL, KIND.RULER, KIND.ERA].includes(e.kind),
  calamity: e => [KIND.PLAGUE, KIND.DISASTER].includes(e.kind),
};

let lastCount = 0;
export function renderFeed(el, world) {
  if (world.chronicle.entries.length === lastCount) return;
  lastCount = world.chronicle.entries.length;
  const recent = world.chronicle.recent(8).reverse();
  el.innerHTML = recent.map(entryHTML).join('');
}
export function resetFeed() { lastCount = 0; }

export function renderAnnals(listEl, world, filterName) {
  const f = FILTERS[filterName] || FILTERS.major;
  const entries = world.chronicle.entries.filter(f);
  // 多すぎる場合は新しい方を優先
  const shown = entries.slice(-600);
  listEl.innerHTML = shown.map(entryHTML).join('') ||
    '<div class="dim" style="padding:1em">まだ何も書かれていない</div>';
  listEl.scrollTop = listEl.scrollHeight;
}

function entryHTML(e) {
  return `<div class="ev ev-${e.kind}">` +
    `<span class="ev-year">${e.year}</span>` +
    `<span class="ev-ic">${KIND_ICON[e.kind] || '·'}</span>` +
    `<span class="ev-text">${e.text}</span></div>`;
}
