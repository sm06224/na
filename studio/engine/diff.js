/* ============================================================
   diff — 2 つのモデルの「意味の差」。純粋・決定的。
   ------------------------------------------------------------
   なぜ要るか：studio は AI と図を育てる土台。AI が返してきた Mermaid を
   目 grep するのではなく、「何が増え・消え・変わったか」を図の上で見る。
   テキスト diff ではなく **モデル diff**——並び替えや空白は差と数えない。
   比較の単位：
     ・項目（ノード/クラス/タスク/参加者）… id で突き合わせ、中身の変化は changed
     ・エッジ/関係 … from→to(kind) で突き合わせ、ラベル変化は changed
     ・シーケンスのメッセージ … id を持たないので「from→to:label」の多重集合で比較
   ============================================================ */

const itemSig = (it) => JSON.stringify({
  label: it.label ?? null, shape: it.shape ?? null, status: it.status ?? null,
  start: it.start ?? null, end: it.end ?? null, dur: it.dur ?? null,
  after: it.after ?? null, attrs: it.attrs ?? null, methods: it.methods ?? null,
});
const edgeKey = (e) => `${e.from} ${e.to} ${e.kind || ''}`;
const msgKey = (ev) => `${ev.from} ${ev.to} ${ev.label || ''} ${ev.dotted ? 1 : 0}`;

// old → new の差。返り値はすべて「見せられる」形（label 付き）。
export function diffModels(oldM, newM) {
  const res = { kindChanged: oldM.kind !== newM.kind, added: [], removed: [], changed: [],
    addedIds: new Set(), changedIds: new Set() };
  if (res.kindChanged) return res;                          // 図種が違えば差分は語れない（正直に）

  const oldItems = new Map(oldM.items.map((x) => [x.id, x]));
  const newItems = new Map(newM.items.map((x) => [x.id, x]));
  for (const [id, it] of newItems) {
    if (!oldItems.has(id)) { res.added.push({ what: 'item', id, label: it.label || id }); res.addedIds.add(id); }
    else if (itemSig(oldItems.get(id)) !== itemSig(it)) { res.changed.push({ what: 'item', id, label: it.label || id }); res.changedIds.add(id); }
  }
  for (const [id, it] of oldItems)
    if (!newItems.has(id)) res.removed.push({ what: 'item', id, label: it.label || id });

  const oldEdges = new Map((oldM.edges || []).map((e) => [edgeKey(e), e]));
  const newEdges = new Map((newM.edges || []).map((e) => [edgeKey(e), e]));
  for (const [k2, e] of newEdges) {
    if (!oldEdges.has(k2)) res.added.push({ what: 'edge', id: k2, label: `${e.from} → ${e.to}${e.label ? ' (' + e.label + ')' : ''}` });
    else if ((oldEdges.get(k2).label || '') !== (e.label || '')) res.changed.push({ what: 'edge', id: k2, label: `${e.from} → ${e.to}` });
  }
  for (const [k2, e] of oldEdges)
    if (!newEdges.has(k2)) res.removed.push({ what: 'edge', id: k2, label: `${e.from} → ${e.to}${e.label ? ' (' + e.label + ')' : ''}` });

  // シーケンス：メッセージは多重集合で（同文が 2 回 → 1 回なら 1 本消えた、と数える）。
  const count = (evs) => {
    const m = new Map();
    for (const ev of evs || []) if (ev.type === 'msg') m.set(msgKey(ev), (m.get(msgKey(ev)) || 0) + 1);
    return m;
  };
  const oc = count(oldM.events), nc = count(newM.events);
  const disps = new Map();                                   // key → 表示名（ラベルの空白を壊さない）
  for (const ev of [...(oldM.events || []), ...(newM.events || [])])
    if (ev.type === 'msg' && !disps.has(msgKey(ev)))
      disps.set(msgKey(ev), `${ev.from} → ${ev.to}${ev.label ? ': ' + ev.label : ''}`);
  for (const k2 of new Set([...oc.keys(), ...nc.keys()])) {
    const d = (nc.get(k2) || 0) - (oc.get(k2) || 0);
    const disp = disps.get(k2);
    for (let i = 0; i < d; i++) res.added.push({ what: 'msg', id: k2, label: disp });
    for (let i = 0; i < -d; i++) res.removed.push({ what: 'msg', id: k2, label: disp });
  }
  return res;
}
