/* ============================================================
   流し込み — 表データ（CSV / TSV）→ Mermaid。手数を減らす入口。純粋・決定的。
   1 行目はヘッダ。言い方のゆらぎ（日英）は同義語表で吸収する。
     ・from / to（元・先）があれば **フローチャート**（エッジリスト）
     ・label / start / duration（名前・開始・期間）があれば **ガント**
   ガントは link 列で click 行（ハイパーリンク）も生やす。
   DOM もネットも知らない。文字列を受けて Mermaid 文字列を返すだけ。
   ============================================================ */

// 引用符（"a,b" と "" のエスケープ）対応の CSV。タブ区切りなら TSV として読む。
export function parseCSV(text) {
  const s = String(text).replace(/\r\n?/g, '\n');
  const head = s.split('\n', 1)[0] || '';
  const delim = head.includes('\t') && !head.includes(',') ? '\t' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); if (row.some((x) => x.trim() !== '')) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  row.push(cell); if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

// 列名の同義語（小文字化して照合）。
const SYN = {
  id: ['id', '番号', 'no', 'no.'],
  label: ['label', 'name', 'task', 'title', 'node', '名前', 'タスク', '作業', '項目', 'ラベル', '件名'],
  start: ['start', 'begin', '開始', '開始日', '着手'],
  end: ['end', 'finish', 'due', '終了', '終了日', '期限', '締切'],
  dur: ['duration', 'days', 'dur', '期間', '日数', '工数'],
  after: ['after', 'depends', 'dependson', 'deps', 'pred', '依存', '先行', '前工程'],
  status: ['status', 'state', '状態', '進捗', 'ステータス'],
  section: ['section', 'group', 'phase', 'category', '区分', 'セクション', '工程', 'フェーズ', '分類'],
  from: ['from', 'source', 'src', '元', '始点', '出発'],
  to: ['to', 'target', 'dest', 'dst', '先', '終点', '到着'],
  link: ['link', 'url', 'href', 'リンク'],
};

function mapHeader(cells) {
  const idx = {};
  cells.forEach((h, i) => {
    const k = String(h).trim().toLowerCase();
    for (const key of Object.keys(SYN)) if (idx[key] == null && SYN[key].includes(k)) { idx[key] = i; return; }
  });
  return idx;
}

const normStatus = (s) => {
  s = String(s || '').trim().toLowerCase();
  if (['done', '完了', '済', '済み'].includes(s)) return 'done';
  if (['active', 'doing', '進行', '進行中', '作業中', '着手中'].includes(s)) return 'active';
  if (['crit', 'critical', '重要', 'クリティカル', '危険'].includes(s)) return 'crit';
  if (['milestone', 'マイルストン', 'マイルストーン', '節目'].includes(s)) return 'milestone';
  return null;
};

