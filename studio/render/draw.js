/* ============================================================
   描画 — モデル＋レイアウト → SVG 文字列。純粋（DOM を触らない）。
   フローチャートは Mermaid の形（角丸・丸・スタジアム・円柱・円・菱形・六角）を描き分け、
   エッジは実線/点線/太線・矢印・ラベルを描く。
   ガントは done/active/crit/milestone を配色で見せる。
   各要素に data-id を付け、ui がつかんで動かす。
   ============================================================ */

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const HUES = ['#6aa9ff', '#7ad1b0', '#f5b86a', '#d68ad6', '#f57a8a', '#8ad1f5', '#b8a6ff', '#9ad17a'];
const hueOf = (i) => HUES[((i % HUES.length) + HUES.length) % HUES.length];

// ハイパーリンクの ↗ バッジ（要素の右肩）。UI がクリックで開く。
function linkBadge(url, cx, cy) {
  return `<g data-linkbtn="1" data-url="${esc(url)}" style="cursor:pointer">`
    + `<circle cx="${cx}" cy="${cy}" r="8" fill="#18202e" stroke="#6aa9ff" stroke-width="1.2"/>`
    + `<text x="${cx}" y="${cy + 3.5}" fill="#8fb6ff" font-size="9" text-anchor="middle">↗</text></g>`;
}

const DEFS = `<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#9aa3b5"/></marker>
  <marker id="cross" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M2,2 L8,8 M8,2 L2,8" stroke="#f57a8a" stroke-width="1.7" fill="none"/></marker>
  <marker id="open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9" fill="none" stroke="#9aa3b5" stroke-width="1.4"/></marker>
  <marker id="tri" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="13" markerHeight="13" orient="auto-start-reverse"><path d="M1,1 L11,6 L1,11 z" fill="#0b0e14" stroke="#9aa3b5" stroke-width="1.2"/></marker>
  <marker id="diaf" viewBox="0 0 14 10" refX="13" refY="5" markerWidth="14" markerHeight="10" orient="auto-start-reverse"><path d="M1,5 L7,1 L13,5 L7,9 z" fill="#9aa3b5"/></marker>
  <marker id="diao" viewBox="0 0 14 10" refX="13" refY="5" markerWidth="14" markerHeight="10" orient="auto-start-reverse"><path d="M1,5 L7,1 L13,5 L7,9 z" fill="#0b0e14" stroke="#9aa3b5" stroke-width="1.2"/></marker>
</defs>`;

function wrap(L, inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.ceil(L.width)} ${Math.ceil(L.height)}" `
    + `width="${Math.ceil(L.width)}" height="${Math.ceil(L.height)}" font-family="ui-sans-serif,system-ui,sans-serif">`
    + DEFS + inner + '</svg>';
}

// ---- ガント ---------------------------------------------------------------

function drawGantt(model, L) {
  const secIndex = new Map(); let si = -1, last;
  for (const b of L.bars) { if (b.section !== last) { last = b.section; si++; } secIndex.set(b.id, b.section ? si : 0); }
  const parts = [];

  for (const d of L.days) if (d.weekend)
    parts.push(`<rect x="${d.x}" y="${L.axisH}" width="${L.dayW}" height="${L.height - L.axisH}" fill="#ffffff" opacity="0.03"/>`);
  for (const d of L.days) {
    parts.push(`<line x1="${d.x}" y1="${L.axisH}" x2="${d.x}" y2="${L.height}" stroke="#ffffff" stroke-opacity="0.05"/>`);
    if (d.d % 7 === 0) parts.push(`<text x="${d.x + 3}" y="${L.axisH - 14}" fill="#8a93a6" font-size="10">${esc(d.date.slice(5))}</text>`);
  }
  if (L.today) parts.push(
    `<line x1="${L.today.x}" y1="${L.axisH - 6}" x2="${L.today.x}" y2="${L.height}" stroke="#f57a8a" stroke-width="1.5" stroke-dasharray="3 3"/>`,
    `<text x="${L.today.x + 4}" y="${L.axisH - 2}" fill="#f57a8a" font-size="10">today</text>`);

  const byId = new Map(L.bars.map((b) => [b.id, b]));
  for (const b of L.bars) {
    const it = model.items.find((x) => x.id === b.id);
    for (const dep of (it?.after || [])) {
      const a = byId.get(dep); if (!a) continue;
      const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2;
      parts.push(`<path d="M${x1},${y1} C${x1 + 12},${y1} ${x2 - 12},${y2} ${x2},${y2}" fill="none" stroke="#9aa3b5" stroke-opacity="0.4" marker-end="url(#arrow)"/>`);
    }
  }
  for (const s of L.sections)
    parts.push(`<text x="8" y="${s.y + 14}" fill="#aeb6c6" font-size="11" font-weight="600">${esc(s.name)}</text>`);

  for (const b of L.bars) {
    const hue = hueOf(secIndex.get(b.id));
    parts.push(`<text x="8" y="${b.rowY + L.rowH / 2 + 4}" fill="#d7dbe6" font-size="12">${esc(b.label)}</text>`);
    if (b.type === 'milestone') {
      const cx = b.x, cy = b.y + b.h / 2, r = b.h / 2;
      parts.push(`<g data-drag="bar" data-id="${esc(b.id)}" style="cursor:grab"><path d="M${cx},${cy - r} L${cx + r},${cy} L${cx},${cy + r} L${cx - r},${cy} z" fill="${hue}" stroke="#0b0e14"/></g>`);
    } else {
      const crit = b.status === 'crit', active = b.status === 'active', done = b.status === 'done';
      const fillOp = done ? 0.95 : active ? 0.5 : 0.9;
      const it2 = model.items.find((x) => x.id === b.id);
      let g = `<g data-drag="bar" data-id="${esc(b.id)}" style="cursor:grab">`
        + `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="4" fill="${hue}" opacity="${fillOp}"`
        + (crit ? ` stroke="#f5667a" stroke-width="2"` : active ? ` stroke="${hue}" stroke-width="1.5" stroke-dasharray="4 3"` : '') + `/>`;
      if (done) g += `<path d="M${b.x + 5},${b.y + b.h / 2} l3,4 l6,-7" fill="none" stroke="#0b0e14" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>`;
      if (it2?.link) g += linkBadge(it2.link, b.x + b.w + 11, b.y + b.h / 2);
      parts.push(g + `</g>`);
    }
  }
  return wrap(L, parts.join('\n'));
}

