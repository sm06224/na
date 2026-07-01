/* ============================================================
   モデル → Mermaid テキスト（往復の戻り）。
   意味部は Mermaid の正規記法で書き、ドラッグの結果（位置・並び・開始日）は
   末尾の %% @layout コメントにだけ書く。Mermaid から見ればただのコメントなので
   そのまま貼って描ける。parse(serialize(model)) が安定することをテストが保証する。
   ============================================================ */

const num = (n) => (Math.round(n * 100) / 100).toString();

function ganttBody(model) {
  const out = ['gantt'];
  if (model.meta.title) out.push(`    title ${model.meta.title}`);
  out.push(`    dateFormat ${model.meta.dateFormat || 'YYYY-MM-DD'}`);
  if (model.meta.axisFormat) out.push(`    axisFormat ${model.meta.axisFormat}`);
  let curSec;
  for (const id of model.order) {
    const it = model.items.find((x) => x.id === id);
    if (!it) continue;
    if (it.section !== curSec) { curSec = it.section; if (curSec) out.push(`    section ${curSec}`); }
    const tags = [];
    if (it.type === 'milestone') tags.push('milestone');
    if (it.status) tags.push(it.status);
    const start = it.at ? it.at : (it.after.length ? `after ${it.after.join(' ')}` : it.at || '');
    const spec = [...tags, it.id, start, `${num(it.dur)}d`].filter((s) => s !== '').join(', ');
    out.push(`      ${it.label} :${spec}`);
  }
  for (const id of model.order) {                      // ハイパーリンク（click 行）
    const it = model.items.find((x) => x.id === id);
    if (it?.link) out.push(`    click ${it.id} href "${it.link}"`);
  }
  return out;
}

const OP = (e) => {
  if (e.thick) return e.arrow ? '==>' : '===';
  if (e.dotted) return e.arrow ? '-.->' : '-.-';
  return e.arrow ? '-->' : '---';
};
const SHAPE = {
  rect: (s) => `[${s}]`, round: (s) => `(${s})`, stadium: (s) => `([${s}])`,
  subroutine: (s) => `[[${s}]]`, cylinder: (s) => `[(${s})]`, circle: (s) => `((${s}))`,
  rhombus: (s) => `{${s}}`, hexagon: (s) => `{{${s}}}`, flag: (s) => `>${s}]`,
};

function flowBody(model) {
  const out = [`flowchart ${model.meta.dir || 'TD'}`];
  const inGroup = new Set();
  for (const g of model.groups) for (const id of g.ids) inGroup.add(id);
  // ノード定義（形・ラベル）を先に。グループ外のものを宣言（中のものは subgraph 内で）。
  for (const id of model.order) {
    const n = model.items.find((x) => x.id === id);
    if (!n || n.type !== 'node' || inGroup.has(id)) continue;
    out.push(`    ${id}${(SHAPE[n.shape] || SHAPE.rect)(n.label)}`);
  }
  for (const e of model.edges) {
    const op = OP(e), lbl = e.label ? `|${e.label}|` : '';
    out.push(`    ${e.from} ${op}${lbl} ${e.to}`);
  }
  // subgraph は入れ子ごと書き戻す（parent 番号でぶら下げる）。
  const emitGroup = (gi, indent) => {
    const g = model.groups[gi];
    out.push(`${indent}subgraph ${g.name}`);
    for (const id of g.ids) {
      const n = model.items.find((x) => x.id === id);
      out.push(n ? `${indent}  ${id}${(SHAPE[n.shape] || SHAPE.rect)(n.label)}` : `${indent}  ${id}`);
    }
    model.groups.forEach((c, ci) => { if (c.parent === gi) emitGroup(ci, indent + '  '); });
    out.push(`${indent}end`);
  };
  model.groups.forEach((g, gi) => { if (g.parent == null) emitGroup(gi, '    '); });
  for (const id of model.order) {                      // ハイパーリンク（click 行）
    const n = model.items.find((x) => x.id === id);
    if (n?.link) out.push(`    click ${n.id} "${n.link}"`);
  }
  return out;
}

