/* ============================================================
   studio DSL のパーサ — Mermaid 記法を読む。
   みんなと AI が既に知っている書き方に寄せる：`gantt` と `flowchart`。
   レイアウト（ドラッグした位置・並び）は Mermaid のコメント `%% @layout`
   ブロックに畳むので、本物の Mermaid でもそのまま開ける。意味部は汚れない。

   gantt:
     gantt
       title 製品リリース計画
       dateFormat YYYY-MM-DD
       section 設計
         要件定義   :done, req, 2026-07-01, 5d
         基本設計   :active, design, after req, 7d
         出荷       :milestone, ship, after design, 0d
   flowchart:
     flowchart TD
       A[Web] --> B(API)
       B -->|認証| C{OK?}
       C --> D[(DB)]
       subgraph 裏方
         C
         D
       end
   トレイラ（Mermaid から見ればただのコメント）:
     %% @layout
     %% pos A 40 80          flowchart：ノード座標
     %% order req design …   gantt：行の並び
     %% at req 2026-07-03    gantt：手で動かした開始日
     %% today 2026-07-16     gantt：基準日（決定的な例のため）
   ============================================================ */
import { isDate, isDur, parseDur } from './date.js';

const TAGS = new Set(['done', 'active', 'crit', 'milestone']);

function blankModel() {
  return { kind: null, meta: {}, items: [], edges: [], groups: [],
    order: [], layout: { pos: {}, order: [], at: {} }, errors: [] };
}

// ---- ガント ---------------------------------------------------------------

function parseGanttTask(label, spec, prevId, model, ln) {
  const fields = spec.split(',').map((s) => s.trim()).filter((s) => s.length);
  const item = { type: 'task', id: null, label, tags: [], status: null,
    after: [], at: null, dur: 1 };
  let i = 0;
  // 先頭の状態タグ（done/active/crit/milestone）を食う。
  while (i < fields.length && TAGS.has(fields[i])) {
    const t = fields[i++];
    if (t === 'milestone') item.type = 'milestone';
    else { item.tags.push(t); item.status = item.status || t; }
  }
  // 残り：[id,] start [, end]
  const rest = fields.slice(i);
  let r = 0;
  // id：先頭が日付でも after でも duration でもない識別子なら id。
  if (rest[r] && !isDate(rest[r]) && !isDur(rest[r]) && !/^after\b/.test(rest[r])) {
    item.id = rest[r++];
  }
  // start
  if (rest[r] && /^after\b/.test(rest[r])) {
    item.after = rest[r].split(/\s+/).slice(1); r++;
  } else if (rest[r] && isDate(rest[r])) {
    item.at = rest[r++];
  } else if (rest[r] == null) {
    // start 省略 → 直前のタスクの後ろ（Mermaid の暗黙）。
    if (prevId) item.after = [prevId];
  }
  // end：日付 or 期間
  if (rest[r] != null) {
    if (isDur(rest[r])) item.dur = parseDur(rest[r]);
    else if (isDate(rest[r])) item._end = rest[r];           // 終了日（layout で開始日との差に）
    else model.errors.push(`L${ln}: 終了の指定が読めない「${rest[r]}」`);
    r++;
  } else if (item.type === 'milestone') item.dur = 0;
  if (!item.id) item.id = 't' + (model.items.length + 1);     // id 省略時は採番
  return item;
}

function parseGantt(lines, model) {
  model.kind = 'gantt';
  let section = null, prevId = null;
  for (const { raw, ln } of lines) {
    const line = raw.trim();
    const sp = line.indexOf(' ');
    const head = sp < 0 ? line : line.slice(0, sp);
    const rest = sp < 0 ? '' : line.slice(sp + 1).trim();
    if (head === 'gantt') continue;
    if (head === 'title') { model.meta.title = rest; continue; }
    if (head === 'dateFormat') { model.meta.dateFormat = rest; continue; }
    if (head === 'axisFormat') { model.meta.axisFormat = rest; continue; }
    if (head === 'section') { section = rest; continue; }
    if (['excludes', 'todayMarker', 'weekday', 'tickInterval'].includes(head)) continue; // 体裁系は無視
    // タスク行：「ラベル : spec」
    const c = line.indexOf(':');
    if (c < 0) { if (line) model.errors.push(`L${ln}: タスク行に ':' がない「${line}」`); continue; }
    const item = parseGanttTask(line.slice(0, c).trim(), line.slice(c + 1).trim(), prevId, model, ln);
    item.section = section; model.items.push(item); model.order.push(item.id); prevId = item.id;
  }
  return model;
}

// ---- フローチャート --------------------------------------------------------

// 形状の括弧 → 種別とラベル。長いものから試す。
const SHAPES = [
  [/^\(\[(.*?)\]\)/, 'stadium'], [/^\[\[(.*?)\]\]/, 'subroutine'], [/^\[\((.*?)\)\]/, 'cylinder'],
  [/^\(\((.*?)\)\)/, 'circle'], [/^\{\{(.*?)\}\}/, 'hexagon'],
  [/^\[(.*?)\]/, 'rect'], [/^\((.*?)\)/, 'round'], [/^\{(.*?)\}/, 'rhombus'], [/^>(.*?)\]/, 'flag'],
];
const ID_RE = /^[A-Za-z0-9_.-]+/;