// ---- フローチャート --------------------------------------------------------

function shapePath(n) {
  const { x, y, w, h } = n, r = Math.min(12, h / 2);
  switch (n.shape) {
    case 'round': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
    case 'stadium': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}"/>`;
    case 'circle': return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}"/>`;
    case 'rhombus': return `<polygon points="${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}"/>`;
    case 'hexagon': { const o = Math.min(18, w / 4); return `<polygon points="${x + o},${y} ${x + w - o},${y} ${x + w},${y + h / 2} ${x + w - o},${y + h} ${x + o},${y + h} ${x},${y + h / 2}"/>`; }
    case 'cylinder': { const e = Math.min(8, h / 5); return `<path d="M${x},${y + e} a${w / 2},${e} 0 0 1 ${w},0 v${h - 2 * e} a${w / 2},${e} 0 0 1 ${-w},0 z M${x},${y + e} a${w / 2},${e} 0 0 0 ${w},0"/>`; }
    case 'subroutine': return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/><line x1="${x + 6}" y1="${y}" x2="${x + 6}" y2="${y + h}"/><line x1="${x + w - 6}" y1="${y}" x2="${x + w - 6}" y2="${y + h}"/>`;
    default: return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="5"/>`;
  }
}

function drawFlow(model, L, opts = {}) {
  const parts = [];
  for (const g of L.groups) {
    parts.push(`<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="10" fill="#ffffff" fill-opacity="0.03" stroke="#5a6b86" stroke-dasharray="4 4"/>`);
    parts.push(`<text x="${g.x + 12}" y="${g.y + 16}" fill="#aeb6c6" font-size="11" font-weight="600">${esc(g.name)}</text>`);
  }
  L.edges.forEach((e, i) => {
    const dash = e.dotted ? ` stroke-dasharray="2 4"` : '';
    const wdt = e.thick ? 2.5 : 1.4;
    parts.push(`<path d="M${e.x1},${e.y1} C${e.c1x},${e.c1y} ${e.c2x},${e.c2y} ${e.x2},${e.y2}" fill="none" stroke="#9aa3b5" stroke-opacity="0.75" stroke-width="${wdt}"${dash}${e.arrow ? ' marker-end="url(#arrow)"' : ''}/>`);
    if (e.label) {
      const tw = e.label.length * 7 + 10;
      parts.push(`<g data-edit="edge" data-i="${i}" style="cursor:text">`
        + `<rect x="${e.mx - tw / 2}" y="${e.my - 9}" width="${tw}" height="18" rx="4" fill="#0b0e14" opacity="0.85"/>`
        + `<text x="${e.mx}" y="${e.my + 4}" fill="#c7d0e0" font-size="11" text-anchor="middle">${esc(e.label)}</text></g>`);
    }
  });
  L.nodes.forEach((n, i) => {
    const hue = hueOf(i);
    const sel = !!opts.selected?.has?.(n.id);
    const inner = shapePath(n).replace(/<(rect|ellipse|polygon|path)([^>]*?)\/>/g,
      `<$1$2 fill="#161b26" stroke="${hue}" stroke-width="${sel ? 2.6 : 1.5}"/>`)
      .replace(/<line([^>]*?)\/>/g, `<line$1 stroke="${hue}" stroke-width="1.3"/>`);
    let g = `<g data-drag="node" data-id="${esc(n.id)}" style="cursor:grab">`;
    if (sel) g += `<rect x="${n.x - 5}" y="${n.y - 5}" width="${n.w + 10}" height="${n.h + 10}" rx="10" fill="none" stroke="#6aa9ff" stroke-opacity="0.5" stroke-dasharray="3 3"/>`;
    g += inner + `<text x="${n.x + n.w / 2}" y="${n.y + n.h / 2 + 4}" fill="#e7ebf4" font-size="12.5" text-anchor="middle">${esc(n.label)}</text>`;
    if (n.link) g += linkBadge(n.link, n.x + n.w - 2, n.y + 2);
    parts.push(g + `</g>`);
    if (sel && opts.selected.size === 1) parts.push(connectHandle(n));
  });
  return wrap(L, parts.join('\n'));
}

