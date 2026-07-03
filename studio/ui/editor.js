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
import { csvToMermaid, universal } from '../engine/import.js';
import { toDrawio } from '../engine/drawio.js';
import { diffModels } from '../engine/diff.js';

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
  'クラス — ドメインモデル': `classDiagram
    class Animal {
      +String name
      +int age
      +speak() string
    }
    class Dog {
      +fetch() void
    }
    class Cat
    class Owner {
      +String name
      +feed(a) void
    }
    Animal <|-- Dog
    Animal <|-- Cat
    Owner --> Animal : 飼う
    Dog ..> Owner : なつく`,
};

const MODULES = ['engine/date.js', 'engine/parse.js', 'engine/layout.js', 'engine/serialize.js', 'engine/import.js', 'engine/drawio.js', 'engine/diff.js', 'render/draw.js', 'ui/editor.js'];

// ---- 構文ハイライト --------------------------------------------------------
const HL = /(<\|--|--\|>|<\|\.\.|\.\.\|>|\*--|--\*|o--|--o|\.\.>|<\.\.|<--|-->>|->>|-->|---|-\.->|-\.-|==>|===|--o|--x|-x|--\)|-\))|(\|[^|]*\|)|\b(gantt|flowchart|graph|sequenceDiagram|classDiagram|class|participant|actor|autonumber|Note|note|over|title|dateFormat|axisFormat|section|subgraph|end|direction|after|loop|alt|opt|par|else)\b|\b(done|active|crit|milestone)\b|(\d{4}[-/]\d{1,2}[-/]\d{1,2})|\b(\d+(?:\.\d+)?[dwh])\b/g;
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

  const drawOpts = () => ({ selected, sketch: model.meta.style === 'sketch' });
  function render() {
    model = parse(src.value);
    L = layout(model);
    for (const id of [...selected]) if (!model.items.some((x) => x.id === id)) selected.delete(id);
    canvas.innerHTML = draw(model, L, drawOpts());
    refreshDiff();
    syncAlignBar();
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
  function zoomTo(cx, cy, ns) {
    const r = stage.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
    ns = Math.max(0.15, Math.min(4, ns));
    view.tx = x - (x - view.tx) * (ns / view.s); view.ty = y - (y - view.ty) * (ns / view.s); view.s = ns; applyView();
  }
  const zoomAt = (cx, cy, factor) => zoomTo(cx, cy, view.s * factor);
  stage.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
  $('zIn').onclick = () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2); };
  $('zOut').onclick = () => { const r = stage.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2); };
  $('zFit').onclick = fit;

  // ---- ポインタ（選択・ドラッグ・接続・パン・ピンチ・ダブルタップ）----
  const selected = new Set();
  let drag = null, pan = null, connect = null, pinch = null;
  const pointers = new Map();
  let lastTap = { t: 0, x: 0, y: 0 };

  function toWorld(cx, cy) {
    const r = stage.getBoundingClientRect();
    return [(cx - r.left - view.tx) / view.s, (cy - r.top - view.ty) / view.s];
  }
  const capture = (e) => { try { stage.setPointerCapture(e.pointerId); } catch (_) { /* 合成イベントは掴めなくてよい */ } };
  function redraw() {
    const keep = { ...view };
    canvas.innerHTML = draw(model, L = layout(model), drawOpts());
    refreshDiff();
    Object.assign(view, keep); applyView();
  }
  // ポトペタで意味部を書き換えたら、DSL に反映して履歴へ。
  function commitModel() { src.value = serialize(model); highlight(); render(); pushHistory(); }

  function tempLine(x1, y1, x2, y2) {
    const svg = canvas.querySelector('svg'); if (!svg) return;
    let l = svg.querySelector('#tmpedge');
    if (!l) {
      l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); l.id = 'tmpedge';
      l.setAttribute('stroke', '#6aa9ff'); l.setAttribute('stroke-width', '2'); l.setAttribute('stroke-dasharray', '5 4');
      l.setAttribute('pointer-events', 'none');              // 落とし先の判定を邪魔しない
      svg.appendChild(l);
    }
    l.setAttribute('x1', x1); l.setAttribute('y1', y1); l.setAttribute('x2', x2); l.setAttribute('y2', y2);
  }
  const removeTempLine = () => canvas.querySelector('#tmpedge')?.remove();

  stage.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {                               // 二本指＝ピンチ。進行中の操作は畳む。
      drag = null; pan = null; connect = null; removeTempLine(); stage.classList.remove('panning');
      const [a, b] = [...pointers.values()];
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: view.s };
      capture(e); e.preventDefault(); return;
    }
    if (e.target.closest('[data-linkbtn]')) return;          // リンクは click に任せる（開くだけ）
    const now = performance.now();
    const isDouble = now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 24;
    lastTap = { t: now, x: e.clientX, y: e.clientY };
    if (isDouble) { lastTap.t = 0; e.preventDefault(); onDoubleTap(e); return; }

    const c = e.target.closest('[data-connect]');
    if (c) { connect = { from: c.dataset.id }; capture(e); e.preventDefault(); return; }
    const g = e.target.closest('[data-drag]');
    if (g) {
      const id = g.dataset.id, kind = g.dataset.drag;
      if (kind === 'node') {
        const ids = (selected.has(id) && selected.size > 1) ? [...selected] : [id];
        const starts = new Map(ids.map((i2) => { const n = L.nodes.find((x) => x.id === i2); return [i2, [n.x, n.y]]; }));
        drag = { id, kind, ids, starts, px: e.clientX, py: e.clientY, moved: false, shift: e.shiftKey };
      }
      else if (kind === 'actor') {
        const as = L.actors, spacing = as.length > 1 ? (as[as.length - 1].cx - as[0].cx) / (as.length - 1) : 100;
        drag = { id, kind, order: as.map((a) => a.id), spacing, px: e.clientX, py: e.clientY, moved: false };
      }
      else { const b = L.bars.find((x) => x.id === id); drag = { id, kind, day0: b.startDay, order: L.bars.map((x) => x.id), px: e.clientX, py: e.clientY, moved: false }; }
    } else { pan = { tx: view.tx, ty: view.ty, px: e.clientX, py: e.clientY, moved: false }; stage.classList.add('panning'); }
    capture(e); e.preventDefault();
  });

  stage.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) {
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        zoomTo((a.x + b.x) / 2, (a.y + b.y) / 2, pinch.s0 * (Math.hypot(a.x - b.x, a.y - b.y) || 1) / pinch.d0);
      }
      return;
    }
    if (connect) {
      const n = L.nodes.find((x) => x.id === connect.from); if (!n) return;
      const [wx, wy] = toWorld(e.clientX, e.clientY);
      tempLine(n.x + n.w + 14, n.y + n.h / 2, wx, wy);
      return;
    }
    if (drag) {
      const dxp = e.clientX - drag.px, dyp = e.clientY - drag.py;
      if (!drag.moved && Math.abs(dxp) + Math.abs(dyp) < 5) return;   // 数ピクセルはクリック扱い
      drag.moved = true;
      const dx = dxp / view.s, dy = dyp / view.s;
      if (drag.kind === 'node') {
        const snap = (v) => Math.round(v / 8) * 8;
        for (const [i2, [x0, y0]] of drag.starts) model.layout.pos[i2] = [snap(x0 + dx), snap(y0 + dy)];
      } else if (drag.kind === 'actor') {
        const steps = Math.round(dx / drag.spacing);
        const o = drag.order.slice(), f = o.indexOf(drag.id);
        o.splice(Math.max(0, Math.min(o.length - 1, f + steps)), 0, o.splice(f, 1)[0]);
        model.layout.order = o;
      } else {
        model.layout.at[drag.id] = addDays(L.base, drag.day0 + Math.round(dx / L.dayW));
        const steps = Math.round(dy / L.rowH);
        if (steps) { const o = drag.order.slice(), f = o.indexOf(drag.id); o.splice(Math.max(0, Math.min(o.length - 1, f + steps)), 0, o.splice(f, 1)[0]); model.layout.order = o; }
      }
      redraw();
    } else if (pan) {
      if (Math.abs(e.clientX - pan.px) + Math.abs(e.clientY - pan.py) > 3) pan.moved = true;
      view.tx = pan.tx + (e.clientX - pan.px); view.ty = pan.ty + (e.clientY - pan.py); applyView();
    }
  });

  function endPointer(e) {
    if (e) pointers.delete(e.pointerId);
    if (pinch) { if (pointers.size < 2) pinch = null; return; }
    if (connect) {
      const el = e && document.elementFromPoint(e.clientX, e.clientY);
      const tgt = el && el.closest && el.closest('[data-drag="node"]');
      removeTempLine();
      if (tgt && tgt.dataset.id !== connect.from) {
        if (model.edges.some((x) => x.from === connect.from && x.to === tgt.dataset.id)) toast('もうつながっています');
        else {
          if (model.kind === 'class') model.edges.push({ from: connect.from, to: tgt.dataset.id, kind: 'assoc', dotted: false, label: '' });
          else model.edges.push({ from: connect.from, to: tgt.dataset.id, label: '', dotted: false, thick: false, arrow: true });
          selected.clear(); commitModel(); toast('つなぎました'); return;
        }
      }
      connect = null; selected.clear(); redraw(); syncAlignBar(); return;
    }
    if (drag) {
      if (drag.moved) { src.value = serialize(model); highlight(); render(); pushHistory(); }
      else if (drag.kind === 'node') {                                       // クリック＝選択（Shift で追加/除外）
        if (drag.shift) { selected.has(drag.id) ? selected.delete(drag.id) : selected.add(drag.id); }
        else if (selected.size === 1 && selected.has(drag.id)) selected.clear();
        else { selected.clear(); selected.add(drag.id); }
        redraw(); syncAlignBar();
      }
    } else if (pan && !pan.moved && selected.size) { selected.clear(); redraw(); syncAlignBar(); }       // 空クリック＝選択解除
    drag = null; pan = null; connect = null; stage.classList.remove('panning');
  }
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);

  // ---- ハイパーリンク（↗ バッジ）----
  canvas.addEventListener('click', (e) => {
    const lb = e.target.closest('[data-linkbtn]');
    if (lb) { e.preventDefault(); window.open(lb.dataset.url, '_blank', 'noopener'); }
  });

  // ---- ポトペタ：ダブルタップでリネーム／追加 ----
  function onDoubleTap(e) {
    const eg = e.target.closest('[data-edit]');
    if (eg && eg.dataset.edit === 'edge') { startRename('edge', +eg.dataset.i, eg); return; }
    const g = e.target.closest('[data-drag]');
    if (g) { startRename(g.dataset.drag, g.dataset.id, g); return; }
    const [wx, wy] = toWorld(e.clientX, e.clientY);
    if (model.kind === 'flowchart') {                        // 空きに、新しいノードをその場へ
      let k = 1; while (model.items.some((n) => n.id === 'n' + k)) k++;
      const id = 'n' + k;
      model.items.push({ type: 'node', id, label: '新しいノード', shape: 'rect' });
      model.order.push(id);
      model.layout.pos[id] = [Math.round(wx / 8) * 8, Math.round(wy / 8) * 8];
      selected.clear(); selected.add(id); commitModel();
    } else if (model.kind === 'class') {
      let k = 1; while (model.items.some((n) => n.id === 'C' + k)) k++;
      const id = 'C' + k;
      model.items.push({ type: 'class', id, attrs: [], methods: [] });
      model.order.push(id);
      model.layout.pos[id] = [Math.round(wx / 8) * 8, Math.round(wy / 8) * 8];
      selected.clear(); selected.add(id); commitModel();
    } else if (model.kind === 'sequence') insert('\n    participant p{N} as 新しい人');
    else if (model.kind === 'gantt') insert('\n      新しいタスク :t{N}, after {last}, 3d');
  }

  const inline = $('inline');
  let renameCtx = null;
  function startRename(kind, ref, el) {
    const r = el.getBoundingClientRect();
    let value = kind === 'edge' ? (model.edges[ref]?.label ?? '')
      : (model.items.find((x) => x.id === ref)?.label ?? '');
    renameCtx = { kind, ref };
    inline.value = value;
    inline.style.left = Math.min(Math.max(6, r.left), window.innerWidth - 190) + 'px';
    inline.style.top = Math.max(6, r.top + r.height / 2 - 15) + 'px';
    inline.style.width = Math.max(130, Math.min(280, r.width + 40)) + 'px';
    inline.hidden = false; inline.focus(); inline.select();
  }
  function commitRename(ok) {
    if (!renameCtx) return;
    const { kind, ref } = renameCtx; renameCtx = null; inline.hidden = true;
    if (!ok) return;
    const v = inline.value.trim();
    if (kind === 'edge') { if (model.edges[ref] != null) model.edges[ref].label = v; }
    else if (model.kind === 'class') {                        // クラスは名前＝id なので、参照ごと改名する
      const nid = v.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '');
      const it = model.items.find((x) => x.id === ref);
      if (!it || !nid) return;
      if (nid !== ref && model.items.some((x) => x.id === nid)) { toast('その名前は使われています'); return; }
      it.id = nid;
      model.order = model.order.map((x) => (x === ref ? nid : x));
      for (const e2 of model.edges) { if (e2.from === ref) e2.from = nid; if (e2.to === ref) e2.to = nid; }
      if (model.layout.pos[ref]) { model.layout.pos[nid] = model.layout.pos[ref]; delete model.layout.pos[ref]; }
    }
    else { const it = model.items.find((x) => x.id === ref); if (it && v) it.label = v; else return; }
    commitModel();
  }
  inline.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitRename(true); }
    else if (e.key === 'Escape') commitRename(false);
    e.stopPropagation();
  });
  inline.addEventListener('blur', () => commitRename(true));

  // ---- 整列（2 個以上選ぶと出る）----
  function syncAlignBar() {
    const bar = $('alignbar'); if (!bar) return;
    bar.hidden = !(selected.size >= 2 && (model.kind === 'flowchart' || model.kind === 'class'));
  }
  $('alignbar').addEventListener('click', (e) => {
    const a = e.target.dataset.a; if (!a) return;
    const ns = [...selected].map((id) => L.nodes.find((n) => n.id === id)).filter(Boolean);
    if (ns.length < 2) return;
    if (a === 'left') { const x0 = Math.min(...ns.map((n) => n.x)); for (const n of ns) model.layout.pos[n.id] = [x0, n.y]; }
    else if (a === 'top') { const y0 = Math.min(...ns.map((n) => n.y)); for (const n of ns) model.layout.pos[n.id] = [n.x, y0]; }
    else if (a === 'hspread') {
      const so = [...ns].sort((p, q) => p.x - q.x);
      const step = (so[so.length - 1].x - so[0].x) / (so.length - 1);
      so.forEach((n, i) => { model.layout.pos[n.id] = [Math.round(so[0].x + i * step), n.y]; });
    } else if (a === 'vspread') {
      const so = [...ns].sort((p, q) => p.y - q.y);
      const step = (so[so.length - 1].y - so[0].y) / (so.length - 1);
      so.forEach((n, i) => { model.layout.pos[n.id] = [n.x, Math.round(so[0].y + i * step)]; });
    }
    commitModel(); toast('そろえました');
  });

  // ---- アンドゥ／リドゥ（ドラッグやスニペットで textarea を書き換えるので自前で持つ）----
  const history = { stack: [], idx: -1 };
  function pushHistory() {
    const v = src.value;
    if (history.stack[history.idx] === v) return;
    history.stack = history.stack.slice(0, history.idx + 1);
    history.stack.push(v);
    if (history.stack.length > 200) history.stack.shift();
    history.idx = history.stack.length - 1;
    if (typeof syncTT === 'function') syncTT();              // タイムトラベルのスライダも追随
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
        : model.kind === 'class'
          ? ['classDiagram', 'class']
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
  function snipsFor() {
    return model.kind === 'gantt'
      ? [['＋タスク', '\n      新しいタスク :t{N}, after {last}, 3d'], ['＋セクション', '\n    section 新しい区分'], ['＋マイルストン', '\n      節目 :milestone, m{N}, after {last}, 0d']]
      : model.kind === 'sequence'
        ? [['＋参加者', '\n    participant p{N} as 新しい人'], ['＋メッセージ', '\n    {last}->>p{N}: メッセージ'], ['＋ノート', '\n    Note over {last}: メモ'], ['＋ループ', '\n    loop 条件\n    end']]
        : model.kind === 'class'
          ? [['＋クラス', '\n    class C{N} {\n      +field\n    }'], ['＋継承', '\n    {last} <|-- C{N}'], ['＋関連', '\n    {last} --> C{N}']]
          : [['＋ノード', '\n    n{N}[新しいノード]'], ['＋エッジ', '\n    {last} --> n{N}'], ['＋グループ', '\n    subgraph 新グループ\n    end']];
  }
  function refreshIns() {
    const ins = $('insbar');
    const snips = snipsFor();
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
    // 置換は関数で（文字列だと $` などが特殊パターン展開されてコードが壊れる）。
    return page.replace(/<link rel="stylesheet"[^>]*>/, () => `<style>\n${css}\n</style>`)
      .replace(/<script type="module">[\s\S]*?<\/script>/, () => `<script>\nwindow.STUDIO_SOURCE=${JSON.stringify(source)};\n${bundle}\nboot();\n<\/script>`);
  }
  const slug = (s) => (s || 'diagram').toLowerCase().replace(/[^\w぀-ヿ一-龯]+/g, '-').replace(/^-|-$/g, '') || 'diagram';
  menu.addEventListener('click', (e) => {
    const x = e.target.dataset.x; if (!x) return; menu.hidden = true;
    doExport(x);
  });
  // パレットからも呼べるよう、エクスポートは一つの関数に。
  async function doExport(x) {
    const name = slug(model.meta.title || model.kind);
    if (x === 'dsl') { try { await navigator.clipboard.writeText(serialize(model)); toast('DSL をコピーしました'); } catch (_) { toast('コピーできませんでした'); } }
    else if (x === 'mmd') download(name + '.mmd', serialize(model), 'text/plain');
    else if (x === 'svg') { const s = canvas.querySelector('svg'); download(name + '.svg', '<?xml version="1.0"?>\n' + s.outerHTML, 'image/svg+xml'); }
    else if (x === 'png') exportPng(name);
    else if (x === 'drawio') { download(name + '.drawio', toDrawio(model, L), 'application/xml'); toast('.drawio を保存しました（draw.io で開けます）'); }
    else if (x === 'copydrawio') { try { await navigator.clipboard.writeText(toDrawio(model, L)); toast('draw.io XML をコピーしました（draw.io に貼り付け）'); } catch (_) { toast('コピーできませんでした'); } }
    else if (x === 'copysvg') copySvg();
    else if (x === 'copypng') copyPng();
    else if (x === 'html') { try { download(name + '.html', await standalone(serialize(model)), 'text/html'); toast('単一 HTML を保存しました'); } catch (_) { toast('HTML 化に失敗（オンラインのエディタでお試しを）'); } }
  }
  // SVG をクリップボードへ：PowerPoint に貼って「図形に変換」すればオートシェイプになる。
  async function copySvg() {
    const el = canvas.querySelector('svg'); if (!el) return;
    const xml = '<?xml version="1.0"?>\n' + new XMLSerializer().serializeToString(el);
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'image/svg+xml': new Blob([xml], { type: 'image/svg+xml' }),
        'text/plain': new Blob([xml], { type: 'text/plain' }),
      })]);
      toast('SVG をコピーしました（PowerPoint で図形に変換できます）');
    } catch (_) {
      try { await navigator.clipboard.writeText(xml); toast('SVG をテキストとしてコピーしました'); }
      catch (_2) { toast('コピーできませんでした'); }
    }
  }
  // PNG をクリップボードへ（そのまま貼れる画像）。
  function copyPng() {
    const el = canvas.querySelector('svg'); if (!el) return;
    const xml = new XMLSerializer().serializeToString(el);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const k = 2, c = document.createElement('canvas');
      c.width = Math.ceil(el.viewBox.baseVal.width * k); c.height = Math.ceil(el.viewBox.baseVal.height * k);
      const g = c.getContext('2d'); g.fillStyle = '#0b0e14'; g.fillRect(0, 0, c.width, c.height);
      g.scale(k, k); g.drawImage(img, 0, 0); URL.revokeObjectURL(url);
      c.toBlob(async (b) => {
        if (!b) { toast('PNG 化に失敗しました'); return; }
        try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); toast('PNG をコピーしました'); }
        catch (_) { toast('コピーできませんでした'); }
      });
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('PNG 化に失敗しました'); };
    img.src = url;
  }

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

  // ---- 取り込み（CSV / TSV を貼る・選ぶ・ドロップする）----
  const dlg = $('importDlg');
  // 万能ペースト：Mermaid・表・矢印テキスト・箇条書き・JSON を判別して図にする。
  const KIND_JA = { mermaid: 'Mermaid', table: '表', arrows: '矢印テキスト', outline: '箇条書き', json: 'JSON' };
  function runImport(text) {
    const t = String(text || '').trim();
    if (!t) return;
    const r = universal(t);
    if (r.kind === 'unknown') { toast('⚠ ' + (r.error || '読める形がありません（表・箇条書き・A -> B・JSON・Mermaid）')); return; }
    setText(r.text, true); dlg.hidden = true;
    toast(`${KIND_JA[r.kind]}${r.kind === 'mermaid' ? 'を読み込みました' : 'から図にしました'}${r.truncated ? '（大きいので一部だけ）' : ''}`);
  }
  $('bImport').onclick = () => { dlg.hidden = false; $('csvIn').focus(); };
  $('csvCancel').onclick = () => { dlg.hidden = true; };
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.hidden = true; });
  $('csvGo').onclick = () => runImport($('csvIn').value);
  $('csvPick').onclick = (e) => { e.preventDefault(); $('csvFile').click(); };
  $('csvFile').onchange = async (e) => { const f = e.target.files[0]; if (f) runImport(await f.text()); e.target.value = ''; };
  // 画面のどこへでもファイルをドロップできる（.csv/.tsv/.mmd/.txt）。
  document.addEventListener('dragover', (e) => e.preventDefault());
  document.addEventListener('drop', async (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0]; if (!f) return;
    if (f.type.startsWith('image/')) embedImage(await fileToDataUrl(f), f.name.replace(/\.[^.]+$/, ''));
    else runImport(await f.text());
  });
  // 画像（スクショ）をノードに埋める：選択中ノードに貼り付け、なければ新ノードを作る。
  function embedImage(dataUrl, label) {
    if (model.kind !== 'flowchart') { toast('画像はフローチャートに埋められます'); return; }
    let id;
    if (selected.size === 1) { id = [...selected][0]; }
    else {
      let k = 1; while (model.items.some((n) => n.id === 'img' + k)) k++;
      id = 'img' + k;
      model.items.push({ type: 'node', id, label: label || 'スクショ', shape: 'rect' });
      model.order.push(id);
      const r = stage.getBoundingClientRect();
      const [wx, wy] = toWorld(r.left + r.width / 2, r.top + r.height / 2);
      model.layout.pos[id] = [Math.round(wx / 8) * 8, Math.round(wy / 8) * 8];
    }
    model.images[id] = dataUrl;
    selected.clear(); selected.add(id);
    commitModel(); toast('画像を埋めました');
  }
  const fileToDataUrl = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });

  // エディタの外に Ctrl+V：画像はノードへ、表（Excel の TSV そのまま）や Mermaid は図に。
  document.addEventListener('paste', async (e) => {
    const t = e.target;
    if (t === src || t === inline || t.tagName === 'TEXTAREA' || t.tagName === 'INPUT') return;
    const items = [...(e.clipboardData?.items || [])];
    const imgItem = items.find((it) => it.type.startsWith('image/'));
    if (imgItem) { e.preventDefault(); embedImage(await fileToDataUrl(imgItem.getAsFile())); return; }
    const text = e.clipboardData?.getData('text/plain') || '';
    if (!text.trim()) return;
    // 構造の証拠があるものだけ拾う（ただの文章は乗っ取らない）。判別は engine/import.js。
    if (universal(text).kind !== 'unknown') { e.preventDefault(); runImport(text); }
  });

  // ---- 手描きモード（%% style sketch — 見た目もコメントで往復する）----
  function toggleSketch() {
    model.meta.style = model.meta.style === 'sketch' ? null : 'sketch';
    commitModel();
    toast(model.meta.style ? '手描きモード ✏' : '手描きを解除');
  }
  $('zSketch').onclick = toggleSketch;

  // ---- タイムトラベル：履歴をスライダでさかのぼる（見ながら戻れる undo）----
  const ttbar = $('ttbar'), ttRange = $('ttRange'), ttLabel = $('ttLabel');
  function syncTT() {
    if (ttbar.hidden) return;
    ttRange.max = Math.max(0, history.stack.length - 1);
    ttRange.value = history.idx;
    ttLabel.textContent = `${history.idx + 1} / ${history.stack.length}`;
  }
  function toggleTT() { ttbar.hidden = !ttbar.hidden; syncTT(); }
  ttRange.addEventListener('input', () => {
    const to = +ttRange.value;
    if (to === history.idx || history.stack[to] == null) return;
    history.idx = to; src.value = history.stack[to];
    highlight(); render(); hideAc();
    ttLabel.textContent = `${to + 1} / ${history.stack.length}`;
  });
  $('ttClose').onclick = toggleTT;

  // ---- 差分ビュー：旧版の Mermaid を貼ると「何が増え・消え・変わったか」を図上に ----
  // AI が返した版のレビューが目 grep でなく一目になる。比較はモデル diff（並び替えは差にしない）。
  let diffOther = null;
  function refreshDiff() {
    const bar = $('diffbar');
    if (!diffOther) { bar.hidden = true; return; }
    const res = diffModels(diffOther, model);
    if (res.kindChanged) { bar.hidden = true; diffOther = null; toast('図の種類が変わったので差分を終了'); return; }
    const chip = (cls, txt) => `<span class="chip ${cls}">${escHtml(txt)}</span>`;
    const cap = (arr) => arr.slice(0, 5);
    bar.innerHTML = `<b>差分</b>`
      + chip('add', `＋${res.added.length}`) + cap(res.added).map((x) => chip('add', x.label)).join('')
      + chip('del', `−${res.removed.length}`) + cap(res.removed).map((x) => chip('del', x.label)).join('')
      + chip('chg', `±${res.changed.length}`) + cap(res.changed).map((x) => chip('chg', x.label)).join('')
      + `<button id="diffExit">終了</button>`;
    bar.hidden = false;
    $('diffExit').onclick = () => { diffOther = null; render(); };
    for (const g of canvas.querySelectorAll('[data-drag]')) {         // 図上の色分け：追加=緑・変更=琥珀
      const id = g.dataset.id;
      const mark = res.addedIds.has(id) ? '#7ad1b0' : res.changedIds.has(id) ? '#f5b86a' : null;
      if (!mark) continue;
      for (const el of g.querySelectorAll('rect,ellipse,polygon,path'))
        { el.setAttribute('stroke', mark); el.setAttribute('stroke-width', '2.8'); }
    }
  }
  const diffDlg = $('diffDlg');
  $('diffCancel').onclick = () => { diffDlg.hidden = true; };
  diffDlg.addEventListener('click', (e) => { if (e.target === diffDlg) diffDlg.hidden = true; });
  $('diffGo').onclick = () => {
    const other = parse($('diffIn').value);
    if (!$('diffIn').value.trim() || other.errors.length) { toast('⚠ 旧版の Mermaid が読めません'); return; }
    diffOther = other; diffDlg.hidden = true; render();
  };

  // ---- コマンドパレット（Ctrl+K / ⌘K）：全部ここからできる ----
  // 打った言葉がコマンドに無ければ「その名前のノードを追加」になる——考えたらもう出来てる、が理想。
  const palette = $('palette'), pInput = $('pInput'), pList = $('pList');
  let pItems = [], pSel = 0;
  function centerPos(id) {
    const r = stage.getBoundingClientRect();
    const [wx, wy] = toWorld(r.left + r.width / 2, r.top + r.height / 2);
    model.layout.pos[id] = [Math.round(wx / 8) * 8, Math.round(wy / 8) * 8];
  }
  function addNamed(label) {
    if (!model.kind) { setText(`flowchart TD\n    n1[${label}]`, true); return; }   // 白紙からでも始まる
    if (model.kind === 'flowchart') {
      let k = 1; while (model.items.some((n) => n.id === 'n' + k)) k++;
      model.items.push({ type: 'node', id: 'n' + k, label, shape: 'rect' });
      model.order.push('n' + k); centerPos('n' + k);
      selected.clear(); selected.add('n' + k); commitModel();
    } else if (model.kind === 'class') {
      const cid = label.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '') || 'C' + (model.items.length + 1);
      if (model.items.some((x) => x.id === cid)) { toast('その名前はもうあります'); return; }
      model.items.push({ type: 'class', id: cid, attrs: [], methods: [] });
      model.order.push(cid); centerPos(cid);
      selected.clear(); selected.add(cid); commitModel();
    } else if (model.kind === 'sequence') insert(`\n    participant p{N} as ${label}`);
    else insert(`\n      ${label} :t{N}, after {last}, 3d`);
    toast(`「${label}」を足しました`);
  }
  function paletteItems(q) {
    const cmds = [];
    const noun = { gantt: 'タスク', flowchart: 'ノード', sequence: '参加者', class: 'クラス' }[model.kind] || 'ノード';
    if (q.trim()) cmds.push({ t: `＋ ${noun}「${q.trim()}」を追加`, k: 'add create 追加', pin: true, run: () => addNamed(q.trim()) });
    for (const s of snipsFor()) cmds.push({ t: `挿入：${s[0]}`, k: 'insert snippet', run: () => insert(s[1]) });
    cmds.push(
      { t: '手描きモード切替 ✏', k: 'sketch rough hand 手書き てがき', run: toggleSketch },
      { t: '差分を比べる…（旧版の Mermaid を貼る）', k: 'diff compare さぶん レビュー', run: () => { diffDlg.hidden = false; $('diffIn').focus(); } },
      { t: 'タイムトラベル（履歴スライダ）', k: 'history time undo りれき', run: toggleTT },
      { t: '取り込み（表・箇条書き・A→B・JSON）', k: 'import paste csv とりこみ', run: () => { dlg.hidden = false; $('csvIn').focus(); } },
      { t: '全体をフィット', k: 'fit zoom ふぃっと', run: fit },
      { t: 'コード ⇄ 図 切替', k: 'view code toggle', run: () => document.body.classList.toggle('viewmax') },
      { t: 'アンドゥ', k: 'undo', run: () => timeTravel(-1) },
      { t: 'リドゥ', k: 'redo', run: () => timeTravel(1) },
    );
    for (const name of Object.keys(SAMPLES)) cmds.push({ t: `サンプル：${name}`, k: 'sample さんぷる', run: () => setText(SAMPLES[name], true) });
    for (const [x, label] of [['dsl', 'DSL をコピー'], ['mmd', '.mmd を保存'], ['svg', 'SVG を保存'], ['png', 'PNG を保存'],
      ['copysvg', 'SVG をコピー（PPT 図形化用）'], ['copypng', 'PNG をコピー'], ['drawio', '.drawio を保存'],
      ['copydrawio', 'draw.io XML をコピー'], ['html', '単一 HTML を保存']])
      cmds.push({ t: `エクスポート：${label}`, k: 'export save copy ' + x, run: () => doExport(x) });
    const ql = q.trim().toLowerCase();
    // 順位：コマンド名にそのまま含まれる(3) ＞「その名前で追加」ピン(2.5) ＞ 曖昧一致(2)。
    // ピンを最上位にすると「タイムトラベル」と打った人がノードを生やしてしまう——コマンドの言葉はコマンドが勝つ。
    const score = (c) => {
      if (c.pin) return 2.5;
      if (!ql) return 1;
      const hay = (c.t + ' ' + c.k).toLowerCase();
      if (hay.includes(ql)) return 3;
      let i = 0; for (const ch of hay) { if (ch === ql[i]) i++; if (i === ql.length) return 2; }   // 部分列
      return 0;
    };
    return cmds.map((c) => ({ c, s: score(c) })).filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s).map((x) => x.c).slice(0, 12);
  }
  function drawPalette() {
    pList.innerHTML = pItems.map((c, i) => `<div class="opt${i === pSel ? ' sel' : ''}" data-i="${i}">${escHtml(c.t)}</div>`).join('')
      || '<div class="none">見つかりません</div>';
  }
  function openPalette() { palette.hidden = false; pInput.value = ''; pItems = paletteItems(''); pSel = 0; drawPalette(); pInput.focus(); }
  function closePalette() { palette.hidden = true; }
  function runPalette() { const c = pItems[pSel]; if (!c) return; closePalette(); c.run(); }
  $('bPalette').onclick = openPalette;
  pInput.addEventListener('input', () => { pItems = paletteItems(pInput.value); pSel = 0; drawPalette(); });
  pInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { pSel = (pSel + 1) % Math.max(1, pItems.length); drawPalette(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { pSel = (pSel - 1 + pItems.length) % Math.max(1, pItems.length); drawPalette(); e.preventDefault(); }
    else if (e.key === 'Enter') { runPalette(); e.preventDefault(); }
    else if (e.key === 'Escape') closePalette();
    e.stopPropagation();
  });
  pList.addEventListener('pointerdown', (e) => { const o = e.target.closest('.opt'); if (o) { pSel = +o.dataset.i; runPalette(); e.preventDefault(); } });
  palette.addEventListener('click', (e) => { if (e.target === palette) closePalette(); });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette.hidden ? openPalette() : closePalette(); }
  });

  // ---- トースト・モバイル ----
  function toast(m) { const t2 = $('toast'); t2.textContent = m; t2.hidden = false; requestAnimationFrame(() => t2.classList.add('on')); clearTimeout(toast._t); toast._t = setTimeout(() => t2.classList.remove('on'), 1600); }
  $('vToggle').onclick = () => document.body.classList.toggle('viewmax');
  // スマホでは、まず図に全画面を譲る（「コード ◧」で開ける）。
  if (window.matchMedia('(max-width: 820px)').matches) document.body.classList.add('viewmax');
  problems.addEventListener('click', (e) => { const p = e.target.closest('.p'); if (!p || !p.dataset.ln) return; const ln = +p.dataset.ln; const pos = src.value.split('\n').slice(0, ln - 1).join('\n').length + (ln > 1 ? 1 : 0); src.focus(); src.selectionStart = src.selectionEnd = pos; });
  window.addEventListener('resize', () => { if (L) applyView(); });

  // ---- 起動 ----
  function setText(text, doFit) { src.value = text; highlight(); render(); if (doFit) fit(); hideAc(); pushHistory(); }
  const initial = window.STUDIO_SOURCE || SAMPLES[Object.keys(SAMPLES)[0]];
  setText(initial, true);
}

// 単一 HTML 版（build.js が SOURCE を注入）でも同じ boot で動く。
if (typeof window !== 'undefined' && window.STUDIO_AUTOBOOT) boot();
