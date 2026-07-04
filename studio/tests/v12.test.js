/* ============================================================
   v12 の検証：ハブ＆スポーク・ゾーン内バス・len 指定・%% lod の往復。
   セマンティックズームの見た目（ズームで要約⇄詳細）はヘッドレスが受け持つ。
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../engine/parse.js';
import { layout } from '../engine/layout.js';
import { serialize } from '../engine/serialize.js';
import { draw } from '../render/draw.js';

const HUB = `infra
    zone 本社 {
      core[CORE] :core
    }
    hub wan[広域WAN] :vlan 1, 172.31.0.0/16
    s1[札幌] :access
    s2[仙台] :access
    s3[大阪] :access
    s4[福岡] :access
    s1 -- wan :IP-VPN
    s2 -- wan
    s3 -- wan :冗長
    s4 -- wan
    core -- wan :幹線`;

test('hub: パース・二重円の描画・チップ・往復', () => {
  const m = parse(HUB);
  assert.equal(m.errors.length, 0, m.errors.join(' / '));
  const h = m.items.find((x) => x.type === 'hub');
  assert.equal(h.id, 'wan');
  assert.equal(h.vlan, 1);
  assert.equal(h.cidr, '172.31.0.0/16');
  const svg = draw(m, layout(m), {});
  assert.ok((svg.match(/<circle[^>]*stroke-opacity="0.45"/g) || []).length === 1, '内側の輪');
  assert.ok(svg.includes('広域WAN') && svg.includes('VLAN 1 ・ 172.31.0.0/16'));
  const m2 = parse(serialize(m));
  assert.equal(m2.errors.length, 0, serialize(m));
  const h2 = m2.items.find((x) => x.type === 'hub');
  assert.deepEqual([h2.id, h2.vlan, h2.cidr], ['wan', 1, '172.31.0.0/16']);
});

test('hub: 自由なスポークはハブの周りに環状・等角・決定的に並ぶ', () => {
  const m = parse(HUB);
  const L = layout(m);
  const hub = L.nodes.find((n) => n.hub);
  const cx = hub.x + hub.r, cy = hub.y + hub.r;
  const spokes = ['s1', 's2', 's3', 's4'].map((id) => L.nodes.find((n) => n.id === id));
  const dist = spokes.map((n) => Math.hypot(n.x + n.w / 2 - cx, n.y + n.h / 2 - cy));
  assert.ok(dist.every((d) => Math.abs(d - dist[0]) < 1), `等距離: ${dist.map((d) => d.toFixed(1))}`);
  assert.ok(dist[0] > hub.r + 60, 'ハブの外に出る');
  // core はゾーン所属なので環に参加しない
  const core = L.nodes.find((n) => n.id === 'core');
  const zone = L.zones.find((z) => z.name === '本社');
  assert.ok(core.x >= zone.x && core.x + core.w <= zone.x + zone.w);
  assert.deepEqual(layout(parse(HUB)), L);
});

test('hub: スポークの線は円周でトリムされる（中心に刺さらない）', () => {
  const m = parse(HUB);
  const L = layout(m);
  const hub = L.nodes.find((n) => n.hub);
  const cx = hub.x + hub.r, cy = hub.y + hub.r;
  for (const l of L.links.filter((x) => x.hubEnd)) {
    const dEnd = Math.min(Math.hypot(l.x1 - cx, l.y1 - cy), Math.hypot(l.x2 - cx, l.y2 - cy));
    assert.ok(Math.abs(dEnd - hub.r) < 1, `円周で止まる: ${dEnd.toFixed(1)} ≒ r=${hub.r}`);
  }
});

const INBUS = `infra
    zone サーバ室 {
      a[APサーバ] :server
      b[DBサーバ] :db
      bus san[SANバス] :vlan 30
    }
    out[外部] :cloud
    a -- san
    b -- san
    out -- a`;

test('ゾーン内バス: ゾーンの幅で張られ、箱の中に収まり、ゾーンごと動く', () => {
  const m = parse(INBUS);
  assert.equal(m.errors.length, 0, m.errors.join('/'));
  assert.equal(m.items.find((x) => x.id === 'san').zone, 'サーバ室');
  const L = layout(m);
  const z = L.zones.find((zz) => zz.name === 'サーバ室');
  const bus = L.buses.find((bb) => bb.id === 'san');
  assert.ok(bus.y > z.y && bus.y < z.y + z.h, 'バスはゾーンの中');
  assert.ok(bus.x1 >= z.x && bus.x2 <= z.x + z.w + 1, '幅はゾーン幅');
  // ゾーンの機器を動かす → ゾーンが動く → バスも追従
  const m2 = parse(INBUS + '\n%% @layout\n%% pos a 500 400\n%% pos b 650 400');
  const L2 = layout(m2);
  const z2 = L2.zones.find((zz) => zz.name === 'サーバ室');
  const bus2 = L2.buses.find((bb) => bb.id === 'san');
  assert.ok(bus2.y > z2.y && bus2.x1 >= z2.x, 'ゾーンに追従');
  // 往復でゾーン所属が保たれる
  const m3 = parse(serialize(m));
  assert.equal(m3.items.find((x) => x.id === 'san').zone, 'サーバ室');
});

test('ゾーン内バス: ゾーンを畳むと線は札へ、バスは隠れる', () => {
  const m = parse(INBUS + '\n%% @layout\n%% fold サーバ室');
  const L = layout(m);
  assert.ok(!L.buses.some((b) => b.id === 'san'), 'バスは札の中');
  assert.ok(!L.links.some((l) => l.dot), 'a--san / b--san は札内で消える');
});

test('len: バスの長さを固定できる', () => {
  const m = parse('infra\n  a[A]\n  bus lan[LAN] :h, len 300\n  a -- lan');
  const b = layout(m).buses[0];
  assert.equal(b.x2 - b.x1, 300);
  assert.ok(serialize(m).includes('len 300'));
});

test('zpos: 展開ゾーンも中身ごと自由配置できる（明示 pos は動かさない）', () => {
  const base = parse(INBUS);
  const L0 = layout(base);
  const a0 = L0.nodes.find((n) => n.id === 'a');
  const m = parse(INBUS + '\n%% @layout\n%% zpos サーバ室|400|300');
  const L = layout(m);
  const z = L.zones.find((zz) => zz.name === 'サーバ室');
  const a = L.nodes.find((n) => n.id === 'a');
  assert.notDeepEqual([a.x, a.y], [a0.x, a0.y], '機器がゾーンごと動く');
  assert.ok(a.x >= z.x && a.x + a.w <= z.x + z.w && a.y >= z.y, '枠は中身に追従');
  const bus = L.buses.find((b) => b.id === 'san');
  assert.ok(bus.y > z.y && bus.y < z.y + z.h, 'ゾーン内バスも一緒に動く');
  // 明示 pos を持つ機器は絶対座標のまま
  const m2 = parse(INBUS + '\n%% @layout\n%% zpos サーバ室|400|300\n%% pos b 900 40');
  const b2 = layout(m2).nodes.find((n) => n.id === 'b');
  assert.deepEqual([b2.x, b2.y], [900, 40]);
  // 往復で zpos が残る
  assert.ok(serialize(m).includes('%% zpos サーバ室|400|300'));
});

test('%% lod: 往復し、描画には影響しない（要約はエディタのズームが握る）', () => {
  const m = parse(HUB + '\n%% @layout\n%% lod');
  assert.ok(m.meta.lod);
  assert.ok(serialize(m).includes('%% lod'));
  // detail=false でメタ（OS/IP/VLAN 行）が省かれる
  const m2 = parse('infra\n  a[AP] :server, RHEL9, 10.0.0.1, vlan 10\n  hub w[WAN] :10.0.0.0/8\n  a -- w');
  const L2 = layout(m2);
  const full = draw(m2, L2, {});
  const lite = draw(m2, L2, { detail: false });
  assert.ok(full.length > lite.length, 'ざっくり版は軽い');
});
