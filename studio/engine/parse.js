/* ============================================================
   studio DSL のパーサ — Mermaid 記法を読む。
   みんなと AI が既に知っている書き方に寄せる：`gantt`・`flowchart`・`sequenceDiagram`。
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
   sequenceDiagram:
     sequenceDiagram
       participant u as 利用者
       u->>w: ログイン要求
       w-->>u: ようこそ
       Note over u,w: 3回失敗でロック
       loop 毎分
         u->>w: ping
       end
   トレイラ（Mermaid から見ればただのコメント）:
     %% @layout
     %% pos A 40 80          flowchart：ノード座標
     %% order req design …   gantt：行の並び／sequence：参加者の並び
     %% at req 2026-07-03    gantt：手で動かした開始日
     %% today 2026-07-16     gantt：基準日（決定的な例のため）
   ============================================================ */
import { isDate, isDur, parseDur } from './date.js';

const TAGS = new Set(['done', 'active', 'crit', 'milestone']);

function blankModel() {
  return { kind: null, meta: {}, items: [], edges: [], groups: [], events: [],
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
    if (head === 'click') {                                   // click id href "url" — タスクにリンクを張る
      const m = /^click\s+([A-Za-z0-9_.-]+)\s+(?:href\s+)?"([^"]+)"/.exec(line);
      if (m) { const it = model.items.find((x) => x.id === m[1]); if (it) it.link = m[2]; else model.errors.push(`L${ln}: click の相手が見つからない「${m[1]}」`); }
      continue;                                                // call など未対応の形は静かに流す（Mermaid 互換）
    }
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
      // 入れ子：親（いま開いている subgraph）の番号を覚える。
      const parent = stack.length ? model.groups.indexOf(stack[stack.length - 1]) : null;
      const g = { name, ids: [], parent }; model.groups.push(g); stack.push(g); continue;
    }
    if (line === 'end') { stack.pop(); continue; }
    if (head === 'direction') { model.meta.dir = line.split(/\s+/)[1] || model.meta.dir; continue; }
    if (head === 'click') {                                   // click id "url" — ノードにリンクを張る
      const m = /^click\s+([A-Za-z0-9_.-]+)\s+(?:href\s+)?"([^"]+)"/.exec(line);
      if (m) { const n = model.items.find((x) => x.id === m[1]); if (n) n.link = m[2]; else model.errors.push(`L${ln}: click の相手が見つからない「${m[1]}」`); }
      continue;                                                // call など未対応の形は静かに流す
    }
    if (['classDef', 'class', 'style', 'linkStyle'].includes(head)) continue; // 体裁系は無視
    // ノード/エッジ行。subgraph 内なら、この行で触れたノードをそのグループに入れる。
    const touched = parseFlowLine(line, model, ln);
    if (stack.length) {
      const g = stack[stack.length - 1];
      for (const id of touched) if (!g.ids.includes(id)) g.ids.push(id);
    }
  }
  return model;
}

// id の共通形：ハイフンは内部のみ（末尾の - を線と取り違えないため）。
const SEQ_ID = '[A-Za-z0-9_.]+(?:-[A-Za-z0-9_.]+)*';

// ---- クラス図 ----------------------------------------------------------------

/* 関係の演算子を「from → to（to 側に印）」へ正規化する。
   <|-- は継承（三角が親に付く）、*-- は合成（黒菱形）、o-- は集約（白菱形）、
   --> は関連、..> は点線の依存。向きは左右どちら書きでも同じ意味に畳む。 */
const CLASS_OPS = {
  '<|--': (a, b) => ({ from: b, to: a, kind: 'inherit', dotted: false }),
  '--|>': (a, b) => ({ from: a, to: b, kind: 'inherit', dotted: false }),
  '<|..': (a, b) => ({ from: b, to: a, kind: 'inherit', dotted: true }),
  '..|>': (a, b) => ({ from: a, to: b, kind: 'inherit', dotted: true }),
  '*--': (a, b) => ({ from: b, to: a, kind: 'composition', dotted: false }),
  '--*': (a, b) => ({ from: a, to: b, kind: 'composition', dotted: false }),
  'o--': (a, b) => ({ from: b, to: a, kind: 'aggregation', dotted: false }),
  '--o': (a, b) => ({ from: a, to: b, kind: 'aggregation', dotted: false }),
  '-->': (a, b) => ({ from: a, to: b, kind: 'assoc', dotted: false }),
  '<--': (a, b) => ({ from: b, to: a, kind: 'assoc', dotted: false }),
  '..>': (a, b) => ({ from: a, to: b, kind: 'assoc', dotted: true }),
  '<..': (a, b) => ({ from: b, to: a, kind: 'assoc', dotted: true }),
  '--': (a, b) => ({ from: a, to: b, kind: 'link', dotted: false }),
  '..': (a, b) => ({ from: a, to: b, kind: 'link', dotted: true }),
};
const CLASS_REL = new RegExp(`^(${SEQ_ID})\\s*(<\\|--|<\\|\\.\\.|--\\|>|\\.\\.\\|>|\\*--|--\\*|o--|--o|-->|<--|\\.\\.>|<\\.\\.|--|\\.\\.)\\s*(${SEQ_ID})\\s*(?::\\s*(.*))?$`);

