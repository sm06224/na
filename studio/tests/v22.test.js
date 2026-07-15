/* ============================================================
   v22 の検証：機器台帳 CSV → infra・拠点の雛形・接続親和レイアウト。
   すべて純粋エンジン（DOM なし・決定的）。
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../engine/parse.js';
import { serialize } from '../engine/serialize.js';
import { layout } from '../engine/layout.js';
import { csvToMermaid, universal } from '../engine/import.js';
import { scaffoldSite, SCAFFOLD_KINDS } from '../engine/scaffold.js';

const INV = `機器名,役割,IP,ゾーン,接続先,VLAN
CORE-1,core,10.1.0.1,東京DC/コア,,10
FW-1,firewall,10.1.0.11,東京DC/コア,CORE-1,10
AP-1,server,10.1.1.1 / 10.1.9.1,東京DC/サーバ,CORE-1,
受注サーバ,サーバー,10.2.0.1,大阪支社,WAN,
支社ルータ,ルーター,10.2.0.254,大阪支社,WAN;CORE-1,`;

test('v22: 機器台帳 CSV → infra（役割・複数IP・入れ子ゾーン・接続先）', () => {
  const r = csvToMermaid(INV);
  assert.equal(r.kind, 'inventory', r.error);
  const m = parse(r.text);
  assert.equal(m.kind, 'infra');
  assert.equal(m.errors.length, 0, m.errors.join(' / '));
  // 入れ子ゾーン：東京DC の下に コア・サーバ
  const dc = m.groups.find((g) => g.name === '東京DC');
  assert.ok(dc, 'ゾーンが生える');
  assert.ok(m.groups.some((g) => g.name === 'コア' && g.parent === '東京DC'), '/ 区切りで入れ子');
  // 役割の日本語ゆらぎ：サーバー → server、ルーター → router
  const ju = m.items.find((x) => x.label === '受注サーバ');
  assert.equal(ju.role, 'server');
  assert.equal(m.items.find((x) => x.label === '支社ルータ').role, 'router');
  // 複数 IP（台帳エクスポートの `a / b` 形式）
  const ap = m.items.find((x) => x.label === 'AP-1');
  assert.deepEqual(ap.ips, ['10.1.1.1', '10.1.9.1']);
  assert.equal(m.items.find((x) => x.label === 'CORE-1').vlan, 10);
  // 接続先：台帳に無い「WAN」は hub として生える。; 区切りで複数もつなげる
  const wan = m.items.find((x) => x.id === 'WAN');
  assert.equal(wan.type, 'hub');
  const eids = m.edges.map((e) => `${e.from}--${e.to}`);
  assert.ok(m.edges.length >= 4, `接続 ${eids.join(', ')}`);
  assert.ok(m.edges.some((e) => e.from === m.items.find((x) => x.label === '支社ルータ').id && e.to === 'WAN'));
  // 決定的
  assert.equal(csvToMermaid(INV).text, r.text);
});

test('v22: 緯度・経度の列があると %% map + %% geo が付いて往復する', () => {
  const csv = `機器名,役割,拠点,緯度,経度
本社コア,core,東京本社,35.68,139.76
支社SW,switch,大阪支社,34.69,135.5`;
  const r = csvToMermaid(csv);
  assert.equal(r.kind, 'inventory');
  assert.ok(r.text.includes('%% map'));
  assert.ok(r.text.includes('%% geo 東京本社|35.68|139.76'), r.text);
  const m = parse(r.text);
  assert.equal(m.errors.length, 0);
  assert.equal(m.meta.map, true);
  assert.deepEqual(m.layout.geo['大阪支社'], [34.69, 135.5]);
  assert.equal(serialize(parse(serialize(m))), serialize(m), '不動点');
});

test('v22: 万能ペーストが台帳を見分ける／既存の from-to・ガントは乗っ取らない', () => {
  const r = universal(INV);
  assert.equal(r.kind, 'table');
  assert.equal(r.sub, 'inventory');
  // from/to はこれまでどおりフローチャート
  assert.equal(csvToMermaid('from,to\nA,B').kind, 'flowchart');
  // 開始・期間の表はこれまでどおりガント
  assert.equal(csvToMermaid('名前,開始,期間\n要件,2026-07-01,5').kind, 'gantt');
});

test('v22: BOM 付き CSV（Excel・自前の台帳エクスポート）も読める', () => {
  const r = csvToMermaid('\uFEFF' + INV);
  assert.equal(r.kind, 'inventory');
  // 台帳の devices.csv ヘッダそのままでも読める（往復の受け皿）
  const dev = 'id,label,role,os,ip,vlan,zone,links,layer\nc1,コア,core,NX-OS,10.0.0.1,10,本社,3,';
  const r2 = csvToMermaid(dev);
  assert.equal(r2.kind, 'inventory');
  const m = parse(r2.text);
  assert.equal(m.errors.length, 0);
  const c = m.items.find((x) => x.id === 'c1');
  assert.deepEqual([c.role, c.os, c.ip, c.vlan, c.zone], ['core', 'NX-OS', '10.0.0.1', 10, '本社']);
});

test('v22: 拠点の雛形——4 種とも自己完結（貼った瞬間からエラーゼロ）・決定的', () => {
  for (const sc of SCAFFOLD_KINDS) {
    const frag = scaffoldSite(sc.key, 'x1', `新${sc.ja}1`, 100);
    const m = parse('infra\n' + frag);
    assert.equal(m.errors.length, 0, `${sc.key}: ${m.errors.join(' / ')}`);
    assert.ok(m.groups.some((g) => g.name === `新${sc.ja}1`), `${sc.key}: 拠点ゾーンが生える`);
    assert.ok(m.items.every((x) => x.type !== 'inode' || x.id.startsWith('x1_')), `${sc.key}: 接頭辞つき`);
    assert.ok(m.edges.length > 0, `${sc.key}: 接続も生える`);
    assert.equal(scaffoldSite(sc.key, 'x1', `新${sc.ja}1`, 100), frag, `${sc.key}: 決定的`);
    // レイアウトも落ちない
    const L = layout(m);
    assert.ok(L.nodes.length > 3);
  }
});

test('v22: 雛形は既存の図に接頭辞を変えて何個でも生やせる（id 衝突なし）', () => {
  const one = scaffoldSite('branch', 'b1', '支店A', 101);
  const two = scaffoldSite('branch', 'b2', '支店B', 102);
  const m = parse('infra\n' + one + '\n' + two);
  assert.equal(m.errors.length, 0, m.errors.join(' / '));
  const ids = m.items.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, 'id が重複しない');
  assert.equal(serialize(parse(serialize(m))), serialize(m), '往復も安定');
});

test('v22: 接続親和レイアウト——同じバスに刺さる機器が隣に寄る', () => {
  // わざと互い違いに宣言する：a,c → lan1 / b,d → lan2
  const D = `infra
    zone 機械室 {
      a[A] :server
      b[B] :server
      c[C] :server
      d[D] :server
      bus lan1[LAN1] :vlan 1, 10.0.1.0/24
      bus lan2[LAN2] :vlan 2, 10.0.2.0/24
    }
    a -- lan1
    b -- lan2
    c -- lan1
    d -- lan2`;
  const L = layout(parse(D));
  const px = (id) => { const n = L.nodes.find((x) => x.id === id); return [n.y, n.x]; };
  const order = ['a', 'b', 'c', 'd'].sort((p, q) => px(p)[0] - px(q)[0] || px(p)[1] - px(q)[1]);
  // lan1 組（a,c）と lan2 組（b,d）がそれぞれ連続する
  const s = order.join('');
  assert.ok(s === 'acbd' || s === 'bdac', `並び ${s}`);
});

test('v22: 接続親和は単一バスの普通のゾーンでは並びを変えない（安定）', () => {
  const D = `infra
    zone z {
      s1[S1] :server
      s2[S2] :server
      s3[S3] :server
      bus lan[LAN] :vlan 1, 10.0.0.0/24
    }
    s1 -- lan
    s2 -- lan
    s3 -- lan`;
  const L = layout(parse(D));
  const x = (id) => L.nodes.find((n) => n.id === id).x;
  assert.ok(x('s1') < x('s2') && x('s2') < x('s3'), '宣言順のまま');
});
