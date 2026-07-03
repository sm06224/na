/* ============================================================
   v8 の検証：インフラ構成図（parse/layout/roundtrip/draw）・SQL 取り込み・
   テーマ（light/dark）・背景色の焼き込み。
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../engine/parse.js';
import { layout } from '../engine/layout.js';
import { serialize } from '../engine/serialize.js';
import { draw } from '../render/draw.js';
import { sniff, universal, sqlToClass } from '../engine/import.js';
import { toDrawio } from '../engine/drawio.js';

const INFRA = `infra
    title 本社ネットワーク
    zone 本社 {
      zone サーバ室 {
        core[CORE-SW] :core, NX-OS10
        app1[APサーバ] :server, RHEL9, 10.0.10.21
      }
      sw3[SW-3F] :access, vlan 30
    }
    inet[Internet] :cloud
    bus lan[基幹LAN] :h, vlan 10, 10.0.10.0/24
    core -- lan
    app1 -- lan
    sw3 -- core`;

// ---- infra: パース -------------------------------------------------------------

test('infra: ゾーンの入れ子・役割/OS/IP/VLAN・バス・接続が読める', () => {
  const m = parse(INFRA);
  assert.equal(m.kind, 'infra');
  assert.equal(m.errors.length, 0, m.errors.join(' / '));
  const app = m.items.find((x) => x.id === 'app1');
  assert.equal(app.role, 'server');
  assert.equal(app.os, 'RHEL9');
  assert.equal(app.ip, '10.0.10.21');
  assert.equal(app.zone, 'サーバ室');
  const sw = m.items.find((x) => x.id === 'sw3');
  assert.equal(sw.vlan, 30);
  assert.equal(sw.zone, '本社');
  const bus = m.items.find((x) => x.id === 'lan');
  assert.equal(bus.type, 'bus');
  assert.equal(bus.orient, 'h');
  assert.equal(bus.vlan, 10);
  assert.equal(bus.cidr, '10.0.10.0/24');
  assert.deepEqual(m.groups.map((g) => [g.name, g.parent]), [['本社', null], ['サーバ室', '本社']]);
  assert.equal(m.edges.length, 3);
});

test('infra: 打ち間違いに早く気づく（未知の接続先・閉じ忘れ・id 重複）', () => {
  const m = parse('infra\n  a[A]\n  a -- ghost\n  zone Z {\n  a[A2]');
  assert.ok(m.errors.some((e) => e.includes('ghost')));
  assert.ok(m.errors.some((e) => e.includes('閉じていない zone')));
  assert.ok(m.errors.some((e) => e.includes('重複')));
});

// ---- infra: レイアウト ----------------------------------------------------------

test('infra: ゾーン枠は中身を包み、親は子ゾーンを包む。バスは本文の下に張られる', () => {
  const m = parse(INFRA);
  const L = layout(m);
  assert.equal(L.kind, 'infra');
  const zone = (n) => L.zones.find((z) => z.name === n);
  const node = (id) => L.nodes.find((x) => x.id === id);
  const inside = (n, z) => n.x >= z.x && n.y >= z.y && n.x + n.w <= z.x + z.w && n.y + n.h <= z.y + z.h;
  assert.ok(inside(node('core'), zone('サーバ室')), 'core はサーバ室の中');
  assert.ok(inside(node('sw3'), zone('本社')), 'sw3 は本社の中');
  const hq = zone('本社'), sv = zone('サーバ室');
  assert.ok(sv.x >= hq.x && sv.y >= hq.y && sv.x + sv.w <= hq.x + hq.w && sv.y + sv.h <= hq.y + hq.h, '親が子を包む');
  const bus = L.buses.find((b) => b.id === 'lan');
  assert.ok(bus.y > Math.max(...L.nodes.map((n) => n.y + n.h)) - 1, 'バスは本文の下');
  assert.equal(L.links.length, 3);
  const stub = L.links.find((l) => l.dot && l.y2 === bus.y);
  assert.ok(stub && stub.x1 === stub.x2, 'バスへの接続は垂線');
  // 決定的
  assert.deepEqual(layout(parse(INFRA)), L);
});

test('infra: ドラッグ（%% pos）に従い、ゾーン枠が中身を追いかける', () => {
  const m = parse(INFRA + '\n%% @layout\n%% pos core 400 300');
  const L = layout(m);
  const core = L.nodes.find((n) => n.id === 'core');
  assert.deepEqual([core.x, core.y], [400, 300]);
  const sv = L.zones.find((z) => z.name === 'サーバ室');
  assert.ok(core.x >= sv.x && core.x + core.w <= sv.x + sv.w, 'ゾーンが追従');
});

// ---- infra: 往復と描画 -----------------------------------------------------------

test('infra: serialize → parse の往復で意味が保たれる', () => {
  const m1 = parse(INFRA);
  const m2 = parse(serialize(m1));
  assert.equal(m2.errors.length, 0, serialize(m1));
  assert.deepEqual(
    m2.items.map((x) => [x.id, x.type, x.role ?? null, x.os ?? null, x.ip ?? null, x.vlan ?? null, x.zone ?? null]),
    m1.items.map((x) => [x.id, x.type, x.role ?? null, x.os ?? null, x.ip ?? null, x.vlan ?? null, x.zone ?? null]));
  assert.deepEqual(m2.edges, m1.edges);
  assert.deepEqual(m2.groups, m1.groups);
});

test('infra: 描画に役割タグ・VLAN・CIDR・ゾーン名が出て、draw.io にも書き出せる', () => {
  const m = parse(INFRA);
  const L = layout(m);
  const svg = draw(m, L, {});
  for (const s of ['CORE', 'SV', 'ACC', 'NET', 'VLAN 30', 'VLAN 10 ・ 10.0.10.0/24', 'サーバ室', 'RHEL9'])
    assert.ok(svg.includes(s), s);
  const xml = toDrawio(m, L);
  assert.ok(xml.includes('mxGraphModel') && xml.includes('CORE-SW') && xml.includes('VLAN 10'));
});

// ---- SQL 取り込み ---------------------------------------------------------------

const SQL = `CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(80),
  price DECIMAL(10,2)
);
CREATE TABLE orders (
  id INT,
  user_id INT REFERENCES users(id),
  PRIMARY KEY (id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);`;

test('SQL: CREATE TABLE → クラス図（PK/FK 印字・外部キーは矢印）', () => {
  assert.equal(sniff(SQL), 'sql');
  const r = universal(SQL);
  assert.equal(r.kind, 'sql');
  const m = parse(r.text);
  assert.equal(m.errors.length, 0, r.text);
  assert.deepEqual(m.items.map((x) => x.id).sort(), ['orders', 'users']);
  const users = m.items.find((x) => x.id === 'users');
  assert.ok(users.attrs.some((a) => /id.*«PK»/.test(a)), users.attrs.join(' / '));
  assert.ok(users.attrs.some((a) => /DECIMAL price/.test(a)), 'DECIMAL 型のカンマで列を切らない');
  assert.ok(m.edges.some((e) => e.from === 'orders' && e.to === 'users'));
});

// ---- テーマ・背景 -----------------------------------------------------------------

test('テーマ: light は紙の配色・dark は従来どおり。%% theme / %% bg は往復する', () => {
  const m = parse('flowchart TD\n    a[A] --> b[B]\n\n%% @layout\n%% theme light\n%% bg #f0f4ff');
  assert.equal(m.meta.theme, 'light');
  assert.equal(m.meta.bg, '#f0f4ff');
  const L = layout(m);
  const light = draw(m, L, { theme: 'light', bg: m.meta.bg });
  const dark = draw(m, L, {});
  assert.ok(light.includes('fill="#f0f4ff"'), '背景が SVG に焼かれる');
  assert.ok(light.includes('#1d2534') && !light.includes('#e7ebf4'), 'light はインクが濃い');
  assert.ok(dark.includes('#e7ebf4') && !dark.includes('fill="#f0f4ff"'), 'dark は従来のまま・背景なし');
  const out = serialize(m);
  assert.ok(out.includes('%% theme light') && out.includes('%% bg #f0f4ff'), out);
  const m2 = parse(out);
  assert.equal(m2.meta.theme, 'light');
  assert.equal(m2.meta.bg, '#f0f4ff');
});

test('テーマ: 全図種が light で描ける（取りこぼしの色がない）', () => {
  for (const src of ['gantt\n  t :t1, 2026-01-01, 3d', 'sequenceDiagram\n  u->>w: hi\n  Note over u: x',
    'classDiagram\n  class A { +int x }\n  A <|-- B', INFRA]) {
    const m = parse(src), L = layout(m);
    const svg = draw(m, L, { theme: 'light', bg: '#ffffff' });
    assert.ok(!svg.includes('#e7ebf4') && !svg.includes('#161b26'), src.split('\n')[0]);
  }
});
