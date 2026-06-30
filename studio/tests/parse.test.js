/* パーサの検証 — Mermaid 記法を、意味部と @layout に正しく畳めるか。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../engine/parse.js';

test('ガント：tags・id・after・期間・section・milestone を読む', () => {
  const m = parse(`gantt
  title リリース
  dateFormat YYYY-MM-DD
  section 設計
    要件定義 :done, req, 2026-07-01, 5d
    基本設計 :active, design, after req, 7d
  section 実装
    出荷 :milestone, ship, after design, 0d`);
  assert.equal(m.kind, 'gantt');
  assert.equal(m.meta.title, 'リリース');
  assert.equal(m.items.length, 3);
  const a = m.items[0];
  assert.equal(a.id, 'req'); assert.equal(a.label, '要件定義');
  assert.equal(a.status, 'done'); assert.equal(a.at, '2026-07-01'); assert.equal(a.dur, 5);
  assert.equal(a.section, '設計');
  assert.equal(m.items[1].status, 'active');
  assert.deepEqual(m.items[1].after, ['req']);
  assert.equal(m.items[2].type, 'milestone');
  assert.deepEqual(m.items[2].after, ['design']);
  assert.equal(m.errors.length, 0);
});

test('ガント：開始日省略は直前のタスクの後ろ、終了日指定は期間に変換', () => {
  const m = parse(`gantt
  dateFormat YYYY-MM-DD
    A :a, 2026-07-01, 3d
    B :b, 2026-07-04, 2026-07-09
    C :c`);
  assert.deepEqual(m.items[2].after, ['b']);     // 省略 → 直前(B)の後ろ
  assert.equal(m.items[1]._end, '2026-07-09');   // 終了日は layout で期間へ
});

test('フロー：ノード形状・連鎖エッジ・ラベル・点線/太線・subgraph・向き', () => {
  const m = parse(`flowchart LR
  A[四角] --> B(丸)
  B -->|ラベル| C{菱形}
  C -.-> D[(円柱)]
  C ==> E((円))
  subgraph 箱
    D
    E
  end`);
  assert.equal(m.kind, 'flowchart');
  assert.equal(m.meta.dir, 'LR');
  const byId = Object.fromEntries(m.items.map((n) => [n.id, n]));
  assert.equal(byId.A.shape, 'rect'); assert.equal(byId.B.shape, 'round');
  assert.equal(byId.C.shape, 'rhombus'); assert.equal(byId.D.shape, 'cylinder'); assert.equal(byId.E.shape, 'circle');
  assert.equal(byId.B.label, '丸');
  const bc = m.edges.find((e) => e.from === 'B' && e.to === 'C');
  assert.equal(bc.label, 'ラベル');
  assert.ok(m.edges.find((e) => e.to === 'D').dotted);
  assert.ok(m.edges.find((e) => e.to === 'E').thick);
  assert.deepEqual(m.groups[0].ids.sort(), ['D', 'E']);
});

test('@layout：%% コメントから pos・order・at・today を読む（Mermaid からは無視される）', () => {
  const m = parse(`flowchart TD
  A[X]
%% ふつうのコメント
%% @layout
%% pos A 40 120`);
  assert.deepEqual(m.layout.pos.A, [40, 120]);
  const g = parse(`gantt
    A :a, 2026-07-01, 2d
%% @layout
%% order a b
%% at a 2026-07-03
%% today 2026-07-10`);
  assert.deepEqual(g.layout.order, ['a', 'b']);
  assert.equal(g.layout.at.a, '2026-07-03');
  assert.equal(g.meta.today, '2026-07-10');
});

test('壊れた入力は黙らず、正直にエラーを返す', () => {
  assert.ok(parse('').errors.length);                         // 空
  assert.ok(parse('hello world').errors.some((e) => /gantt|flowchart/.test(e)));
});
