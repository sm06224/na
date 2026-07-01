/* レイアウトの検証 — 日程解決と自動段組みは正しいか・決定的か。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../engine/parse.js';
import { layout, layoutGantt, layoutFlow } from '../engine/layout.js';

const G = `gantt
  dateFormat YYYY-MM-DD
    要件 :req, 2026-07-01, 5d
    設計 :design, after req, 7d
    API  :api, after design, 10d
    UI   :ui, after design, 12d
    基盤 :infra, 2026-07-08, 9d
    検証 :test, after api ui, 6d
    出荷 :milestone, ship, after test, 0d`;

test('ガント：依存から開始日が積み上がる／終了日指定は期間に', () => {
  const L = layoutGantt(parse(G));
  const at = (id) => L.bars.find((b) => b.id === id);
  assert.equal(at('req').startDate, '2026-07-01');
  assert.equal(at('design').startDate, '2026-07-06');
  assert.equal(at('api').startDay, 12);
  assert.equal(at('infra').startDay, 7);
  assert.equal(at('test').startDay, 24);     // max(api 22, ui 24)
  assert.equal(at('ship').startDay, 30);
  assert.equal(L.errors.length, 0);

  const E = layoutGantt(parse(`gantt
  dateFormat YYYY-MM-DD
    X :x, 2026-07-04, 2026-07-09`));
  assert.equal(E.bars[0].dur, 5);            // 終了日 - 開始日
});

test('ガント：@layout の at と order が上書きする', () => {
  const m = parse(G);
  m.layout.at.req = '2026-07-03';
  m.layout.order = ['design', 'req'];
  const L = layoutGantt(m);
  assert.equal(L.bars.find((b) => b.id === 'req').startDate, '2026-07-03');
  assert.equal(L.bars[0].id, 'design');
});

test('ガント：循環依存は破綻させず、エラーとして報告する', () => {
  const L = layoutGantt(parse(`gantt
    A :a, after b, 1d
    B :b, after a, 1d`));
  assert.ok(L.errors.some((e) => /循環|解決/.test(e)));
  for (const b of L.bars) assert.ok(Number.isFinite(b.startDay));
});

test('フロー：TD は深さで縦、LR は深さで横に段組み', () => {
  const td = layoutFlow(parse(`flowchart TD
  A --> B
  B --> C`));
  const y = (id) => td.nodes.find((n) => n.id === id).y;
  assert.ok(y('A') < y('B') && y('B') < y('C'), 'TD は下へ');

  const lr = layoutFlow(parse(`flowchart LR
  A --> B
  B --> C`));
  const x = (id) => lr.nodes.find((n) => n.id === id).x;
  assert.ok(x('A') < x('B') && x('B') < x('C'), 'LR は右へ');
});

test('フロー：@pos が自動配置を上書きし、グループが包む', () => {
  const m = parse(`flowchart TD
  A[A] --> B[B]
  subgraph 箱
    A
    B
  end
%% @layout
%% pos A 300 200`);
  const L = layoutFlow(m);
  const a = L.nodes.find((n) => n.id === 'A');
  assert.equal(a.x, 300); assert.equal(a.y, 200);
  const g = L.groups[0];
  assert.ok(g.x <= a.x && g.y <= a.y, 'グループが A を包む');
});

test('フロー：交差がほどける（barycenter で段の中の並びが整う）', () => {
  // 宣言順のままだと a→q と b→p が交差する形。並び替えで q が左へ来るはず。
  const L = layoutFlow(parse(`flowchart TD
  a[A]
  b[B]
  b --> p[P]
  a --> q[Q]`));
  const x = (id) => L.nodes.find((n) => n.id === id).x;
  assert.ok(x('a') < x('b'), '前段は宣言順のまま');
  assert.ok(x('q') < x('p'), '交差がほどけていない（q が p の左に来ない）');
});

test('フロー：エッジはベジェ曲線（制御点と中点を持つ）', () => {
  const L = layoutFlow(parse(`flowchart LR
  a --> b`));
  const e = L.edges[0];
  for (const k of ['c1x', 'c1y', 'c2x', 'c2y', 'mx', 'my']) assert.ok(Number.isFinite(e[k]), `${k} が無い`);
});

test('決定的：同じモデルからは寸分たがわぬ同じ配置', () => {
  assert.deepEqual(layout(parse(G)), layout(parse(G)));
});