// 選択ノードから生える接続ハンドル（引っぱって別ノードへ落とすとエッジ）。
function connectHandle(n) {
  return `<g data-connect="1" data-id="${esc(n.id)}" style="cursor:crosshair">`
    + `<circle cx="${n.x + n.w + 14}" cy="${n.y + n.h / 2}" r="8" fill="#6aa9ff"/>`
    + `<text x="${n.x + n.w + 14}" y="${n.y + n.h / 2 + 3.5}" fill="#0b0e14" font-size="10" text-anchor="middle" font-weight="700">→</text></g>`;
}

// ---- クラス図 ----------------------------------------------------------------

const CLASS_MARKER = { inherit: 'tri', composition: 'diaf', aggregation: 'diao', assoc: 'arrow' };

function drawClass(model, L, opts = {}) {
  const parts = [];
  L.edges.forEach((e, i) => {
    const marker = CLASS_MARKER[e.kind];
    const dash = e.dotted ? ` stroke-dasharray="4 4"` : '';
    parts.push(`<line x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}" stroke="#9aa3b5" stroke-opacity="0.8" stroke-width="1.4"${dash}${marker ? ` marker-end="url(#${marker})"` : ''}/>`);
    if (e.label) {
      const tw = e.label.length * 7 + 10;
      parts.push(`<g data-edit="edge" data-i="${i}" style="cursor:text">`
        + `<rect x="${e.mx - tw / 2}" y="${e.my - 9}" width="${tw}" height="18" rx="4" fill="#0b0e14" opacity="0.85"/>`
        + `<text x="${e.mx}" y="${e.my + 4}" fill="#c7d0e0" font-size="11" text-anchor="middle">${esc(e.label)}</text></g>`);
    }
  });
  L.nodes.forEach((n, i) => {
    const hue = hueOf(i);
    const sel = !!opts.selected?.has?.(n.id);
    let g = `<g data-drag="node" data-id="${esc(n.id)}" style="cursor:grab">`;
    if (sel) g += `<rect x="${n.x - 5}" y="${n.y - 5}" width="${n.w + 10}" height="${n.h + 10}" rx="8" fill="none" stroke="#6aa9ff" stroke-opacity="0.5" stroke-dasharray="3 3"/>`;
    g += `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="6" fill="#161b26" stroke="${hue}" stroke-width="${sel ? 2.4 : 1.5}"/>`;
    g += `<text x="${n.x + n.w / 2}" y="${n.y + 17}" fill="#e7ebf4" font-size="12.5" font-weight="700" text-anchor="middle">${esc(n.label)}</text>`;
    let y = n.y + 26;
    if (n.attrs.length || n.methods.length) {
      g += `<line x1="${n.x}" y1="${y}" x2="${n.x + n.w}" y2="${y}" stroke="${hue}" stroke-opacity="0.5"/>`;
      y += 4;
      for (const a of n.attrs) { y += 13; g += `<text x="${n.x + 10}" y="${y}" fill="#c7d0e0" font-size="11">${esc(a)}</text>`; y += 3; }
      if (n.methods.length) {
        if (n.attrs.length) { g += `<line x1="${n.x}" y1="${y + 2}" x2="${n.x + n.w}" y2="${y + 2}" stroke="${hue}" stroke-opacity="0.35"/>`; y += 5; }
        for (const m of n.methods) { y += 13; g += `<text x="${n.x + 10}" y="${y}" fill="#aeb9d0" font-size="11" font-style="italic">${esc(m)}</text>`; y += 3; }
      }
    }
    parts.push(g + `</g>`);
    if (sel && opts.selected.size === 1) parts.push(connectHandle(n));
  });
  return wrap(L, parts.join('\n'));
}

