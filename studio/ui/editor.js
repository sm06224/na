/* ============================================================
   studio のエディタ — Mermaid を書き、その場で図にし、グリグリ動かす。
   構文ハイライト・行番号・リアルタイム検証（エラー下線＋一覧）・オートコンプリート、
   ズーム/パン/フィット、スナップ付きドラッグ、サンプル、各種エクスポート（DSL/.mmd/SVG/単一HTML）。
   描画の核（parse/layout/serialize/draw）は依存ゼロ・決定的。ここはそれを操る手。
   ============================================================ */
import { parse } from '../engine/parse.js';
import { layout } from '../engine/layout.js';
import { serialize } from '../engine/serialize.js';
import { draw } from '../render/draw.js';
import { addDays } from '../engine/date.js';

const escHtml = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export const SAMPLES = {
  'ガント — 製品リリース計画': `gantt
    title 製品リリース計画
    dateFormat YYYY-MM-DD
    section 設計
      要件定義   :done, req, 2026-07-01, 5d
      基本設計   :active, design, after req, 7d
    section 実装
      API 実装   :api, after design, 10d
      UI 実装    :ui, after design, 12d
      基盤構築   :crit, infra, 2026-07-08, 9d
    section 検証と出荷
      結合テスト :test, after api ui, 6d
      受け入れ   :uat, after test, 4d
      出荷       :milestone, ship, after uat, 0d
%% @layout
%% today 2026-07-16`,
  'フロー — サービス構成図': `flowchart TD
    web[Web フロント] --> gw(API ゲートウェイ)
    mobile([モバイル]) --> gw
    gw -->|認証| auth{認証OK?}
    gw --> order[注文サービス]
    gw --> cat[カタログ]
    order --> pay[決済]
    order --> db[(主データベース)]
    cat --> cache((キャッシュ))
    auth --> db
    subgraph クライアント
      web
      mobile
    end
    subgraph データ基盤
      db
      cache
    end`,
  'フロー — 状態遷移': `flowchart LR
    s([開始]) --> a[下書き]
    a -->|提出| b{レビュー}
    b -->|承認| c[公開]
    b -->|差戻し| a
    c --> e([終了])`,
  'シーケンス — 認証フロー': `sequenceDiagram
    autonumber
    participant u as 利用者
    participant w as Web
    participant a as 認証サービス
    participant d as DB
    u->>w: ログイン要求
    w->>a: 資格情報を検証
    a->>d: 利用者を照会
    d-->>a: レコード
    alt 検証OK
      a-->>w: トークン発行
      w-->>u: ようこそ
    else 失敗
      a--xw: 拒否
      w-->>u: エラー表示
    end
    Note over u,w: 3回失敗でロック`,
};

const MODULES = ['engine/date.js', 'engine/parse.js', 'engine/layout.js', 'engine/serialize.js', 'render/draw.js', 'ui/editor.js'];