function readNode(s, model) {
  const idm = ID_RE.exec(s);
  if (!idm) return null;
  const id = idm[0];
  let rest = s.slice(id.length), label = null, shape = 'rect';
  for (const [re, kind] of SHAPES) {
    const m = re.exec(rest);
    if (m) { label = m[1]; shape = kind; rest = rest.slice(m[0].length); break; }
  }
  // ノードを登録／更新（ラベルが来たら上書き、無ければ既存 or id）。
  let node = model.items.find((n) => n.id === id);
  if (!node) { node = { type: 'node', id, label: label ?? id, shape }; model.items.push(node); model.order.push(id); }
  else if (label != null) { node.label = label; node.shape = shape; }
  return { id, rest };
}

// コネクタ：--> / --- / -.-> / ==> と、|ラベル| or -- ラベル --> 。
const CONN_RE = /^\s*(?:--\s*([^->|][^>]*?)\s*-->|(-->|---|-\.->|-\.-|==>|===|--o|--x|x--x|o--o)\s*(?:\|([^|]*)\|)?)\s*/;
function readConn(s) {
  const m = CONN_RE.exec(s);
  if (!m) return null;
  const label = (m[1] ?? m[3] ?? '').trim();
  let op = m[2] || '-->';
  const dotted = /-\./.test(op), thick = /==|===/.test(op);
  const arrow = !/^(---|-\.-|===)$/.test(op);
  return { label, dotted, thick, arrow, len: m[0].length };
}

// 1 行を解釈し、その行で触れたノード id の配列を返す（subgraph 所属の判定に使う）。
function parseFlowLine(line, model, ln) {
  let s = line;
  const first = readNode(s, model);
  if (!first) { model.errors.push(`L${ln}: ノードが読めない「${line}」`); return []; }
  s = first.rest; let prev = first.id; const touched = [first.id];
  while (s.trim().length) {
    const conn = readConn(s);
    if (!conn) { if (s.trim()) model.errors.push(`L${ln}: つながりが読めない「${s.trim()}」`); break; }
    s = s.slice(conn.len);
    const nxt = readNode(s, model);
    if (!nxt) { model.errors.push(`L${ln}: 矢印の先のノードが無い`); break; }
    s = nxt.rest;
    model.edges.push({ from: prev, to: nxt.id, label: conn.label,
      dotted: conn.dotted, thick: conn.thick, arrow: conn.arrow });
    prev = nxt.id; touched.push(nxt.id);
  }
  return touched;
}

function stripName(s) {
  s = s.trim();
  const m = /^([A-Za-z0-9_.-]+)\s*\[(.*)\]$/.exec(s);     // subgraph id [Title]
  if (m) return m[2];
  return s.replace(/^["']|["']$/g, '');
}

function parseFlow(lines, model, dir) {
  model.kind = 'flowchart';
  model.meta.dir = dir || 'TD';
  const stack = [];                                        // subgraph のネスト
  for (const { raw, ln } of lines) {
    const line = raw.trim();
    if (!line) continue;
    const head = line.split(/\s+/)[0];
    if (head === 'flowchart' || head === 'graph') continue;
    if (head === 'subgraph') {
      const name = stripName(line.slice('subgraph'.length).trim()) || ('group' + (model.groups.length + 1));
      const g = { name, ids: [] }; model.groups.push(g); stack.push(g); continue;
    }
    if (line === 'end') { stack.pop(); continue; }
    if (head === 'direction') { model.meta.dir = line.split(/\s+/)[1] || model.meta.dir; continue; }
    if (['classDef', 'class', 'style', 'click', 'linkStyle'].includes(head)) continue; // 体裁系は無視
    // ノード/エッジ行。subgraph 内なら、この行で触れたノードをそのグループに入れる。
    const touched = parseFlowLine(line, model, ln);
    if (stack.length) {
      const g = stack[stack.length - 1];
      for (const id of touched) if (!g.ids.includes(id)) g.ids.push(id);
    }
  }
  return model;
}

// ---- 入口（共通：コメントと @layout の切り出し） ---------------------------

export function parse(text) {
  const model = blankModel();
  const all = String(text).replace(/\r\n?/g, '\n').split('\n');
  const body = [];
  let inLayout = false;
  for (let i = 0; i < all.length; i++) {
    const raw = all[i], ln = i + 1, t = raw.trim();
    if (!t) continue;
    if (/^%%\{.*\}%%$/.test(t)) continue;                  // %%{init:…}%% ディレクティブは無視
    if (t === '%% @layout') { inLayout = true; continue; }
    if (t.startsWith('%%')) {
      const d = t.replace(/^%%\s*/, '').trim();
      if (inLayout || /^(pos|order|at|today)\b/.test(d) || d.startsWith('@today')) {
        const a = d.replace(/^@/, '').split(/\s+/);
        if (a[0] === 'pos' && a.length >= 4) model.layout.pos[a[1]] = [parseFloat(a[2]), parseFloat(a[3])];
        else if (a[0] === 'order') model.layout.order = a.slice(1);
        else if (a[0] === 'at' && a.length >= 3) model.layout.at[a[1]] = a[2];
        else if (a[0] === 'today' && a[1]) model.meta.today = a[1];
      }
      continue;                                            // ふつうのコメントは捨てる
    }
    body.push({ raw, ln });
  }

  if (!body.length) { model.errors.push('図がありません（gantt か flowchart で始めてください）'); return model; }
  const first = body[0].raw.trim();
  const headWord = first.split(/\s+/)[0];
  if (headWord === 'gantt') parseGantt(body, model);
  else if (headWord === 'flowchart' || headWord === 'graph') parseFlow(body, model, first.split(/\s+/)[1]);
  else model.errors.push(`先頭が gantt / flowchart ではありません「${headWord}」`);
  return model;
}
