/* ============================================================
   描画 — モデル＋レイアウト → SVG 文字列。純粋（DOM を触らない）。
   UI はこの文字列を innerHTML に流すだけ。ドラッグのたびに呼び直して描き替える。
   各要素に data-id を付け、ui/interact.js がつかんで動かす。
   ============================================================ */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const HUES = ['#6aa9ff', '#7ad1b0', '#f5b86a', '#d68ad6', '#f57a8a', '#8ad1f5', '#b8a6ff'];
const hueOf = (i) => HUES[((i % HUES.length) + HUES.length) % HUES.length];

const DEFS = `<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="#9aa3b5"/>
  </marker>
</defs>`;

// ---- ガント ---------------------------------------------------------------

function drawGantt(model, L) {
  const secIndex = new Map(); let si = -1, last;
  for (const b of L.bars) { if (b.section !== last) { last = b.section; si++; } secIndex.set(b.id, b.section ? si : 0); }
  const parts = [];

  // 週末の薄帯。
  for (const d of L.days) if (d.weekend)
    parts.push(`<rect x="${d.x}" y="${L.axisH}" width="${L.dayW}" height="${L.height - L.axisH}" fill="#ffffff" opacity="0.03"/>`);
  // 縦の日付グリッド＋目盛り（週頭にラベル）。
  for (const d of L.days) {
    parts.push(`<line x1="${d.x}" y1="${L.axisH}" x2="${d.x}" y2="${L.height}" stroke="#ffffff" stroke-opacity="0.05"/>`);
    if (d.d % 7 === 0) parts.push(`<text x="${d.x + 3}" y="${L.axisH - 14}" fill="#8a93a6" font-size="10">${esc(d.date.slice(5))}</text>`);
  }
  if (L.today) parts.push(
    `<line x1="${L.today.x}" y1="${L.axisH - 6}" x2="${L.today.x}" y2="${L.height}" stroke="#f57a8a" stroke-width="1.5" stroke-dasharray="3 3"/>`,
    `<text x="${L.today.x + 4}" y="${L.axisH - 2}" fill="#f57a8a" font-size="10">today</text>`);

  // 依存のうすい結線（前タスクの終わり → 後タスクの始まり）。
  const byId = new Map(L.bars.map((b) => [b.id, b]));
  for (const b of L.bars) {
    const it = model.items.find((x) => x.id === b.id);
    for (const dep of (it?.after || [])) {
      const a = byId.get(dep); if (!a) continue;
      const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
      parts.push(`<path d="M${x1},${y1} C${x1 + 12},${y1} ${x2 - 12},${y2} ${x2},${y2}" fill="none" stroke="#9aa3b5" stroke-opacity="0.45" marker-end="url(#arrow)"/>`);
    }
  }

  // セクション見出し。
  for (const s of L.sections)
    parts.push(`<text x="8" y="${s.y + 14}" fill="#aeb6c6" font-size="11" font-weight="600">${esc(s.name)}</text>`);

  // 行ラベル＋棒。
  for (const b of L.bars) {
    const hue = hueOf(secIndex.get(b.id));
    parts.push(`<text x="8" y="${b.rowY + L.rowH / 2 + 4}" fill="#d7dbe6" font-size="12">${esc(b.label)}</text>`);
    if (b.type === 'milestone') {
      const cx = b.x, cy = b.y + b.h / 2, r = b.h / 2;
      parts.push(`<g data-drag="bar" data-id="${esc(b.id)}" style="cursor:grab"><path d="M${cx},${cy - r} L${cx + r},${cy} L${cx},${cy + r} L${cx - r},${cy} z" fill="${hue}" stroke="#0b0e14"/></g>`);
    } else {
      const done = Math.max(0, Math.min(1, b.done / 100));
      parts.push(`<g data-drag="bar" data-id="${esc(b.id)}" style="cursor:grab">`
        + `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="4" fill="${hue}" opacity="0.92"/>`
        + (done > 0 ? `<rect x="${b.x}" y="${b.y}" width="${b.w * done}" height="${b.h}" rx="4" fill="#0b0e14" opacity="0.28"/>` : '')
        + `</g>`);
    }
  }
  return wrap(L, parts.join('\n'));
}

// ---- アーキ図 --------------------------------------------------------------

function drawArch(model, L) {
  const parts = [];
  for (const g of L.groups) {
    parts.push(`<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="10" fill="#ffffff" fill-opacity="0.03" stroke="#5a6b86" stroke-dasharray="4 4"/>`);
    parts.push(`<text x="${g.x + 12}" y="${g.y + 16}" fill="#aeb6c6" font-size="11" font-weight="600">${esc(g.name)}</text>`);
  }
  for (const e of L.edges)
    parts.push(`<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="#9aa3b5" stroke-opacity="0.7" marker-end="url(#arrow)"/>`);
  L.nodes.forEach((n, i) => {
    const hue = hueOf(i);
    parts.push(`<g data-drag="node" data-id="${esc(n.id)}" style="cursor:grab">`
      + `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="9" fill="#161b26" stroke="${hue}" stroke-width="1.5"/>`
      + `<text x="${n.x + n.w / 2}" y="${n.y + n.h / 2 + 4}" fill="#e7ebf4" font-size="12.5" text-anchor="middle">${esc(n.label)}</text>`
      + `</g>`);
  });
  return wrap(L, parts.join('\n'));
}

function wrap(L, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(L.width)} ${Math.ceil(L.height)}" `
    + `width="${Math.ceil(L.width)}" height="${Math.ceil(L.height)}" font-family="ui-sans-serif,system-ui,sans-serif">`
    + DEFS + inner + '</svg>';
}

export function draw(model, L) {
  return L.kind === 'arch' ? drawArch(model, L) : drawGantt(model, L);
}
