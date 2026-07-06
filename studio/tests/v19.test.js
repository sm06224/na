/* ============================================================
   v19 の検証：経路（BFS）と到達性（障害シミュレーション）。純粋エンジン。
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../engine/parse.js';
import { layout } from '../engine/layout.js';
import { draw } from '../render/draw.js';
import { pathBetween, reachableFrom, netNodeIds, netGraph } from '../engine/path.js';

const NET = `infra
    zone 本社 {
      c1[CORE-1] :core
      c2[CORE-2] :core
    }
    zone 大阪DR {
      d1[DR-CORE] :core
    }
    bus lan[基幹] :vlan 10, 10.0.0.0/24
    hub wan[WAN]
    c1 -- lan
    c2 -- lan
    c1 -- wan
    c2 -- wan
    d1 -- wan
    c1 -- d1 :rep, レプリケーション`;

test('path: 最短経路をホップ数で求める・関係線は経路に使わない', () => {
  const m = parse(NET);
  assert.equal(m.errors.length, 0, m.errors.join('/'));
  const p = pathBetween(m, 'd1', 'lan');
  assert.ok(p, '経路がある');
  assert.equal(p.nodes[0], 'd1');
  assert.equal(p.nodes.at(-1), 'lan');
  assert.ok(p.nodes.includes('wan'), 'WAN 経由');
  // rep 直行（c1--d1）は経路に使わないので d1→lan は wan 経由の 3 ホップ
  assert.equal(p.hops, 3, p.nodes.join('→'));
  assert.ok(!p.edges.some((e) => e.rel), '関係線を含まない');
});

test('reachable: WAN 障害で DR が本社から切れる', () => {
  const m = parse(NET);
  const r0 = reachableFrom(m, 'c1');
  assert.ok(r0.has('d1'), '平常時は DR に届く');
  const r1 = reachableFrom(m, 'c1', ['wan']);
  assert.ok(!r1.has('d1'), 'WAN 障害で DR に届かない');
  assert.ok(r1.has('c2') && r1.has('lan'), '本社内は生きている');
});

test('reachable: 冗長で救済——CORE-1 が落ちても DR は CORE-2 経由で生存', () => {
  const m = parse(NET);
  const r = reachableFrom(m, 'lan', ['c1']);
  assert.ok(r.has('d1'), 'c1 障害でも d1 に届く（c2→wan 経由）');
});

test('path: 障害を迂回する／到達不能なら null', () => {
  const m = parse(NET);
  // wan を落とすと d1↔本社は到達不能
  assert.equal(pathBetween(m, 'd1', 'lan', ['wan']), null);
  // c1 を落としても c2 経由で通る
  const p = pathBetween(m, 'd1', 'lan', ['c1']);
  assert.ok(p && p.nodes.includes('c2') && !p.nodes.includes('c1'), p && p.nodes.join('→'));
});

test('netNodeIds: 機器・ハブ・バスが頂点（関係線相手も辺は張られる）', () => {
  const m = parse(NET);
  const ids = netNodeIds(m);
  assert.ok(ids.includes('c1') && ids.includes('wan') && ids.includes('lan'));
  const adj = netGraph(m);
  assert.ok(!(adj.get('c1') || []).some((x) => x.to === 'd1'), 'c1--d1 は rep なので隣接に無い');
});

test('draw: 解析オーバレイ——経路は蛍光・落とした機器は ⚡・到達不能は赤', () => {
  const m = parse(NET);
  const L = layout(m);
  const p = pathBetween(m, 'd1', 'lan');
  const svg = draw(m, L, { analysis: { down: new Set(), dead: new Set(),
    pathEdges: new Set(p.edges), pathEnds: new Set(['d1', 'lan']) } });
  assert.ok(svg.includes('#57e3ff'), '経路の蛍光ペン');
  const r = reachableFrom(m, 'lan', ['wan']);
  const dead = new Set(netNodeIds(m).filter((id) => id !== 'wan' && !r.has(id)));
  const svg2 = draw(m, L, { analysis: { down: new Set(['wan']), dead, pathEdges: new Set(), pathEnds: new Set() } });
  assert.ok(svg2.includes('⚡'), '落とした機器に ⚡');
  assert.ok(svg2.includes('#f05a5a'), '到達不能は赤');
  // 解析なしなら何も足さない
  assert.ok(!draw(m, L, {}).includes('⚡'));
});