const safeId = (s) => String(s).trim().replace(/[^A-Za-z0-9_.-]/g, '');
const normDate = (s) => String(s).trim().replace(/\//g, '-');
const isDateish = (s) => /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(String(s).trim());

// ---- ガント ---------------------------------------------------------------

function rowsToGantt(rows, H) {
  const recs = [];
  const used = new Set();
  rows.forEach((r, i) => {
    const get = (k) => (H[k] != null ? String(r[H[k]] ?? '').trim() : '');
    const label = get('label') || get('id') || `task${i + 1}`;
    let id = safeId(get('id')) || `t${i + 1}`;
    while (used.has(id)) id += 'x';
    used.add(id);
    recs.push({ id, label, start: get('start'), end: get('end'), dur: get('dur'),
      after: get('after'), status: normStatus(get('status')), section: get('section'), link: get('link') });
  });
  // 依存は id でもラベルでも書ける（後解決）。
  const byLabel = new Map(recs.map((x) => [x.label, x.id]));
  const byId = new Set(recs.map((x) => x.id));
  const resolve = (tok) => byId.has(tok) ? tok : (byLabel.get(tok) || null);

  const out = ['gantt', '    dateFormat YYYY-MM-DD'];
  const clicks = [];
  let cur, prev = null;
  for (const x of recs) {
    if (x.section && x.section !== cur) { out.push(`    section ${x.section}`); cur = x.section; }
    const tags = [];
    if (x.status === 'milestone') tags.push('milestone');
    else if (x.status) tags.push(x.status);
    const after = x.after.split(/[\s;、,，]+/).filter(Boolean).map(resolve).filter(Boolean);
    let startTok = '';
    if (isDateish(x.start)) startTok = normDate(x.start);
    else if (after.length) startTok = 'after ' + after.join(' ');
    else if (prev) startTok = 'after ' + prev;               // 開始未指定は直前の後ろ（明示して曖昧さを消す）
    let endTok;
    if (x.status === 'milestone') endTok = '0d';
    else if (x.dur) endTok = /^\d+(\.\d+)?$/.test(x.dur) ? x.dur + 'd' : x.dur;
    else if (isDateish(x.end)) endTok = normDate(x.end);
    else endTok = '1d';
    const spec = [...tags, x.id, startTok, endTok].filter((s) => s !== '').join(', ');
    out.push(`      ${x.label} :${spec}`);
    if (x.link) clicks.push(`    click ${x.id} href "${x.link}"`);
    prev = x.id;
  }
  return out.concat(clicks).join('\n') + '\n';
}

// ---- フローチャート（エッジリスト）------------------------------------------

function rowsToFlow(rows, H) {
  const ids = new Map();                                   // ラベル → id
  let k = 0;
  const ensure = (label) => {
    if (ids.has(label)) return ids.get(label);
    let id = safeId(label);
    if (!id || [...ids.values()].includes(id)) id = 'n' + (++k);
    ids.set(label, id);
    return id;
  };
  const edges = [], clicks = [];
  for (const r of rows) {
    const get = (key) => (H[key] != null ? String(r[H[key]] ?? '').trim() : '');
    const f = get('from'), t = get('to');
    if (!f || !t) continue;
    const lab = get('label');
    edges.push(`    ${ensure(f)} -->${lab ? `|${lab}|` : ''} ${ensure(t)}`);
    const link = get('link');
    if (link) clicks.push(`    click ${ensure(t)} "${link}"`);
  }
  const decls = [...ids.entries()].map(([label, id]) => `    ${id}[${label}]`);
  const seen = new Set(), uc = clicks.filter((c) => !seen.has(c) && seen.add(c));
  return ['flowchart TD', ...decls, ...edges, ...uc].join('\n') + '\n';
}

// ---- 万能ペースト：何を貼られたか当てて、図にする ----------------------------
// 「貼れば図になる」を Mermaid・表以外にも広げる。判定は保守的に——
// ただの文章を乗っ取らないよう、構造の証拠（矢印・字下げ・JSON・区切り）を要求する。

const MERMAID_HEAD = /^(gantt|flowchart|graph|sequenceDiagram|classDiagram)\b/;
const ARROW = /[-=]+>+|→|⇒/;   // -> / --> / => / ==> / →（>> まで丸ごと食べる）

export function sniff(text) {
  const t = String(text).trim();
  if (!t) return 'unknown';
  if (MERMAID_HEAD.test(t)) return 'mermaid';
  if (/\bcreate\s+table\b/i.test(t)) return 'sql';
  if (t[0] === '{' || t[0] === '[') { try { const v = JSON.parse(t); if (v && typeof v === 'object') return 'json'; } catch (_) { /* JSON でなければ次へ */ } }
  const lines = t.split('\n').filter((l) => l.trim());
  const arrowLines = lines.filter((l) => ARROW.test(l)).length;
  if (arrowLines >= 1 && arrowLines >= lines.length * 0.6) return 'arrows';   // 過半が矢印行
  const head = t.split('\n', 1)[0];
  if (lines.length >= 2 && (head.includes('\t') || head.includes(','))) return 'table';
  const bullet = /^(\s*)([-*・•]|\d+[.)])\s+/;
  const indented = lines.filter((l) => bullet.test(l) || /^\s+\S/.test(l)).length;
  if (lines.length >= 2 && indented >= lines.length - 1) return 'outline';    // 先頭行以外が箇条書き/字下げ
  return 'unknown';
}