function seqBody(model) {
  const out = ['sequenceDiagram'];
  if (model.meta.title) out.push(`    title ${model.meta.title}`);
  if (model.meta.autonumber) out.push('    autonumber');
  for (const id of model.order) {
    const a = model.items.find((x) => x.id === id);
    if (a) out.push(`    participant ${a.id}${a.label !== a.id ? ` as ${a.label}` : ''}`);
  }
  let indent = '    ';
  for (const ev of (model.events || [])) {
    if (ev.type === 'fstart') { out.push(`${indent}${ev.kind}${ev.label ? ' ' + ev.label : ''}`); indent += '  '; }
    else if (ev.type === 'fdiv') out.push(`${indent.slice(2)}${ev.kind}${ev.label ? ' ' + ev.label : ''}`);
    else if (ev.type === 'fend') { indent = indent.slice(0, -2); out.push(`${indent}end`); }
    else if (ev.type === 'note') out.push(`${indent}Note ${ev.pos} ${ev.ids.join(',')}: ${ev.label}`);
    else {
      const op = (ev.dotted ? '--' : '-') + (ev.cross ? 'x' : ev.async ? ')' : ev.arrow ? '>>' : '>');
      out.push(`${indent}${ev.from}${op}${ev.to}${ev.label ? ': ' + ev.label : ''}`);
    }
  }
  return out;
}

// クラス図：class ブロック（属性→メソッド）と、正規形の関係演算子。
const CLASS_OP = (e) => {
  if (e.kind === 'inherit') return [e.to, e.dotted ? '<|..' : '<|--', e.from];
  if (e.kind === 'composition') return [e.to, '*--', e.from];
  if (e.kind === 'aggregation') return [e.to, 'o--', e.from];
  if (e.kind === 'assoc') return [e.from, e.dotted ? '..>' : '-->', e.to];
  return [e.from, e.dotted ? '..' : '--', e.to];
};
function classBody(model) {
  const out = ['classDiagram'];
  for (const id of model.order) {
    const c = model.items.find((x) => x.id === id);
    if (!c || c.type !== 'class') continue;
    if (!c.attrs.length && !c.methods.length) { out.push(`    class ${c.id}`); continue; }
    out.push(`    class ${c.id} {`);
    for (const a of c.attrs) out.push(`      ${a}`);
    for (const m of c.methods) out.push(`      ${m}`);
    out.push('    }');
  }
  for (const e of model.edges) {
    const [a, op, b] = CLASS_OP(e);
    out.push(`    ${a} ${op} ${b}${e.label ? ' : ' + e.label : ''}`);
  }
  return out;
}

function trailer(model) {
  const L = model.layout, out = [];
  if (model.kind === 'flowchart' || model.kind === 'class') {
    for (const id of model.order) if (L.pos[id]) out.push(`%% pos ${id} ${num(L.pos[id][0])} ${num(L.pos[id][1])}`);
  } else if (model.kind === 'sequence') {
    if (L.order && L.order.length) out.push(`%% order ${L.order.join(' ')}`);
  } else {
    if (L.order && L.order.length) out.push(`%% order ${L.order.join(' ')}`);
    for (const id of Object.keys(L.at)) out.push(`%% at ${id} ${L.at[id]}`);
    if (model.meta.today) out.push(`%% today ${model.meta.today}`);
  }
  return out.length ? ['', '%% @layout', ...out] : [];
}

export function serialize(model) {
  const body = model.kind === 'flowchart' ? flowBody(model)
    : model.kind === 'sequence' ? seqBody(model)
    : model.kind === 'class' ? classBody(model) : ganttBody(model);
  return [...body, ...trailer(model)].join('\n') + '\n';
}
