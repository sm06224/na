/* ============================================================
   v9 の検証：無限キャンバス（viewBox が中身を追う）・OT/SCADA 役割・
   ゾーン折りたたみ（%% fold）・ライン識別（冗長/予備/VLAN/多重）・保守分界フェンス。
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../engine/parse.js';
import { layout } from '../engine/layout.js';
import { serialize } from '../engine/serialize.js';
import { draw } from '../render/draw.js';

const OT = `infra
    zone IT {
      core[CORE] :core
    }
    zone OT {
      scada[SCADA] :scada, Win2019
      plc1[PLC-L1] :plc, vlan 110
      sen1[センサ群] :sensor
      diode[データダイオード] :diode
    }
    bus ctl[制御LAN] :h, vlan 100, 192.168.100.0/24
    fence f1[保守分界] :v
    scada -- ctl :冗長
    plc1 -- ctl :冗長, vlan 100
    plc1 -- sen1
    core -- scada :一方向
    core -- scada :予備, バックアップ経路`;

// ---- 無限キャンバス --------------------------------------------------------------

test('無限キャンバス: 負座標へドラッグしても viewBox が包む（flowchart / infra）', () => {
  const f = parse('flowchart TD\n  a[A] --> b[B]\n%% @layout\n%% pos a -300 -200');
  const Lf = layout(f);
  assert.ok(Lf.x0 <= -300 && Lf.y0 <= -200, `flow x0=${Lf.x0} y0=${Lf.y0}`);
  const svg = draw(f, Lf, {});
  assert.ok(svg.includes(`viewBox="${Math.floor(Lf.x0)} ${Math.floor(Lf.y0)}`), 'viewBox が bbox 起点');
  const i = parse(OT + '\n%% @layout\n%% pos core -500 -400');
  const Li = layout(i);
  assert.ok(Li.x0 <= -500 && Li.y0 <= -400, `infra x0=${Li.x0} y0=${Li.y0}`);
});

test('無限キャンバス: 上端に余白がある（既定でも切れない）', () => {
  const L = layout(parse(OT));
  assert.ok(L.y0 <= -20, `y0=${L.y0}（上にゆとり）`);
  assert.ok(L.x0 <= -10, `x0=${L.x0}`);
});

// ---- OT / SCADA ------------------------------------------------------------------

test('OT 役割: scada/plc/sensor/diode/hmi/historian… が認識されタグになる', () => {
  const m = parse(OT);
  assert.equal(m.errors.length, 0, m.errors.join(' / '));
  assert.equal(m.items.find((x) => x.id === 'scada').role, 'scada');
  assert.equal(m.items.find((x) => x.id === 'plc1').role, 'plc');
  assert.equal(m.items.find((x) => x.id === 'sen1').role, 'sensor');
  assert.equal(m.items.find((x) => x.id === 'diode').role, 'diode');
  const svg = draw(m, layout(m), {});
  for (const t of ['SCD', 'PLC', 'SEN', 'DIO']) assert.ok(svg.includes(`>${t}</text>`), t);
});

// ---- ライン識別 ------------------------------------------------------------------

test('ライン識別: 冗長=二重線・予備=破線・一方向=矢印・VLAN=チップ・自由ラベル', () => {
  const m = parse(OT);
  const e1 = m.edges.find((e) => e.from === 'scada');
  assert.ok(e1.redundant);
  const e2 = m.edges.find((e) => e.from === 'plc1' && e.to === 'ctl');
  assert.ok(e2.redundant && e2.vlan === 100);
  const e4 = m.edges.filter((e) => e.from === 'core');
  assert.ok(e4[0].arrow, '一方向');
  assert.ok(e4[1].dashed && e4[1].label === 'バックアップ経路', '予備＋ラベル');
  const svg = draw(m, layout(m), {});
  assert.ok(svg.includes('VLAN 100'), 'VLAN チップ');
  assert.ok(svg.includes('バックアップ経路'), '自由ラベル');
  assert.ok(svg.includes('stroke-dasharray="6 5"'), '予備の破線');
  assert.ok(svg.includes('marker-end="url(#arrow)"'), '一方向の矢印');
});

test('ライン識別: 冗長は平行二重線、同じ 2 点間の多重はずらして描く', () => {
  const m = parse(OT);
  const L = layout(m);
  // core -- scada が 2 本 → 端点がずれて重ならない
  const pair = L.links.filter((l) => !l.dot && l.e && (l.e.arrow || l.e.dashed));
  assert.equal(pair.length, 2);
  assert.ok(pair[0].y1 !== pair[1].y1 || pair[0].x1 !== pair[1].x1, '多重線がオフセットされる');
  const svg = draw(m, L, {});
  // 冗長 1 本の DSL 記述 → line 2 本（scada--ctl の垂線が二重）
  const stubs = (svg.match(/<path[^>]*stroke-width="1.5"/g) || []).length;
  assert.ok(stubs >= 4, `二重線ぶん本数が増える: ${stubs}`);
});

// ---- ゾーン折りたたみ --------------------------------------------------------------

test('折りたたみ: %% fold で中身が隠れ、札になり、線は札へ付け替え。往復もする', () => {
  const src = OT + '\n%% @layout\n%% fold OT';
  const m = parse(src);
  assert.deepEqual(m.layout.fold, ['OT']);
  const L = layout(m);
  assert.ok(!L.nodes.some((n) => ['scada', 'plc1', 'sen1'].includes(n.id)), '中の機器は消える');
  const oz = L.zones.find((z) => z.name === 'OT');
  assert.ok(oz.folded && oz.count === 4, `札に台数: ${oz.count}`);
  // plc1--sen1 は両方 OT の中 → 線ごと消える。scada--ctl / plc1--ctl は札→バスに畳まれる
  const busStubs = L.links.filter((l) => l.dot);
  assert.ok(busStubs.length >= 1, '札からバスへの線が残る');
  const svg = draw(m, L, {});
  assert.ok(svg.includes('>OT<tspan') && svg.includes('4 台') && svg.includes('>▸</text>'), '札の表示（名前・台数・開くキャレット）');
  assert.ok(svg.includes('data-fold="OT"'), 'タップで開ける');
  const out = serialize(m);
  assert.ok(out.includes('%% fold OT'), out);
  assert.deepEqual(parse(out).layout.fold, ['OT']);
});

test('折りたたみ: 空白入りのゾーン名も | 区切りで往復する', () => {
  const src = 'infra\n  zone 3F 営業部 {\n    a[A]\n  }\n  zone サーバ室 {\n    b[B]\n  }\n%% @layout\n%% fold 3F 営業部|サーバ室';
  const m = parse(src);
  assert.deepEqual(m.layout.fold, ['3F 営業部', 'サーバ室']);
  const L = layout(m);
  assert.equal(L.nodes.length, 0);
  assert.ok(serialize(m).includes('%% fold 3F 営業部|サーバ室'));
});

// ---- フェンス ----------------------------------------------------------------------

test('フェンス: 保守分界の縦線が立ち、ドラッグ（pos）で動き、往復する', () => {
  const m = parse(OT);
  const f = m.items.find((x) => x.type === 'fence');
  assert.equal(f.label, '保守分界');
  const L = layout(m);
  const lf = L.fences[0];
  assert.equal(lf.orient, 'v');
  assert.ok(lf.y2 > lf.y1, '縦に張られる');
  const svg = draw(m, L, {});
  assert.ok(svg.includes('⚑ 保守分界') && svg.includes('stroke-dasharray="12 6"'));
  assert.ok(svg.includes(`data-id="f1"`), 'ドラッグできる');
  const m2 = parse(OT + '\n%% @layout\n%% pos f1 640 0');
  assert.equal(layout(m2).fences[0].x, 640);
  const m3 = parse(serialize(m));
  assert.ok(m3.items.some((x) => x.type === 'fence' && x.label === '保守分界'));
});

// ---- 往復（ライン属性つき） ---------------------------------------------------------

test('往復: 冗長・予備・一方向・vlan・ラベルつきの接続が保たれる', () => {
  const m1 = parse(OT);
  const m2 = parse(serialize(m1));
  assert.equal(m2.errors.length, 0, serialize(m1));
  const key = (e) => [e.from, e.to, !!e.redundant, !!e.dashed, !!e.arrow, e.vlan ?? null, e.label ?? null].join('|');
  assert.deepEqual(m2.edges.map(key).sort(), m1.edges.map(key).sort());
});
