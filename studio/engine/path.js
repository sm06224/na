/* ============================================================
   path — 到達性の物理。純粋（DOM 非依存・決定的）。

   構成図をグラフとして読む：機器・ハブ・バスが頂点、接続（-- の線）が辺。
   関係線（rep/ミラー/同期）は L3 経路ではないので既定で辺にしない。

   - pathBetween(model, from, to, down): 最短経路（ホップ数 BFS）。
       down に入った頂点（障害注入）は迂回する。戻り値
       { nodes: [id...], edges: [modelのedge参照...], hops } または null（到達不能）。
   - reachableFrom(model, root, down): root から届く頂点の集合。
       障害シミュレーション——落とした後に「どこが見えなくなるか」は
       全頂点 − これ。
   ============================================================ */

export function netGraph(model) {
  const adj = new Map();
  const add = (a, b, e) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push({ to: b, e }); };
  for (const e of model.edges) {
    if (e.rel) continue;                                     // 関係線は通信経路ではない
    add(e.from, e.to, e); add(e.to, e.from, e);
  }
  return adj;
}

export const netNodeIds = (model) =>
  model.items.filter((x) => x.type === 'inode' || x.type === 'hub' || x.type === 'bus').map((x) => x.id);

export function pathBetween(model, from, to, down = []) {
  const dn = new Set(down);
  if (dn.has(from) || dn.has(to) || from === to) return null;
  const adj = netGraph(model);
  const prev = new Map([[from, null]]);
  const q = [from];
  while (q.length) {
    const cur = q.shift();
    if (cur === to) break;
    for (const { to: nx, e } of adj.get(cur) || []) {
      if (dn.has(nx) || prev.has(nx)) continue;
      prev.set(nx, { from: cur, e });
      q.push(nx);
    }
  }
  if (!prev.has(to)) return null;
  const nodes = [], edges = [];
  let cur = to;
  while (cur !== from) { const p = prev.get(cur); nodes.push(cur); edges.push(p.e); cur = p.from; }
  nodes.push(from);
  nodes.reverse(); edges.reverse();
  return { nodes, edges, hops: nodes.length - 1 };
}

export function reachableFrom(model, root, down = []) {
  const dn = new Set(down);
  if (dn.has(root)) return new Set();
  const adj = netGraph(model);
  const seen = new Set([root]);
  const q = [root];
  while (q.length) {
    const cur = q.shift();
    for (const { to } of adj.get(cur) || []) {
      if (dn.has(to) || seen.has(to)) continue;
      seen.add(to); q.push(to);
    }
  }
  return seen;
}
