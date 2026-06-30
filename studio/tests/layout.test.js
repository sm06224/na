/* レイアウトの検証 — 日付の解決と自動段組みは正しいか・決定的か。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../engine/parse.js';
import { layout, layoutGantt, layoutArch } from '../engine/layout.js';

const G = `kind gantt
start 2026-07-01
  task req "要件" at 2026-07-01 for 5d
  task design "設計" after req for 7d
  task api "API" after design for 10d
  task ui "UI" after design for 12d
  task infra "基盤" at 2026-07-08 for 9d
  task test "検証" after api ui for 6d
  milestone ship "出荷" after test`;

test('ガント：依存から開始日が正しく積み上がる', () => {
  const L = layoutGantt(parse(G));
  const at = (id) => L.bars.find((b) => b.id === id);
  assert.equal(at('req').startDate, '2026-07-01');
  assert.equal(at('design').startDate, '2026-07-06');     // req(5) の後
  assert.equal(at('api').startDay, 12);                   // design(5+7) の後
  assert.equal(at('ui').startDay, 12);
  assert.equal(at('infra').startDay, 7);                  // 絶対日 2026-07-08
  assert.equal(at('test').startDay, 24);                  // max(api 12+10=22, ui 12+12=24)
  assert.equal(at('ship').startDay, 30);                  // test 24+6
  assert.equal(L.errors.length, 0);
});

test('ガント：@layout の at と order が上書きする', () => {
  const m = parse(G);
  m.layout.at.req = '2026-07-03';                         // 手で 2 日ずらす
  m.layout.order = ['design', 'req'];                     // 並びを入れ替え
  const L = layoutGantt(m);
  assert.equal(L.bars.find((b) => b.id === 'req').startDate, '2026-07-03');
  assert.equal(L.bars[0].id, 'design');                  // order 先頭が design
});

test('ガント：循環依存は破綻させず、エラーとして報告する', () => {
  const L = layoutGantt(parse(`kind gantt
  task a "A" after b for 1d
  task b "B" after a for 1d`));
  assert.ok(L.errors.some((e) => /循環|解決/.test(e)));
  for (const b of L.bars) assert.ok(Number.isFinite(b.startDay));      // それでも数は出す
});

test('アーキ：依存の深さで段が決まる（web < gw < service）', () => {
  const m = parse(`kind arch
node web "Web"
node gw "GW"
node auth "Auth"
edge web -> gw
edge gw -> auth`);
  const L = layoutArch(m);
  const x = (id) => L.nodes.find((n) => n.id === id).x;
  assert.ok(x('web') < x('gw'), 'web は gw より左');
  assert.ok(x('gw') < x('auth'), 'gw は auth より左');
  assert.equal(L.edges.length, 2);
});

test('アーキ：@pos があれば自動配置を上書きし、グループが包む', () => {
  const m = parse(`kind arch
node a "A"
node b "B"
group "箱" { a b }
@layout
  pos a 300 200`);
  const L = layoutArch(m);
  const a = L.nodes.find((n) => n.id === 'a');
  assert.equal(a.x, 300); assert.equal(a.y, 200);
  const g = L.groups[0];
  assert.ok(g.x <= a.x && g.y <= a.y && g.x + g.w >= a.x + a.w, 'グループが a を包む');
});

test('決定的：同じモデルからは寸分たがわぬ同じ配置', () => {
  assert.deepEqual(layout(parse(G)), layout(parse(G)));
});
