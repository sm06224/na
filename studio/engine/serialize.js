/* ============================================================
   モデル → DSL テキスト（往復の戻り）。
   意味部はソースの items/edges/groups からそのまま書き、
   ドラッグの結果（位置・順序・手動開始日）は @layout トレイラだけに書く。
   だから人/AI が書いた意味は崩れず、エディタは @layout だけを更新する。
   parse(serialize(model)) が安定することをテストが保証する。
   ============================================================ */

const q = (s) => `"${String(s).replace(/"/g, '')}"`;
const num = (n) => (Math.round(n * 100) / 100).toString();

function metaLines(model) {
  const out = [];
  if (model.meta.title) out.push(`title ${model.meta.title}`);
  for (const k of ['start', 'today']) if (model.meta[k]) out.push(`${k} ${model.meta[k]}`);
  for (const k of Object.keys(model.meta)) if (!['title', 'start', 'today'].includes(k)) out.push(`${k} ${model.meta[k]}`);
  return out;
}

function ganttBody(model) {
  const out = [];
  let curSec;
  for (const id of model.order) {
    const it = model.items.find((x) => x.id === id);
    if (!it) continue;
    if (it.section !== curSec) { curSec = it.section; if (curSec) out.push('', `section ${q(curSec)}`); }
    const parts = [it.type, it.id, q(it.label)];
    if (it.at) parts.push('at', it.at);
    else if (it.after.length) parts.push('after', ...it.after);
    if (it.type !== 'milestone') parts.push('for', `${num(it.dur)}d`);
    if (it.done) parts.push('done', String(it.done));
    out.push('  ' + parts.join(' '));
  }
  return out;
}

function archBody(model) {
  const out = [];
  for (const id of model.order) {
    const it = model.items.find((x) => x.id === id);
    if (it && it.type === 'node') out.push(`node ${it.id} ${q(it.label)}`);
  }
  if (model.edges.length) out.push('');
  for (const e of model.edges) out.push(`edge ${e.from} -> ${e.to}`);
  for (const g of model.groups) out.push(`group ${q(g.name)} { ${g.ids.join(' ')} }`);
  return out;
}

function layoutTrailer(model) {
  const L = model.layout, out = [];
  if (model.kind === 'arch') {
    for (const id of model.order) if (L.pos[id]) out.push(`  pos ${id} ${num(L.pos[id][0])} ${num(L.pos[id][1])}`);
  } else {
    if (L.order && L.order.length) out.push(`  order ${L.order.join(' ')}`);
    for (const id of Object.keys(L.at)) out.push(`  at ${id} ${L.at[id]}`);
  }
  return out.length ? ['', '@layout', ...out] : [];
}

export function serialize(model) {
  const head = [`kind ${model.kind}`, ...metaLines(model)];
  const body = model.kind === 'arch' ? archBody(model) : ganttBody(model);
  return [...head, '', ...body, ...layoutTrailer(model)].join('\n') + '\n';
}
