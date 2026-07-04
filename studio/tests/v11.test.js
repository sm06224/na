/* ============================================================
   v11 の検証：バス/畳みゾーンの自由配置・肘つき接続・
   ラインジャンプ（%% hops）・接続点の丸点（%% dots）。
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../engine/parse.js';
import { layout } from '../engine/layout.js';
import { serialize } from '../engine/serialize.js';
import { draw } from '../render/draw.js';

const SRC = `infra
    zone A {
      n1[サーバ1] :server
      n2[サーバ2] :server
    }
    bus lan[LAN] :h, vlan 10
    bus seg[縦バス] :v
    n1 -- lan
    n2 -- seg
    n1 -- n2`;

test('自由配置: バスは pos [x,y] で両軸動き、長さ（span）は保たれる', () => {
  const base = layout(parse(SRC));
  const b0 = base.buses.find((b) => b.id === 'lan');
  const m = parse(SRC + '\n%% @layout\n%% pos lan -200 480\n%% pos seg 700 -60');
  const L = layout(m);
  const b = L.buses.find((x) => x.id === 'lan');
  assert.deepEqual([b.x1, b.y], [-200, 480], '水平バスが両軸で動く');
  assert.ok(Math.abs((b.x2 - b.x1) - (b0.x2 - b0.x1)) < 1e-9, 'span は不変');
  const v = L.buses.find((x) => x.id === 'seg');
  assert.deepEqual([v.x, v.y1], [700, -60], '垂直バスも両軸で動く');
  assert.ok(L.x0 <= -200, '動かした先まで viewBox が包む');
});

test('自由配置: バスが遠くても接続は肘（elbow）で届き、丸点はバス上に落ちる', () => {
  const m = parse(SRC + '\n%% @layout\n%% pos lan 600 40');
  const L = layout(m);
  const st = L.links.find((l) => l.dot && l.y2 === 40);
  assert.ok(st, 'スタブが生きている');
  const b = L.buses.find((x) => x.id === 'lan');
  assert.ok(st.x2 >= b.x1 + 8 - 1e-9 && st.x2 <= b.x2 - 8 + 1e-9, '終端はバスの範囲内にクランプ');
  assert.ok(st.elbow, '正面から外れているので肘つき');
});

test('自由配置: 畳んだゾーンは %% zpos（|区切り・空白名OK）で動き、往復する', () => {
  const m = parse(SRC + '\n%% @layout\n%% fold A\n%% zpos A|300|-120');
  const L = layout(m);
  const z = L.zones.find((zz) => zz.name === 'A');
  assert.ok(z.folded);
  assert.deepEqual([z.x, z.y], [300, -120]);
  const out = serialize(m);
  assert.ok(out.includes('%% zpos A|300|-120'), out);
  assert.deepEqual(parse(out).layout.zpos, { A: [300, -120] });
});

test('%% hops: 交差する線が ⌒（円弧）で跨ぎ、無ければ直線のまま', () => {
  // n1--n2 の横線が seg（縦バス）を必ず横切る配置を作る
  const src = SRC + '\n%% @layout\n%% pos n1 0 300\n%% pos n2 600 300\n%% pos seg 300 100';
  const plain = draw(parse(src), layout(parse(src)), {});
  const hopped = draw(parse(src), layout(parse(src)), { hops: true });
  assert.ok(!/A6 6 0 0 1/.test(plain), '指定なしは跨がない');
  assert.ok(/A6 6 0 0 1/.test(hopped), '交差に円弧が入る');
  // メタの往復
  const m = parse(src + '\n%% hops');
  assert.ok(m.meta.hops);
  assert.ok(serialize(m).includes('%% hops'));
});

test('%% dots: 接続点の丸点が両端に付き、往復する', () => {
  const m = parse(SRC + '\n%% dots');
  assert.ok(m.meta.dots);
  const L = layout(m);
  const plain = draw(m, L, {});
  const dotted = draw(m, L, { dots: true });
  const count = (s) => (s.match(/<circle[^>]*r="3"/g) || []).length;
  assert.ok(count(dotted) >= count(plain) + 4, `丸点が増える: ${count(plain)} → ${count(dotted)}`);
  assert.ok(serialize(m).includes('%% dots'));
});

test('回帰: 巨大サンプルは新レイアウトでもエラーゼロ・決定的', async () => {
  const { SAMPLES } = await import('../ui/editor.js');
  const src = SAMPLES['巨大 — 全社グランドビュー（IT/OT/クラウド/拠点）'];
  const m = parse(src);
  assert.equal(m.errors.length, 0);
  assert.deepEqual(layout(parse(src)), layout(parse(src)));
  const svg = draw(m, layout(m), { hops: true, dots: true });
  assert.ok(svg.length > 10000);
});