function parseClass(lines, model) {
  model.kind = 'class';
  const ensure = (id) => {
    let c = model.items.find((n) => n.id === id);
    if (!c) { c = { type: 'class', id, attrs: [], methods: [] }; model.items.push(c); model.order.push(id); }
    return c;
  };
  const addMember = (c, raw) => { (raw.includes('(') ? c.methods : c.attrs).push(raw.trim()); };
  let inBlock = null;
  for (const { raw, ln } of lines) {
    const line = raw.trim();
    if (!line || line === 'classDiagram') continue;
    if (inBlock) {
      if (line === '}') { inBlock = null; continue; }
      addMember(inBlock, line.replace(/[,;]$/, ''));
      continue;
    }
    const head = line.split(/\s+/)[0];
    if (head === 'class') {
      const m = /^class\s+([A-Za-z0-9_.-]+)\s*(\{)?\s*$/.exec(line);
      if (m) { const c = ensure(m[1]); if (m[2]) inBlock = c; }
      else model.errors.push(`L${ln}: class が読めない「${line}」`);
      continue;
    }
    if (head === 'direction' || head === 'note') continue;   // 体裁系は無視
    let m = CLASS_REL.exec(line);
    if (m && CLASS_OPS[m[2]]) {
      ensure(m[1]); ensure(m[3]);
      model.edges.push({ ...CLASS_OPS[m[2]](m[1], m[3]), label: (m[4] ?? '').trim() });
      continue;
    }
    m = new RegExp(`^(${SEQ_ID})\\s*:\\s*(.+)$`).exec(line);  // A : +int age（一行メンバ）
    if (m) { addMember(ensure(m[1]), m[2]); continue; }
    model.errors.push(`L${ln}: 読めない行「${line}」`);
  }
  if (inBlock) model.errors.push('閉じていない class ブロック（} が足りない）');
  return model;
}

// ---- シーケンス図 -----------------------------------------------------------

// メッセージ：A->>B: text ／ 線は - 実線・-- 点線、先は >>(矢) >(なし) x(バツ) )(非同期)。
const SEQ_MSG = new RegExp(`^(${SEQ_ID})\\s*(--?)(>>|>|x|\\))\\s*(${SEQ_ID})\\s*(?::\\s*(.*))?$`);
const FRAMES = new Set(['loop', 'opt', 'alt', 'par', 'rect', 'critical', 'break']);

function parseSeq(lines, model) {
  model.kind = 'sequence';
  // 参加者：宣言で並びが決まり、宣言なしで登場した者は登場順に足される。
  const ensure = (id, label) => {
    let a = model.items.find((n) => n.id === id);
    if (!a) { a = { type: 'actor', id, label: label ?? id }; model.items.push(a); model.order.push(id); }
    else if (label != null) a.label = label;
    return a;
  };
  let depth = 0;
  for (const { raw, ln } of lines) {
    const line = raw.trim();
    if (!line || line === 'sequenceDiagram') continue;
    const head = line.split(/\s+/)[0];
    if (head === 'participant' || head === 'actor') {
      const m = /^(?:participant|actor)\s+([A-Za-z0-9_.-]+)(?:\s+as\s+(.+))?$/.exec(line);
      if (m) ensure(m[1], m[2]?.trim());
      else model.errors.push(`L${ln}: participant が読めない「${line}」`);
      continue;
    }
    if (head === 'title') { model.meta.title = line.slice(5).trim(); continue; }
    if (head === 'autonumber') { model.meta.autonumber = true; continue; }
    if (head === 'activate' || head === 'deactivate') continue;   // 活性帯は v1 では描かない
    if (FRAMES.has(head)) {
      model.events.push({ type: 'fstart', kind: head, label: line.slice(head.length).trim() });
      depth++; continue;
    }
    if (head === 'else' || head === 'and') {
      model.events.push({ type: 'fdiv', kind: head, label: line.slice(head.length).trim() }); continue;
    }
    if (line === 'end') {
      if (depth > 0) { model.events.push({ type: 'fend' }); depth--; }
      else model.errors.push(`L${ln}: 対応しない end`);
      continue;
    }
    let m = /^[Nn]ote\s+(over|left of|right of)\s+([A-Za-z0-9_.-]+(?:\s*,\s*[A-Za-z0-9_.-]+)?)\s*:\s*(.*)$/.exec(line);
    if (m) {
      const ids = m[2].split(',').map((s) => s.trim());
      for (const id of ids) ensure(id);
      model.events.push({ type: 'note', pos: m[1], ids, label: m[3].trim() });
      continue;
    }
    m = SEQ_MSG.exec(line);
    if (m) {
      ensure(m[1]); ensure(m[4]);
      model.events.push({ type: 'msg', from: m[1], to: m[4], label: (m[5] ?? '').trim(),
        dotted: m[2] === '--', arrow: m[3] !== '>', cross: m[3] === 'x', async: m[3] === ')' });
      continue;
    }
    model.errors.push(`L${ln}: 読めない行「${line}」`);
  }
  if (depth > 0) model.errors.push('閉じていない loop/alt/opt（end が足りない）');
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

  if (!body.length) { model.errors.push('図がありません（gantt / flowchart / sequenceDiagram で始めてください）'); return model; }
  const first = body[0].raw.trim();
  const headWord = first.split(/\s+/)[0];
  if (headWord === 'gantt') parseGantt(body, model);
  else if (headWord === 'flowchart' || headWord === 'graph') parseFlow(body, model, first.split(/\s+/)[1]);
  else if (headWord === 'sequenceDiagram') parseSeq(body, model);
  else if (headWord === 'classDiagram') parseClass(body, model);
  else model.errors.push(`先頭が gantt / flowchart / sequenceDiagram / classDiagram ではありません「${headWord}」`);
  return model;
}