// 矢印テキスト：`入口 -> 検査 -> 出荷` のような行の束。1 行に何段でも書ける。
// `A -> B: ラベル` の末尾ラベルはエッジに付く。
export function arrowsToFlow(text) {
  const ids = new Map(); let k = 0;
  const ensure = (label) => {
    if (ids.has(label)) return ids.get(label);
    let id = safeId(label);
    if (!id || [...ids.values()].includes(id)) id = 'n' + (++k);
    ids.set(label, id); return id;
  };
  const edges = [];
  for (const raw of String(text).split('\n')) {
    const line = raw.trim(); if (!line || !ARROW.test(line)) continue;
    let label = '';
    const li = line.lastIndexOf(':');
    let body = line;
    if (li > 0 && !ARROW.test(line.slice(li))) { label = line.slice(li + 1).trim(); body = line.slice(0, li); }
    const hops = body.split(ARROW).map((s) => s.trim()).filter(Boolean);
    for (let i = 0; i + 1 < hops.length; i++)
      edges.push(`    ${ensure(hops[i])} -->${i === hops.length - 2 && label ? `|${label}|` : ''} ${ensure(hops[i + 1])}`);
  }
  const decls = [...ids.entries()].map(([label, id]) => `    ${id}[${label}]`);
  return ['flowchart LR', ...decls, ...edges].join('\n') + '\n';
}

// 箇条書き（字下げ＝親子）→ ツリーのフローチャート。議事メモがそのまま構成図になる。
export function outlineToFlow(text) {
  const ids = new Map(); let k = 0;
  const ensure = (label) => {
    if (ids.has(label)) return ids.get(label);
    let id = safeId(label);
    if (!id || [...ids.values()].includes(id)) id = 'n' + (++k);
    ids.set(label, id); return id;
  };
  const edges = [], stack = [];                              // stack: [{depth, id}]
  for (const raw of String(text).replace(/\t/g, '  ').split('\n')) {
    if (!raw.trim()) continue;
    const m = /^(\s*)((?:[-*・•]|\d+[.)])\s+)?(.*)$/.exec(raw);
    // ビュレットは 1 段下と数える：「親\n- 子」で子になる（見た目どおり）。
    const depth = m[1].length + (m[2] ? 1 : 0), label = m[3].trim();
    if (!label) continue;
    const id = ensure(label);
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    if (stack.length) edges.push(`    ${stack[stack.length - 1].id} --> ${id}`);
    stack.push({ depth, id });
  }
  const decls = [...ids.entries()].map(([label, id]) => `    ${id}[${label}]`);
  return ['flowchart TD', ...decls, ...edges].join('\n') + '\n';
}

// JSON → 構造ツリー。キーがノード、入れ子が枝、末端は「キー: 値」。API の応答を貼って眺める用。
export function jsonToFlow(text) {
  const v = JSON.parse(String(text));
  const decls = [], edges = []; let k = 0;
  const CAP = 200;                                           // 巨大 JSON の暴走止め（正直に打ち切る）
  const short = (x) => { const s = typeof x === 'string' ? x : JSON.stringify(x); return s.length > 24 ? s.slice(0, 21) + '…' : s; };
  const node = (label) => { const id = 'j' + (++k); decls.push(`    ${id}[${String(label).replace(/[[\]{}|"]/g, ' ').replace(/\s+/g, ' ').trim() || '·'}]`); return id; };
  const walk = (val, label, parent) => {
    if (k >= CAP) return;
    if (val && typeof val === 'object') {
      const id = node(Array.isArray(val) ? `${label}（${val.length}）` : label);   // [] は Mermaid の形と衝突するので全角
      if (parent) edges.push(`    ${parent} --> ${id}`);
      const entries = Array.isArray(val) ? val.map((x, i) => [i, x]) : Object.entries(val);
      for (const [key2, v2] of entries) walk(v2, String(key2), id);
    } else {
      const id = node(`${label}: ${short(val)}`);
      if (parent) edges.push(`    ${parent} --> ${id}`);
    }
  };
  walk(v, 'root', null);
  return { text: ['flowchart TD', ...decls, ...edges].join('\n') + '\n', truncated: k >= CAP };
}