// ---- 構文ハイライト --------------------------------------------------------
const HL = /(-->>|->>|-->|---|-\.->|-\.-|==>|===|--o|--x|-x|--\)|-\))|(\|[^|]*\|)|\b(gantt|flowchart|graph|sequenceDiagram|participant|actor|autonumber|Note|note|over|title|dateFormat|axisFormat|section|subgraph|end|direction|after|loop|alt|opt|par|else)\b|\b(done|active|crit|milestone)\b|(\d{4}[-/]\d{1,2}[-/]\d{1,2})|\b(\d+(?:\.\d+)?[dwh])\b/g;
function hlLine(line) {
  if (line.trimStart().startsWith('%%')) return `<span class="tk-com">${escHtml(line)}</span>`;
  let out = '', last = 0, m; HL.lastIndex = 0;
  while ((m = HL.exec(line))) {
    out += escHtml(line.slice(last, m.index));
    const cls = (m[1] || m[2]) ? 'tk-arrow' : m[3] ? 'tk-kw' : m[4] ? 'tk-tag' : 'tk-date';
    out += `<span class="${cls}">${escHtml(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + escHtml(line.slice(last));
}

export function boot() {
  const $ = (id) => document.getElementById(id);
  const src = $('src'), hl = $('hl'), gutter = $('gutter'), canvas = $('canvas'), stage = $('stage');
  const status = $('status'), kindBadge = $('kind'), problems = $('problems'), ac = $('ac');
  let model = parse(''), L = null;
  const view = { tx: 0, ty: 0, s: 1 };

  // ---- 描画パイプライン ----
  function highlight() {
    const lines = src.value.split('\n');
    hl.innerHTML = lines.map(hlLine).join('\n') + '\n';
    gutter.innerHTML = lines.map((_, i) => `<div class="ln" data-ln="${i + 1}">${i + 1}</div>`).join('');
    syncScroll();
  }
  function syncScroll() { hl.parentElement.scrollTop = src.scrollTop; hl.parentElement.scrollLeft = src.scrollLeft; gutter.scrollTop = src.scrollTop; }

  function render() {
    model = parse(src.value);
    L = layout(model);
    canvas.innerHTML = draw(model, L);
    applyView();
    kindBadge.textContent = model.kind || '—';
    const probs = [...model.errors.map((e) => ({ e, where: 'parse' })), ...(L.errors || []).map((e) => ({ e, where: 'layout' }))];
    const badLines = new Set();
    problems.innerHTML = probs.map(({ e }) => {
      const m = /^L(\d+)/.exec(e); if (m) badLines.add(+m[1]);
      return `<div class="p"${m ? ` data-ln="${m[1]}"` : ''}>${m ? `<span class="ln">L${m[1]}</span>` : '<span class="ln">•</span>'}<span>${escHtml(e.replace(/^L\d+:\s*/, ''))}</span></div>`;
    }).join('');
    for (const el of gutter.children) el.classList.toggle('bad', badLines.has(+el.dataset.ln));
    status.textContent = probs.length ? `${probs.length} 件の指摘` : (model.kind ? `${model.kind} ・ ${model.items.length} 項目 ・ OK` : '空です');
    status.dataset.bad = probs.length ? '1' : '';
    refreshIns();
  }

  // ---- ビュー（ズーム・パン・フィット） ----
  function applyView() { canvas.style.transform = `translate(${view.tx}px,${view.ty}px) scale(${view.s})`; $('zLabel').textContent = Math.round(view.s * 100) + '%'; }
  function fit() {
    if (!L) return;
    const r = stage.getBoundingClientRect(), pad = 40;
    view.s = Math.max(0.2, Math.min(2, Math.min((r.width - pad) / L.width, (r.height - pad) / L.height)));
    view.tx = (r.width - L.width * view.s) / 2; view.ty = Math.max(16, (r.height - L.height * view.s) / 2);
    applyView();
  }
  function zoomAt(cx, cy, factor) {
    const r = stage.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
    const ns = Math.max(0.15, Math.min(4, view.s * factor));
    view.tx = x - (x - view.tx) * (ns / view.s); view.ty = y - (y - view.ty) * (ns / view.s); view.s = ns; applyView();
  }
  stage.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
  $('zIn').onclick = () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2); };
  $('zOut').onclick = () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2); };
  $('zFit').onclick = fit;

  // ---- ドラッグ（要素を動かす／空きをパン）----
  let drag = null, pan = null;
  stage.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('[data-drag]');
    if (g) {
      const id = g.dataset.id, kind = g.dataset.drag;
      if (kind === 'node') { const n = L.nodes.find((x) => x.id === id); drag = { id, kind, x0: n.x, y0: n.y, px: e.clientX, py: e.clientY }; }
      else if (kind === 'actor') {
        const as = L.actors, spacing = as.length > 1 ? (as[as.length - 1].cx - as[0].cx) / (as.length - 1) : 100;
        drag = { id, kind, order: as.map((a) => a.id), spacing, px: e.clientX, py: e.clientY };
      }
      else { const b = L.bars.find((x) => x.id === id); drag = { id, kind, day0: b.startDay, order: L.bars.map((x) => x.id), px: e.clientX, py: e.clientY }; }
    } else { pan = { tx: view.tx, ty: view.ty, px: e.clientX, py: e.clientY }; stage.classList.add('panning'); }
    stage.setPointerCapture?.(e.pointerId); e.preventDefault();
  });
  stage.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = (e.clientX - drag.px) / view.s, dy = (e.clientY - drag.py) / view.s;
      if (drag.kind === 'node') {
        const snap = (v) => Math.round(v / 8) * 8;
        model.layout.pos[drag.id] = [snap(drag.x0 + dx), snap(drag.y0 + dy)];
      } else if (drag.kind === 'actor') {
        // 参加者は横ドラッグで並び替え（元の並びから毎回計算する）。
        const steps = Math.round(dx / drag.spacing);
        const o = drag.order.slice(), f = o.indexOf(drag.id);
        o.splice(Math.max(0, Math.min(o.length - 1, f + steps)), 0, o.splice(f, 1)[0]);
        model.layout.order = o;
      } else {
        model.layout.at[drag.id] = addDays(L.base, drag.day0 + Math.round(dx / L.dayW));
        const steps = Math.round(dy / L.rowH);
        if (steps) { const o = drag.order.slice(), f = o.indexOf(drag.id); o.splice(Math.max(0, Math.min(o.length - 1, f + steps)), 0, o.splice(f, 1)[0]); model.layout.order = o; }
      }
      const keep = { ...view }; canvas.innerHTML = draw(model, L = layout(model)); Object.assign(view, keep); applyView();
    } else if (pan) { view.tx = pan.tx + (e.clientX - pan.px); view.ty = pan.ty + (e.clientY - pan.py); applyView(); }
  });
  function endDrag() { if (drag) { src.value = serialize(model); highlight(); render(); pushHistory(); } drag = null; pan = null; stage.classList.remove('panning'); }
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);

  // ---- アンドゥ／リドゥ（ドラッグやスニペットで textarea を書き換えるので自前で持つ）----
  const history = { stack: [], idx: -1 };
  function pushHistory() {
    const v = src.value;
    if (history.stack[history.idx] === v) return;
    history.stack = history.stack.slice(0, history.idx + 1);
    history.stack.push(v);
    if (history.stack.length > 200) history.stack.shift();
    history.idx = history.stack.length - 1;
  }
  function timeTravel(d) {
    const to = history.idx + d;
    if (to < 0 || to >= history.stack.length) return;
    history.idx = to; src.value = history.stack[to];
    highlight(); render(); hideAc();
  }

  // ---- 入力（編集 → 図）----
  let t; src.addEventListener('input', () => { highlight(); clearTimeout(t); t = setTimeout(() => { render(); pushHistory(); }, 140); autocomplete(); });
  src.addEventListener('scroll', syncScroll);
  src.addEventListener('keydown', onKey);

  // ---- オートコンプリート ----
  let acItems = [], acSel = 0, acWord = '';
  function wordBefore() { const p = src.selectionStart, left = src.value.slice(0, p); const m = /[A-Za-z0-9_]+$/.exec(left); return { word: m ? m[0] : '', start: m ? p - m[0].length : p, line: left.split('\n').pop() }; }
  function suggestions(ctx) {
    const kw = model.kind === 'gantt'
      ? ['title', 'dateFormat', 'section', 'done', 'active', 'crit', 'milestone', 'after']
      : model.kind === 'sequence'
        ? ['participant', 'autonumber', 'Note', 'loop', 'alt', 'opt', 'else', 'end', 'activate']
        : ['flowchart', 'graph', 'subgraph', 'end', 'direction'];
    const ids = model.items.map((n) => n.id);
    const pool = [];
    if (/after\s+[\w\s]*$/.test(ctx.line) && model.kind === 'gantt') for (const id of ids) pool.push({ k: id, d: 'task' });
    else if (/(-->|---|-\.->|==>)\s*\w*$/.test(ctx.line)) for (const id of ids) pool.push({ k: id, d: 'node' });
    else { for (const k of kw) pool.push({ k, d: 'keyword' }); for (const id of ids) pool.push({ k: id, d: 'id' }); }
    const w = ctx.word.toLowerCase();
    return pool.filter((o) => w ? o.k.toLowerCase().startsWith(w) && o.k.toLowerCase() !== w : true).slice(0, 8);
  }
  function autocomplete() {
    const ctx = wordBefore(); acWord = ctx.word;
    if (ctx.word.length < 1 && !/(after\s+|-->\s*|---\s*)$/.test(ctx.line)) return hideAc();
    acItems = suggestions(ctx); acSel = 0;
    if (!acItems.length) return hideAc();
    ac.innerHTML = acItems.map((o, i) => `<div class="opt${i === 0 ? ' sel' : ''}" data-i="${i}"><span class="k">${escHtml(o.k)}</span><span class="d">${o.d}</span></div>`).join('');
    placeAc(); ac.hidden = false;
  }
  function placeAc() {
    const cr = src.getBoundingClientRect(), lh = 20, padL = 12, padT = 12;
    const left = src.value.slice(0, src.selectionStart); const lines = left.split('\n');
    const col = lines[lines.length - 1].length, row = lines.length - 1;
    const cw = 7.8;
    ac.style.left = Math.min(cr.left + padL + col * cw - src.scrollLeft, cr.right - 180) + 'px';
    ac.style.top = (cr.top + padT + (row + 1) * lh - src.scrollTop + 4) + 'px';
  }
  function hideAc() { ac.hidden = true; acItems = []; }
  function acceptAc() {
    const o = acItems[acSel]; if (!o) return;
    const ctx = wordBefore(); const p = src.selectionStart;
    src.value = src.value.slice(0, ctx.start) + o.k + src.value.slice(p);
    const np = ctx.start + o.k.length; src.selectionStart = src.selectionEnd = np;
    hideAc(); highlight(); render();
  }
  ac.addEventListener('pointerdown', (e) => { const opt = e.target.closest('.opt'); if (opt) { acSel = +opt.dataset.i; acceptAc(); e.preventDefault(); } });
  function onKey(e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'z') { e.preventDefault(); timeTravel(e.shiftKey ? 1 : -1); return; }
      if (k === 'y') { e.preventDefault(); timeTravel(1); return; }
    }
    if (!ac.hidden && acItems.length) {
      if (e.key === 'ArrowDown') { acSel = (acSel + 1) % acItems.length; drawAc(); e.preventDefault(); return; }
      if (e.key === 'ArrowUp') { acSel = (acSel - 1 + acItems.length) % acItems.length; drawAc(); e.preventDefault(); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { acceptAc(); e.preventDefault(); return; }
      if (e.key === 'Escape') { hideAc(); return; }
    }
    if (e.key === 'Tab') { e.preventDefault(); const p = src.selectionStart; src.value = src.value.slice(0, p) + '  ' + src.value.slice(src.selectionEnd); src.selectionStart = src.selectionEnd = p + 2; highlight(); }
  }
  function drawAc() { for (const el of ac.children) el.classList.toggle('sel', +el.dataset.i === acSel); }

  // ---- 挿入（スニペット）----
  function refreshIns() {
    const ins = $('insbar');
    const snips = model.kind === 'gantt'
      ? [['＋タスク', '\n      新しいタスク :t{N}, after {last}, 3d'], ['＋セクション', '\n    section 新しい区分'], ['＋マイルストン', '\n      節目 :milestone, m{N}, after {last}, 0d']]
      : model.kind === 'sequence'
        ? [['＋参加者', '\n    participant p{N} as 新しい人'], ['＋メッセージ', '\n    {last}->>p{N}: メッセージ'], ['＋ノート', '\n    Note over {last}: メモ'], ['＋ループ', '\n    loop 条件\n    end']]
        : [['＋ノード', '\n    n{N}[新しいノード]'], ['＋エッジ', '\n    {last} --> n{N}'], ['＋グループ', '\n    subgraph 新グループ\n    end']];
    ins.innerHTML = snips.map((s, i) => `<button data-i="${i}">${s[0]}</button>`).join('');
    for (const b of ins.children) b.onclick = () => insert(snips[+b.dataset.i][1]);
  }
  function insert(tpl) {
    const n = model.items.length + 1, last = model.items.length ? model.items[model.items.length - 1].id : 'x';
    const text = tpl.replace(/\{N\}/g, n).replace(/\{last\}/g, last);
    const end = src.value.replace(/\n+$/, '').length;
    src.value = src.value.slice(0, end) + text + src.value.slice(end);
    highlight(); render(); pushHistory();
  }

  // ---- サンプル ----
  const sel = $('samples');
  sel.innerHTML = Object.keys(SAMPLES).map((k) => `<option>${k}</option>`).join('');
  sel.onchange = () => setText(SAMPLES[sel.value], true);

  // ---- エクスポート ----
  const menu = $('exportMenu');
  $('bExport').onclick = () => { menu.hidden = !menu.hidden; };
  document.addEventListener('click', (e) => { if (!e.target.closest('.menu')) menu.hidden = true; });
  function download(name, text, type = 'text/plain') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); URL.revokeObjectURL(a.href); }
  function strip(s) { return s.split('\n').filter((l) => !/^\s*import\b/.test(l)).map((l) => l.replace(/^\s*export\s+(function|const|class|let)\b/, '$1')).join('\n'); }
  async function standalone(source) {
    if (window.__STUDIO_HTML__) return window.__STUDIO_HTML__(source);   // 単一HTML自身が持つ場合
    const base = new URL('.', location.href);
    const [page, css, ...mods] = await Promise.all([
      fetch(new URL('index.html', base)).then((r) => r.text()),
      fetch(new URL('ui/editor.css', base)).then((r) => r.text()),
      ...MODULES.map((m) => fetch(new URL(m, base)).then((r) => r.text())),
    ]);
    const bundle = mods.map(strip).join('\n');
    return page.replace(/<link rel="stylesheet"[^>]*>/, `<style>\n${css}\n</style>`)
      .replace(/<script type="module">[\s\S]*?<\/script>/, `<script>\nwindow.STUDIO_SOURCE=${JSON.stringify(source)};\n${bundle}\nboot();\n<\/script>`);
  }
  const slug = (s) => (s || 'diagram').toLowerCase().replace(/[^\w぀-ヿ一-龯]+/g, '-').replace(/^-|-$/g, '') || 'diagram';
  menu.addEventListener('click', async (e) => {
    const x = e.target.dataset.x; if (!x) return; menu.hidden = true;
    const name = slug(model.meta.title || model.kind);
    if (x === 'dsl') { try { await navigator.clipboard.writeText(serialize(model)); toast('DSL をコピーしました'); } catch (_) { toast('コピーできませんでした'); } }
    else if (x === 'mmd') download(name + '.mmd', serialize(model), 'text/plain');
    else if (x === 'svg') { const s = canvas.querySelector('svg'); download(name + '.svg', '<?xml version="1.0"?>\n' + s.outerHTML, 'image/svg+xml'); }
    else if (x === 'png') exportPng(name);
    else if (x === 'html') { try { download(name + '.html', await standalone(serialize(model)), 'text/html'); toast('単一 HTML を保存しました'); } catch (_) { toast('HTML 化に失敗（オンラインのエディタでお試しを）'); } }
  });
  // SVG → 2 倍解像度の PNG（背景を敷いてから焼く）。
  function exportPng(name) {
    const s = canvas.querySelector('svg'); if (!s) return;
    const xml = new XMLSerializer().serializeToString(s);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const k = 2, c = document.createElement('canvas');
      c.width = Math.ceil(s.viewBox.baseVal.width * k); c.height = Math.ceil(s.viewBox.baseVal.height * k);
      const g = c.getContext('2d');
      g.fillStyle = '#0b0e14'; g.fillRect(0, 0, c.width, c.height);
      g.scale(k, k); g.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      c.toBlob((b) => {
        if (!b) { toast('PNG 化に失敗しました'); return; }
        const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name + '.png'; a.click();
        URL.revokeObjectURL(a.href); toast('PNG を保存しました');
      });
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('PNG 化に失敗しました'); };
    img.src = url;
  }

  // ---- トースト・モバイル ----
  function toast(m) { const t2 = $('toast'); t2.textContent = m; t2.hidden = false; requestAnimationFrame(() => t2.classList.add('on')); clearTimeout(toast._t); toast._t = setTimeout(() => t2.classList.remove('on'), 1600); }
  $('vToggle').onclick = () => document.body.classList.toggle('viewmax');
  problems.addEventListener('click', (e) => { const p = e.target.closest('.p'); if (!p || !p.dataset.ln) return; const ln = +p.dataset.ln; const pos = src.value.split('\n').slice(0, ln - 1).join('\n').length + (ln > 1 ? 1 : 0); src.focus(); src.selectionStart = src.selectionEnd = pos; });
  window.addEventListener('resize', () => { if (L) applyView(); });

  // ---- 起動 ----
  function setText(text, doFit) { src.value = text; highlight(); render(); if (doFit) fit(); hideAc(); pushHistory(); }
  const initial = window.STUDIO_SOURCE || SAMPLES[Object.keys(SAMPLES)[0]];
  setText(initial, true);
}

// 単一 HTML 版（build.js が SOURCE を注入）でも同じ boot で動く。
if (typeof window !== 'undefined' && window.STUDIO_AUTOBOOT) boot();
