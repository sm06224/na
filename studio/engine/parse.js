/* ============================================================
   studio DSL のパーサ — 行指向・寛容・依存ゼロ。
   設計の肝：「意味部」と「@layout トレイラ」を分ける。
     ・意味部 … 人と AI が書く。何があり、何に依存するか。
     ・@layout … エディタが書く。ドラッグした位置・順序。
   こうすると、ドラッグしても意味部は汚れず、AI の差分がきれいに保たれる。

   共通:
     kind  gantt|arch
     title  …
     <key>  <value>        # メタ（start / today など）
   ガント:
     section "名前"
     task <id> "ラベル" [at YYYY-MM-DD] [after <id…>] [for 5d] [done 60]
     milestone <id> "ラベル" [at …|after …]
   アーキ図:
     node <id> "ラベル"
     edge <id> -> <id>
     group "名前" { <id> <id> … }
   トレイラ:
     @layout
       pos <id> <x> <y>     # arch：ノードの座標
       order <id> <id> …    # gantt：行の並び
       at <id> YYYY-MM-DD    # gantt：手で動かした開始日
   ============================================================ */
import { parseDur } from './date.js';

// 空白で割りつつ "…" のラベルは 1 トークンに保つ。# 以降は注釈。
function tokenize(line) {
  const out = [];
  let i = 0, n = line.length;
  while (i < n) {
    const c = line[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '#') break;                                  // 行注釈
    if (c === '"') {
      let j = i + 1, s = '';
      while (j < n && line[j] !== '"') { s += line[j]; j++; }
      out.push({ q: true, v: s }); i = j + 1; continue;
    }
    let j = i, s = '';
    while (j < n && line[j] !== ' ' && line[j] !== '\t' && line[j] !== '#') { s += line[j]; j++; }
    out.push({ q: false, v: s }); i = j;
  }
  return out;
}

const KW = new Set(['at', 'after', 'for', 'done']);

function parseTask(type, toks, ln, errors) {
  // toks[0] は task/milestone を除いた残り。 id [label] [timing…]
  if (!toks.length) { errors.push(`L${ln}: ${type} に id がありません`); return null; }
  const id = toks[0].v;
  let k = 1, label = id;
  if (toks[k] && toks[k].q) { label = toks[k].v; k++; }
  const item = { type, id, label, after: [], dur: type === 'milestone' ? 0 : 1, done: 0, at: null };
  while (k < toks.length) {
    const t = toks[k].v;
    if (t === 'at') { item.at = toks[++k]?.v ?? null; k++; }
    else if (t === 'for') { item.dur = parseDur(toks[++k]?.v) ?? item.dur; k++; }
    else if (t === 'done') { item.done = Math.max(0, Math.min(100, parseInt(toks[++k]?.v, 10) || 0)); k++; }
    else if (t === 'after') {
      k++;
      while (k < toks.length && !KW.has(toks[k].v)) { item.after.push(toks[k].v); k++; }
    } else { errors.push(`L${ln}: 不明な語「${t}」`); k++; }
  }
  return item;
}

export function parse(text) {
  const model = {
    kind: null, meta: {}, items: [], edges: [], groups: [],
    order: [], layout: { pos: {}, order: [], at: {} }, errors: [],
  };
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  let section = null, inLayout = false;

  for (let li = 0; li < lines.length; li++) {
    const raw = lines[li], ln = li + 1;
    const toks = tokenize(raw);
    if (!toks.length) continue;
    const head = toks[0].v;

    if (head === '@layout') { inLayout = true; continue; }

    if (inLayout) {
      const a = toks.map((t) => t.v);
      if (a[0] === 'pos' && a.length >= 4) model.layout.pos[a[1]] = [parseFloat(a[2]), parseFloat(a[3])];
      else if (a[0] === 'order') model.layout.order = a.slice(1);
      else if (a[0] === 'at' && a.length >= 3) model.layout.at[a[1]] = a[2];
      else model.errors.push(`L${ln}: @layout 内の不明な行「${a[0]}」`);
      continue;
    }

    switch (head) {
      case 'kind': model.kind = toks[1]?.v ?? null; break;
      case 'title': model.meta.title = toks.slice(1).map((t) => t.v).join(' '); break;
      case 'section': section = toks[1]?.v ?? null; break;
      case 'task': case 'milestone': {
        const it = parseTask(head, toks.slice(1), ln, model.errors);
        if (it) { it.section = section; model.items.push(it); model.order.push(it.id); }
        break;
      }
      case 'node': {
        if (!toks[1]) { model.errors.push(`L${ln}: node に id がありません`); break; }
        const id = toks[1].v, label = (toks[2] && toks[2].q) ? toks[2].v : id;
        model.items.push({ type: 'node', id, label }); model.order.push(id);
        break;
      }
      case 'edge': {
        // edge a -> b  （-> でつなぐ。3 つ以上の連鎖も許す）
        const ids = toks.slice(1).map((t) => t.v).filter((v) => v !== '->' && v !== '-');
        for (let p = 0; p + 1 < ids.length; p++) model.edges.push({ from: ids[p], to: ids[p + 1] });
        if (ids.length < 2) model.errors.push(`L${ln}: edge は「a -> b」の形で`);
        break;
      }
      case 'group': {
        const name = (toks[1] && toks[1].q) ? toks[1].v : (toks[1]?.v ?? '');
        const ids = toks.slice(2).map((t) => t.v).filter((v) => v !== '{' && v !== '}');
        model.groups.push({ name, ids });
        break;
      }
      default:
        // メタ行（key value…）。kind 既知のうちだけ受ける。
        model.meta[head] = toks.slice(1).map((t) => t.v).join(' ');
    }
  }

  if (!model.kind) model.errors.push('kind（gantt か arch）が宣言されていません');
  return model;
}
