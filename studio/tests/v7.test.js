/* ============================================================
   v7 の検証：万能ペースト（判別と変換）・モデル diff・手描きモード・style 往復。
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sniff, universal, arrowsToFlow, outlineToFlow, jsonToFlow } from '../engine/import.js';
import { diffModels } from '../engine/diff.js';
import { parse } from '../engine/parse.js';
import { serialize } from '../engine/serialize.js';
import { layout } from '../engine/layout.js';
import { draw } from '../render/draw.js';

// ---- 万能ペースト ------------------------------------------------------------

test('sniff：貼られたものを当てる（Mermaid・表・矢印・箇条書き・JSON・ただの文章）', () => {
  assert.equal(sniff('flowchart TD\n  a --> b'), 'mermaid');
  assert.equal(sniff('名前,開始,期間\nA,2026-01-01,3'), 'table');
  assert.equal(sniff('入口 -> 検査 -> 出荷\n検査 -> 廃棄: 不合格'), 'arrows');
  assert.equal(sniff('計画\n- 設計\n- 実装\n  - API\n  - UI'), 'outline');
  assert.equal(sniff('{"a": {"b": 1}}'), 'json');
  assert.equal(sniff('こんにちは。今日はいい天気です。'), 'unknown');   // 文章は乗っ取らない
  assert.equal(sniff(''), 'unknown');
});

test('矢印テキスト → フロー：多段ホップと末尾ラベル', () => {
  const dsl = arrowsToFlow('入口 -> 検査 -> 出荷\n検査 --> 廃棄: 不合格');
  const m = parse(dsl);
  assert.equal(m.kind, 'flowchart');
  assert.equal(m.errors.length, 0, dsl);
  assert.equal(m.items.length, 4);                                       // 入口・検査・出荷・廃棄
  assert.equal(m.edges.length, 3);
  assert.ok(m.edges.some((e) => e.label === '不合格'));
});

test('箇条書き → ツリー：字下げが親子になる', () => {
  const dsl = outlineToFlow('サービス\n- フロント\n  - Web\n  - モバイル\n- バックエンド\n  - API');
  const m = parse(dsl);
  assert.equal(m.errors.length, 0, dsl);
  assert.equal(m.items.length, 6);
  assert.equal(m.edges.length, 5);                                       // 根から 5 本の枝
  const ids = new Map(m.items.map((x) => [x.label, x.id]));
  assert.ok(m.edges.some((e) => e.from === ids.get('フロント') && e.to === ids.get('Web')));
});

test('JSON → 構造ツリー：入れ子が枝、末端は key: value', () => {
  const { text } = jsonToFlow('{"api": {"port": 8080, "routes": ["a", "b"]}}');
  const m = parse(text);
  assert.equal(m.errors.length, 0, text);
  assert.ok(m.items.some((x) => /port: 8080/.test(x.label)));
  assert.ok(m.items.some((x) => /routes（2）/.test(x.label)));
});

test('universal：判別 → 変換まで一息。すべて parse が通る', () => {
  for (const [src, kind] of [
    ['flowchart TD\n  a --> b', 'mermaid'],
    ['from,to\nA,B', 'table'],
    ['A -> B -> C', 'arrows'],
    ['親\n- 子1\n- 子2', 'outline'],
    ['[1,2,3]', 'json'],
  ]) {
    const r = universal(src);
    assert.equal(r.kind, kind, src);
    assert.equal(parse(r.text).errors.length, 0, r.text);
  }
  assert.equal(universal('ただの文です。').kind, 'unknown');
});

// ---- モデル diff --------------------------------------------------------------

test('diff：ノードの追加・削除・改名（changed）とエッジの増減を見分ける', () => {
  const a = parse('flowchart TD\n  a[甲] --> b[乙]\n  b --> c[丙]');
  const b = parse('flowchart TD\n  a[甲] --> b[乙改]\n  a --> d[丁]');
  const r = diffModels(a, b);
  assert.deepEqual(r.added.filter((x) => x.what === 'item').map((x) => x.id), ['d']);
  assert.deepEqual(r.removed.filter((x) => x.what === 'item').map((x) => x.id), ['c']);
  assert.deepEqual(r.changed.filter((x) => x.what === 'item').map((x) => x.id), ['b']);   // ラベル変化
  assert.ok(r.added.some((x) => x.what === 'edge' && x.id.startsWith('a d')));
  assert.ok(r.removed.some((x) => x.what === 'edge' && x.id.startsWith('b c')));
  assert.ok(r.addedIds.has('d') && r.changedIds.has('b'));
});

test('diff：並び替えや空白は差と数えない（テキスト diff との違い）', () => {
  const a = parse('flowchart TD\n  a[A] --> b[B]\n  c[C]');
  const b = parse('flowchart TD\n  c[C]\n\n  a[A]   -->   b[B]');
  const r = diffModels(a, b);
  assert.equal(r.added.length + r.removed.length + r.changed.length, 0);
});

test('diff：シーケンスのメッセージは多重集合（同文 2 回 → 1 回 = 1 本削除）', () => {
  const a = parse('sequenceDiagram\n  u->>w: ping\n  u->>w: ping\n  w-->>u: pong');
  const b = parse('sequenceDiagram\n  u->>w: ping\n  w-->>u: pong\n  w->>d: query');
  const r = diffModels(a, b);
  assert.equal(r.removed.filter((x) => x.what === 'msg').length, 1);
  assert.equal(r.added.filter((x) => x.what === 'msg').length, 1);
  assert.ok(r.added[r.added.length - 1].label.includes('query') || r.added.some((x) => x.label?.includes('query')));
});

test('diff：図種が違えば正直に kindChanged', () => {
  const r = diffModels(parse('gantt\n  a :t1, 2026-01-01, 3d'), parse('flowchart TD\n  a'));
  assert.ok(r.kindChanged);
});

// ---- 手描きモード -------------------------------------------------------------

test('手描き：opts.sketch で全図種に揺らぎフィルタが乗る（決定的）', () => {
  for (const src of ['flowchart TD\n  a[A] --> b[B]', 'gantt\n  t :t1, 2026-01-01, 3d',
    'sequenceDiagram\n  u->>w: hi', 'classDiagram\n  class A']) {
    const m = parse(src), L = layout(m);
    const plain = draw(m, L, {});
    const sketch = draw(m, L, { sketch: true });
    assert.ok(!plain.includes('feTurbulence'), 'plain に揺らぎなし');
    assert.ok(sketch.includes('feTurbulence') && sketch.includes('url(#sketch)'), src);
    assert.equal(draw(m, L, { sketch: true }), sketch, '同じ入力 → 同じ揺れ');
  }
});

test('style：%% style sketch が往復で保たれ、意味部を汚さない', () => {
  const src = 'flowchart TD\n    a[A] --> b[B]\n\n%% @layout\n%% style sketch\n';
  const m = parse(src);
  assert.equal(m.meta.style, 'sketch');
  const out = serialize(m);
  assert.ok(out.includes('%% style sketch'), out);
  assert.equal(parse(out).meta.style, 'sketch');
  // style を外せばトレーラから消える
  m.meta.style = null;
  assert.ok(!serialize(m).includes('%% style'));
});
