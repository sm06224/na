import { TIERS } from '../core/settlement.js';
import { ERAS, TECH_THRESHOLD, maxEra } from '../core/tech.js';

/* ============================================================
   見聞録 — 選んだ都市と、それを治める国の今。
   ============================================================ */

export function renderInspector(el, city, world) {
  if (!city || !world.settlementById.has(city.id)) {
    el.innerHTML = '<div class="dim">地図上の都市をクリックすると、その来歴が読めます</div>';
    return;
  }
  const n = world.nations.get(city.nationId);
  const hue = n ? n.hue : 0;
  const swatch = n
    ? `<span class="swatch" style="background:hsl(${hue},70%,60%)"></span>`
    : '<span class="swatch" style="background:#9aa0ae"></span>';

  let nationBlock = '<div class="dim small">いずれの国にも属さない</div>';
  if (n) {
    const era = n.era;
    const next = era < maxEra() ? TECH_THRESHOLD[era + 1] : null;
    const techPct = next ? Math.min(100, (n.tech / next) * 100).toFixed(0) : 100;
    nationBlock = `
      <div class="kv"><span>国</span><b>${n.name}</b></div>
      <div class="kv"><span>王</span><b>${n.ruler}</b> <span class="dim small">（紀元 ${n.rulerSince} 年より）</span></div>
      <div class="kv"><span>時代</span><b>${ERAS[era]}</b>
        <span class="dim small">${next ? `次代まで ${techPct}%` : '爛熟'}</span></div>
      <div class="kv"><span>安定</span>${meter(n.stability, n.stability > 0.5 ? 150 : 10)}</div>`;
  }

  const wonders = city.wonders.length
    ? `<div class="kv"><span>大事業</span><b>${city.wonders.join('、')}</b></div>` : '';

  const events = world.chronicle.ofCity(city.id, 6).map(e =>
    `<div class="ev small"><span class="ev-year">${e.year}</span>${e.text}</div>`).join('');

  el.innerHTML = `
    <div class="sp-head">${swatch}<b>${city.name}</b>
      <span class="dim">${TIERS[city.tier()]}${city.isCapital ? '・首都' : ''}</span></div>
    <div class="kv"><span>人口</span><b>${Math.round(city.pop).toLocaleString()}</b></div>
    <div class="kv"><span>建設</span><b>紀元 ${city.founded} 年</b></div>
    ${wonders}
    <hr class="thin">
    ${nationBlock}
    ${events ? `<hr class="thin"><div class="city-events">${events}</div>` : ''}`;
}

function meter(v, hue) {
  const t = Math.max(0, Math.min(1, v));
  return `<div class="gbar"><i style="width:${(t * 100).toFixed(0)}%;background:hsl(${hue},65%,55%)"></i></div>`;
}