// ---- シーケンス図 -----------------------------------------------------------

function drawSeq(model, L) {
  const parts = [];
  // 枠（loop/alt…）：全幅の淡い矩形＋左肩のラベル札＋区切り（else）。
  for (const f of L.frames) {
    parts.push(`<rect x="${f.x}" y="${f.y0}" width="${f.w}" height="${f.y1 - f.y0}" rx="8" fill="#ffffff" fill-opacity="0.025" stroke="#5a6b86" stroke-dasharray="4 4"/>`);
    const tag = f.kind + (f.label ? ' ' + f.label : '');
    parts.push(`<rect x="${f.x}" y="${f.y0}" width="${tag.length * 8 + 18}" height="20" rx="6" fill="#1c2436"/>`
      + `<text x="${f.x + 9}" y="${f.y0 + 14}" fill="#aeb6c6" font-size="11" font-weight="600">${esc(tag)}</text>`);
    for (const d of (f.divs || [])) {
      parts.push(`<line x1="${f.x}" y1="${d.y + 10}" x2="${f.x + f.w}" y2="${d.y + 10}" stroke="#5a6b86" stroke-dasharray="4 4" stroke-opacity="0.7"/>`
        + `<text x="${f.x + 9}" y="${d.y + 6}" fill="#8a93a6" font-size="10.5" font-style="italic">[${esc(d.label || 'else')}]</text>`);
    }
  }
  // ライフライン（点線）。
  for (const a of L.actors)
    parts.push(`<line x1="${a.cx}" y1="${L.lifeTop}" x2="${a.cx}" y2="${L.height - 10}" stroke="#5a6b86" stroke-dasharray="4 4" stroke-opacity="0.55"/>`);
  // メッセージ。
  for (const m of L.msgs) {
    const dash = m.dotted ? ` stroke-dasharray="3 4"` : '';
    const marker = m.cross ? 'cross' : m.arrow ? (m.async ? 'open' : 'arrow') : null;
    const tag = (L.autonumber ? `${m.n}. ` : '') + m.label;
    if (m.self) {
      const w = L.selfW;
      parts.push(`<path d="M${m.x1},${m.y} h${w} v14 h${-w + 4}" fill="none" stroke="#9aa3b5" stroke-width="1.4"${dash}${marker ? ` marker-end="url(#${marker})"` : ''}/>`);
      if (tag) parts.push(`<text x="${m.x1 + w + 8}" y="${m.y + 11}" fill="#c7d0e0" font-size="11.5">${esc(tag)}</text>`);
    } else {
      parts.push(`<line x1="${m.x1}" y1="${m.y}" x2="${m.x2}" y2="${m.y}" stroke="#9aa3b5" stroke-width="1.4"${dash}${marker ? ` marker-end="url(#${marker})"` : ''}/>`);
      if (tag) parts.push(`<text x="${(m.x1 + m.x2) / 2}" y="${m.y - 6}" fill="#c7d0e0" font-size="11.5" text-anchor="middle">${esc(tag)}</text>`);
    }
  }
  // ノート（琥珀の付箋）。
  for (const n of L.notes)
    parts.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="4" fill="#2e2a1c" stroke="#f5b86a" stroke-opacity="0.55"/>`
      + `<text x="${n.x + n.w / 2}" y="${n.y + 17}" fill="#e8dcb0" font-size="11.5" text-anchor="middle">${esc(n.label)}</text>`);
  // 参加者（上端の札。つかんで並び替えられる）。
  L.actors.forEach((a, i) => {
    const hue = hueOf(i);
    parts.push(`<g data-drag="actor" data-id="${esc(a.id)}" style="cursor:grab">`
      + `<rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="8" fill="#161b26" stroke="${hue}" stroke-width="1.5"/>`
      + `<text x="${a.cx}" y="${a.y + a.h / 2 + 4}" fill="#e7ebf4" font-size="12.5" text-anchor="middle">${esc(a.label)}</text></g>`);
  });
  return wrap(L, parts.join('\n'));
}

export function draw(model, L, opts = {}) {
  if (L.kind === 'flowchart') return drawFlow(model, L, opts);
  if (L.kind === 'sequence') return drawSeq(model, L);
  if (L.kind === 'class') return drawClass(model, L, opts);
  return drawGantt(model, L);
}
