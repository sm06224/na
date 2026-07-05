/* ============================================================
   v13 の検証：地理マッピング（%% geo / %% map）・ハザードレイヤ（%% hazard）・
   BCP 露出・メガコーポ 1000 ノードサンプル。
   地図の見た目はヘッドレスが受け持ち、ここでは座標・露出・往復・規模を固める。
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../engine/parse.js';
import { layout } from '../engine/layout.js';
import { serialize } from '../engine/serialize.js';
import { draw } from '../render/draw.js';
import { geoProject, geoExposure, geoKm } from '../engine/geo.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const GEO = `infra
    zone 東京本社 {
      a[AP] :server
    }
    zone 大阪DR {
      b[DB] :db
    }
    hub wan[WAN] :vlan 1
    a -- wan
    b -- wan

%% @layout
%% map
%% geo 東京本社|35.68|139.76
%% geo 大阪DR|34.69|135.5
%% geo wan|34.5|142.0`;

test('geo: 投影は決定的で、東西南北が保たれる', () => {
  const tokyo = geoProject(35.68, 139.76), osaka = geoProject(34.69, 135.5), sapporo = geoProject(43.06, 141.35);
  assert.ok(tokyo[0] > osaka[0], '東京は大阪より東（x 大）');
  assert.ok(sapporo[1] < tokyo[1], '札幌は東京より北（y 小）');
  assert.deepEqual(geoProject(35.68, 139.76), tokyo, '決定的');
  assert.ok(Math.abs(geoKm([35.68, 139.76], [34.69, 135.5]) - 400) < 40, '東京–大阪 ≒ 400km');
});

test('%% map + %% geo: ゾーンが実座標に立ち、ハブも置ける・往復する', () => {
  const m = parse(GEO);
  assert.equal(m.errors.length, 0, m.errors.join('/'));
  assert.ok(m.meta.map);
  const L = layout(m);
  const z = L.zones.find((zz) => zz.name === '東京本社');
  const [gx, gy] = geoProject(35.68, 139.76);
  assert.ok(Math.abs(z.x + z.w / 2 - gx) < 30 && Math.abs(z.y + z.h / 2 - gy) < 30, 'ゾーン中心 ≒ 投影点');
  const hub = L.nodes.find((n) => n.id === 'wan');
  const [hx, hy] = geoProject(34.5, 142.0);
  assert.ok(Math.abs(hub.x + hub.r - hx) < 2 && Math.abs(hub.y + hub.r - hy) < 2, 'ハブは点に一致');
  const s = serialize(m);
  assert.ok(s.includes('%% map') && s.includes('%% geo 東京本社|35.68|139.76'));
  assert.deepEqual(layout(parse(s)).zones.find((zz) => zz.name === '東京本社').x, z.x, '往復で安定');
});

test('%% map: zpos の手直しが geo より勝つ・中の機器も一緒に動く', () => {
  const m = parse(GEO + '\n%% zpos 東京本社|100|100');
  const L = layout(m);
  const z = L.zones.find((zz) => zz.name === '東京本社');
  const [gx] = geoProject(35.68, 139.76);
  assert.ok(Math.abs(z.x + z.w / 2 - gx) > 100, 'geo の位置から離れている（zpos が勝つ）');
  const a = L.nodes.find((n) => n.id === 'a');
  assert.ok(a.x >= z.x && a.x + a.w <= z.x + z.w, '機器はゾーンの中');
});

test('hazard: BCP 露出——首都直下は東京に刺さり、大阪には刺さらない', () => {
  const ex = geoExposure([
    { name: '東京本社', lat: 35.68, lng: 139.76 },
    { name: '大阪DR', lat: 34.69, lng: 135.5 },
    { name: '鹿児島支店', lat: 31.6, lng: 130.55 },
    { name: '那覇支店', lat: 26.21, lng: 127.68 },
  ]);
  const hits = (n) => ex.find((s) => s.name === n).hits.map((h) => h.name).join(' / ');
  assert.ok(hits('東京本社').includes('首都直下'), hits('東京本社'));
  assert.ok(!hits('大阪DR').includes('首都直下'), hits('大阪DR'));
  assert.ok(hits('鹿児島支店').includes('桜島'), hits('鹿児島支店'));
  assert.ok(hits('那覇支店').includes('シーレーン'), hits('那覇支店'));
  // レイヤ絞り込み：quake だけなら桜島（volcano）は消える
  const only = geoExposure([{ name: '鹿児島支店', lat: 31.6, lng: 130.55 }], ['quake']);
  assert.ok(!only[0].hits.some((h) => h.name.includes('桜島')));
});

test('draw: %% map でベースマップ、%% hazard でレイヤが乗る（無指定なら乗らない）', () => {
  const m = parse(GEO);
  const svg = draw(m, layout(m), {});
  assert.ok(svg.includes('stroke-linejoin="round"'), '列島の輪郭が描かれる');
  assert.ok(!svg.includes('南海トラフ'), 'ハザード無指定なら乗らない');
  const m2 = parse(GEO + '\n%% hazard quake|volcano');
  assert.deepEqual(m2.meta.hazard, ['quake', 'volcano']);
  const svg2 = draw(m2, layout(m2), {});
  assert.ok(svg2.includes('南海トラフ') && svg2.includes('富士山'), 'quake/volcano レイヤ');
  assert.ok(!svg2.includes('シーレーン'), 'geopol は消灯のまま');
  assert.ok(serialize(m2).includes('%% hazard quake|volcano'), '往復');
});

test('メガコーポ: 1000+ 機器・40 拠点が読めて・速くて・安定して往復する', () => {
  const dsl = readFileSync(join(HERE, '..', 'examples', 'megacorp.mmd'), 'utf8');
  const t0 = performance.now();
  const m = parse(dsl);
  const L = layout(m);
  const dt = performance.now() - t0;
  assert.equal(m.errors.length, 0, m.errors.slice(0, 3).join(' / '));
  const devices = m.items.filter((x) => x.type === 'inode' || x.type === 'hub').length;
  assert.ok(devices >= 1000, `機器 ${devices} >= 1000（v10 サンプルの約 20 倍）`);
  assert.ok(m.groups.length >= 100, `ゾーン ${m.groups.length}`);
  assert.ok(dt < 3000, `parse+layout ${Math.round(dt)}ms < 3s`);
  const s1 = serialize(m), m2 = parse(s1);
  assert.equal(m2.errors.length, 0);
  assert.equal(m2.items.length, m.items.length, '往復で項目が増減しない');
  assert.equal(serialize(m2), s1, '2 回目の往復は不動点');
  assert.ok(L.map && L.map.exposure.some((s) => s.name === '東京本社' && s.hits.length), 'BCP 露出が出る');
});

test('fence: ゾーン内宣言はゾーンに沿って立ち、畳むと隠れ、往復で残る', () => {
  const F = 'infra\n  zone 工場 {\n    a[PLC] :plc\n    fence f1[保守分界] :v\n  }\n  b[外部] :cloud\n  b -- a';
  const m = parse(F);
  assert.equal(m.items.find((x) => x.id === 'f1').zone, '工場');
  const L = layout(m);
  const z = L.zones.find((zz) => zz.name === '工場');
  const f = L.fences.find((ff) => ff.id === 'f1');
  assert.ok(f.x > z.x && f.x < z.x + z.w, 'ゾーンの中に立つ');
  assert.ok(Math.abs(f.y1 - z.y) < 20 && Math.abs(f.y2 - (z.y + z.h)) < 20, 'ゾーンの高さに沿う');
  const m2 = parse(serialize(m));
  assert.equal(m2.items.find((x) => x.id === 'f1').zone, '工場', serialize(m));
  const Lf = layout(parse(F + '\n%% @layout\n%% fold 工場'));
  assert.ok(!Lf.fences.some((ff) => ff.id === 'f1'), '畳んだら札の中');
});

test('回帰: ゾーン外ハブが二重に書き出されない（infraBody）', () => {
  const m = parse('infra\n  zone z {\n    a[A]\n  }\n  hub w[WAN] :vlan 1\n  a -- w');
  const s = serialize(m);
  assert.equal((s.match(/hub w\[WAN\]/g) || []).length, 1, s);
  assert.equal(parse(s).items.length, m.items.length);
});
