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
