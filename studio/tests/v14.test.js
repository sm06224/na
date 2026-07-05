/* ============================================================
   v14 の検証：レイヤ・関係線・冗長種別・両端 IP・台帳（IPAM）・ファイルセット。
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
import { ledgerDevices, ledgerIpam, ledgerCsv } from '../engine/ledger.js';
import { splitInfra, mergeInfra, zipStore } from '../engine/fileset.js';

const HERE = dirname(fileURLToPath(import.meta.url));

const V14 = `infra
    zone 東京 {
      c1[CORE-1] :core
      c2[CORE-2] :core
      db1[DB-1] :db, RHEL9, 10.1.1.6, 10.99.0.6
      mon[監視] :server, 10.1.1.6
      bus lan[基幹] :vlan 10, 10.1.1.0/24
    }
    zone 大阪 {
      db2[DB-DR] :db, 10.2.1.6
    }
    fw[FW] :firewall, layer 待機系
    c1 -- c2 :stack
    c1 -- fw :vrrp
    c1 -- lan
    db1 -- lan
    mon -- lan
    c1 -- db2 :lacp, 10.1.1.1 > 10.2.1.254, 拠点間
    db1 -- db2 :rep, 10.99.0.6 > 10.99.0.7, 非同期`;

test('v14: 冗長種別・関係線・両端IP・複数IP・layer が読めて往復する', () => {
  const m = parse(V14);
  assert.equal(m.errors.length, 0, m.errors.join('/'));
  assert.equal(m.edges.find((e) => e.redType === 'stack').redundant, true);
  assert.equal(m.edges.filter((e) => e.redundant).length, 3, 'stack/vrrp/lacp');
  const rep = m.edges.find((e) => e.rel === 'rep');
  assert.deepEqual([rep.ipFrom, rep.ipTo, rep.label], ['10.99.0.6', '10.99.0.7', '非同期']);
  assert.deepEqual(m.items.find((x) => x.id === 'db1').ips, ['10.1.1.6', '10.99.0.6']);
  assert.equal(m.items.find((x) => x.id === 'fw').layer, '待機系');
  const s = serialize(m);
  assert.ok(s.includes(':stack') && s.includes('rep, ') && s.includes('10.99.0.6 > 10.99.0.7') && s.includes('layer 待機系'), s);
  assert.equal(serialize(parse(s)), s, '不動点');
});

test('v14 描画: バスは線の下・関係線は曲線 ⟳・冗長は種別チップ・IPは線の根元にホスト部', () => {
  const m = parse(V14);
  const svg = draw(m, layout(m), {});
  // バスの線（stroke-width="5"）は接続の <path> より先に描かれる
  assert.ok(svg.indexOf('stroke-width="5"') < svg.indexOf('stroke-width="1.5"'), 'バスが下、線が上');
  assert.ok(svg.includes('⟳') && svg.includes(' Q'), '関係線は曲線＋⟳');
  assert.ok(svg.includes('>VRRP<') && svg.includes('拠点間 ・ LACP'), '冗長種別チップ（ラベルと併記）');
  assert.ok(svg.includes('>.6') && svg.includes('<title>10.1.1.6</title>'), '機器のIPはホスト部が線側・フルは title');
  // 関係線は rel レイヤ消灯で消える。net を消すと通常線が消えて関係線は残る
  const relOff = draw(parse(V14 + '\n\n%% @layout\n%% layers off rel'), layout(m), {});
  assert.ok(!relOff.includes('⟳'));
  const netOff = draw(parse(V14 + '\n\n%% @layout\n%% layers off net'), layout(m), {});
  assert.ok(netOff.includes('⟳') && !netOff.includes('>VRRP<'));
  // 自由レイヤ：待機系を消すと fw と vrrp 線が消える
  const lyOff = draw(parse(V14 + '\n\n%% @layout\n%% layers off 待機系'), layout(m), {});
  assert.ok(!lyOff.includes('FW') && !lyOff.includes('>VRRP<'), '待機系レイヤごと消える');
  assert.ok(serialize(parse(V14 + '\n\n%% @layout\n%% layers off rel|待機系')).includes('%% layers off rel|待機系'), '往復');
});

test('台帳: 機器台帳とIPAM——重複 ⚠・次の空き・未収容・CSV', () => {
  const m = parse(V14);
  const devs = ledgerDevices(m);
  const db1 = devs.find((d) => d.id === 'db1');
  assert.deepEqual(db1.ips.slice(0, 2), ['10.1.1.6', '10.99.0.6']);
  assert.ok(db1.links >= 2);
  const { nets, orphans } = ledgerIpam(m);
  const lan = nets.find((n) => n.id === 'lan');
  assert.ok(lan.rows.some((r) => r.ip === '10.1.1.6' && r.dup), 'db1 と mon の 10.1.1.6 重複を検知');
  assert.equal(lan.free, '10.1.1.2', '次の空き（.1 は使用済み）');
  assert.ok(orphans.some((o) => o.ip === '10.99.0.6'), '10.99.x は未収容');
  const csv = ledgerCsv(['a', 'b'], [['x,y', 'z"w']]);
  assert.ok(csv.includes('"x,y"') && csv.includes('"z""w"'), 'CSV エスケープ');
});

test('ファイルセット: メガコーポを拠点ごとに割って、束ねると元に戻る', () => {
  const dsl = readFileSync(join(HERE, '..', 'examples', 'megacorp.mmd'), 'utf8');
  const m = parse(dsl);
  const files = splitInfra(m);
  assert.ok(files.length >= 41 && files.at(-1).name === '_shared.mmd', `${files.length} ファイル`);
  for (const f of files.slice(0, -1)) {                        // 拠点パーツは単体で開ける
    const p = parse(f.text);
    assert.equal(p.errors.length, 0, `${f.name}: ${p.errors[0] || ''}`);
  }
  const merged = parse(mergeInfra(files.map((f) => f.text)));
  assert.equal(merged.errors.length, 0);
  assert.equal(merged.items.length, m.items.length, '機器が落ちない');
  assert.equal(merged.edges.length, m.edges.length, '接続が落ちない');
  assert.equal(Object.keys(merged.layout.geo || {}).length, Object.keys(m.layout.geo || {}).length, 'geo が残る');
  assert.ok(merged.meta.map && merged.meta.lod, 'map/lod が残る');
  const zip = zipStore(files.slice(0, 3));
  assert.ok(zip[0] === 0x50 && zip[1] === 0x4b, 'ZIP シグネチャ');
});

test('v14: %% tiles（実地図タイル）と geoUnproject の往復', async () => {
  const m = parse('infra\n  a[A]\n\n%% @layout\n%% map\n%% tiles\n%% geo a|35.68|139.76');
  assert.ok(m.meta.tiles);
  assert.ok(serialize(m).includes('%% tiles'));
  const { geoProject, geoUnproject } = await import('../engine/geo.js');
  const [x, y] = geoProject(35.68, 139.76);
  const [lat, lng] = geoUnproject(x, y);
  assert.ok(Math.abs(lat - 35.68) < 0.01 && Math.abs(lng - 139.76) < 0.01, `逆投影 ${lat},${lng}`);
});

test('回帰: ミラー系の旧記法（hist2 -- hist :ミラー）は関係線として読める', () => {
  const m = parse('infra\n  a[A]\n  b[B]\n  a -- b :ミラー');
  assert.equal(m.edges[0].rel, 'mirror');
  const svg = draw(m, layout(m), {});
  assert.ok(svg.includes('⟳ ミラー'));
});
