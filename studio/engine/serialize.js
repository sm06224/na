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
  for (const g of model.groups) {
    out.push(`    subgraph ${g.name}`);
    for (const id of g.ids) {
      const n = model.items.find((x) => x.id === id);
      out.push(n ? `      ${id}${(SHAPE[n.shape] || SHAPE.rect)(n.label)}` : `      ${id}`);
    }
    out.push('    end');
  }
  return out;
}

function trailer(model) {
  const L = model.layout, out = [];
  if (model.kind === 'flowchart') {
    for (const id of model.order) if (L.pos[id]) out.push(`%% pos ${id} ${num(L.pos[id][0])} ${num(L.pos[id][1])}`);
  } else {
    if (L.order && L.order.length) out.push(`%% order ${L.order.join(' ')}`);
    for (const id of Object.keys(L.at)) out.push(`%% at ${id} ${L.at[id]}`);
    if (model.meta.today) out.push(`%% today ${model.meta.today}`);
  }
  return out.length ? ['', '%% @layout', ...out] : [];
}

export function serialize(model) {
  const body = model.kind === 'flowchart' ? flowBody(model) : ganttBody(model);
  return [...body, ...trailer(model)].join('\n') + '\n';
}