// SQL DDL（CREATE TABLE）→ クラス図（＝簡易 ER 図）。
// テーブルはクラス、列は属性（PK/FK を印字）、外部キーは参照先への矢印になる。
// スキーマファイルを貼るだけで ER が出る——DBA の「とりあえず図に」を一発に。
export function sqlToClass(text) {
  const src = String(text).replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');   // コメント除去
  const tables = [], edges = [];
  const TBL = /create\s+table\s+(?:if\s+not\s+exists\s+)?[`"[]?([\w.]+)[`"\]]?\s*\(([\s\S]*?)\)\s*(?:;|$)/gi;
  let m;
  while ((m = TBL.exec(src))) {
    const name = m[1].split('.').pop();
    const cols = [], pks = new Set();
    // 括弧の深さで列定義を区切る（DECIMAL(10,2) の中のカンマで切らない）。
    const parts = []; let depth = 0, cur = '';
    for (const ch of m[2]) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
    }
    parts.push(cur);
    for (const partRaw of parts) {
      const part = partRaw.trim().replace(/\s+/g, ' ');
      if (!part) continue;
      let cm = /^primary\s+key\s*\(([^)]+)\)/i.exec(part);
      if (cm) { for (const c of cm[1].split(',')) pks.add(c.trim().replace(/[`"[\]]/g, '')); continue; }
      cm = /^(?:constraint\s+\S+\s+)?foreign\s+key\s*\(([^)]+)\)\s*references\s+[`"[]?([\w.]+)[`"\]]?/i.exec(part);
      if (cm) { edges.push({ from: name, to: cm[2].split('.').pop(), label: cm[1].replace(/[`"[\]]/g, '').trim() }); continue; }
      if (/^(unique|index|key|check|constraint)\b/i.test(part)) continue;
      cm = /^[`"[]?(\w+)[`"\]]?\s+([\w()',\s]+?)(?:\s+(.*))?$/.exec(part);
      if (!cm) continue;
      // 型のカッコは畳む：クラス図の文法では () がメソッドの印なので DECIMAL(10,2) → DECIMAL。
      const col = cm[1], type = cm[2].trim().replace(/\s.*$/, '').replace(/\(.*$/, '');
      const tail = part.slice(cm[1].length);
      if (/primary\s+key/i.test(tail)) pks.add(col);
      const rm = /references\s+[`"[]?([\w.]+)[`"\]]?/i.exec(tail);
      if (rm) edges.push({ from: name, to: rm[1].split('.').pop(), label: col });
      cols.push({ col, type });
    }
    tables.push({ name, cols, pks });
  }
  if (!tables.length) return { error: 'CREATE TABLE が見つかりません' };
  const fkCols = new Map(edges.map((e) => [`${e.from}.${e.label}`, e.to]));
  const out = ['classDiagram'];
  for (const t of tables) {
    out.push(`    class ${t.name} {`);
    for (const c of t.cols) {
      const marks = [t.pks.has(c.col) ? 'PK' : null, fkCols.has(`${t.name}.${c.col}`) ? 'FK' : null].filter(Boolean);
      out.push(`      +${c.type} ${c.col}${marks.length ? ' «' + marks.join(',') + '»' : ''}`);
    }
    out.push('    }');
  }
  const known = new Set(tables.map((t) => t.name));
  const seen = new Set();                                    // 列内 REFERENCES と FOREIGN KEY の二重計上を畳む
  for (const e of edges) {
    const k = `${e.from}→${e.to}:${e.label}`;
    if (known.has(e.to) && !seen.has(k)) { seen.add(k); out.push(`    ${e.from} --> ${e.to} : ${e.label}`); }
  }
  return { text: out.join('\n') + '\n' };
}

// 何でも入口：貼られたものを当てて Mermaid にする。判らなければ正直に unknown。
export function universal(text) {
  const kind = sniff(text);
  if (kind === 'mermaid') return { kind, text: String(text) };
  if (kind === 'sql') { const r = sqlToClass(text); return r.error ? { kind: 'unknown', error: r.error } : { kind, text: r.text }; }
  if (kind === 'table') { const r = csvToMermaid(text); return r.error ? { kind: 'unknown', error: r.error } : { kind: 'table', text: r.text, sub: r.kind }; }
  if (kind === 'arrows') return { kind, text: arrowsToFlow(text) };
  if (kind === 'outline') return { kind, text: outlineToFlow(text) };
  if (kind === 'json') { try { const r = jsonToFlow(text); return { kind, text: r.text, truncated: r.truncated }; } catch (_) { return { kind: 'unknown' }; } }
  return { kind: 'unknown' };
}

// ---- 入口 -------------------------------------------------------------------

export function csvToMermaid(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { error: 'ヘッダ行とデータ行が要ります（2 行以上）' };
  const H = mapHeader(rows[0]);
  if (H.from != null && H.to != null) return { kind: 'flowchart', text: rowsToFlow(rows.slice(1), H) };
  if (H.label != null || H.start != null || H.dur != null)
    return { kind: 'gantt', text: rowsToGantt(rows.slice(1), H) };
  return { error: '列が読めません（from/to か、名前(label)・開始(start)・期間(duration) を含めてください）' };
}
