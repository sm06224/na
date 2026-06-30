/* パーサの検証 — DSL を、意味部と @layout に正しく畳めるか。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../engine/parse.js';

test('ガント：kind・メタ・タスク・セクション・依存・done を読む', () => {
  const m = parse(`kind gantt
title リリース
start 2026-07-01
section 設計
  task a "要件 定義" at 2026-07-01 for 5d done 60
  task b "基本設計" after a for 7d
  milestone ship "出荷" after b`);
  assert.equal(m.kind, 'gantt');
  assert.equal(m.meta.title, 'リリース');
  assert.equal(m.meta.start, '2026-07-01');
  assert.equal(m.items.length, 3);
  const a = m.items[0];
  assert.equal(a.id, 'a');
  assert.equal(a.label, '要件 定義');          // 引用符の中の空白は保たれる
  assert.equal(a.at, '2026-07-01');
  assert.equal(a.dur, 5);
  assert.equal(a.done, 60);
  assert.equal(a.section, '設計');
  assert.deepEqual(m.items[1].after, ['a']);
  assert.equal(m.items[2].type, 'milestone');
  assert.equal(m.errors.length, 0);
});

test('アーキ：ノード・連鎖エッジ・グループを読む', () => {
  const m = parse(`kind arch
node web "Web"
node gw "GW"
node db "DB"
edge web -> gw -> db
group "裏方" { gw db }`);
  assert.equal(m.kind, 'arch');
  assert.equal(m.items.filter((i) => i.type === 'node').length, 3);
  assert.deepEqual(m.edges, [{ from: 'web', to: 'gw' }, { from: 'gw', to: 'db' }]); // 連鎖は分解
  assert.deepEqual(m.groups[0], { name: '裏方', ids: ['gw', 'db'] });
});

test('注釈と空行は無視され、行末 # も切られる', () => {
  const m = parse(`kind gantt
# これは注釈
  task a "X" for 2d   # 末尾注釈
`);
  assert.equal(m.items.length, 1);
  assert.equal(m.items[0].label, 'X');
  assert.equal(m.items[0].dur, 2);
});

test('@layout トレイラ：pos・order・at を読む', () => {
  const m = parse(`kind arch
node a "A"
@layout
  pos a 40 120
  order a b c
  at a 2026-07-09`);
  assert.deepEqual(m.layout.pos.a, [40, 120]);
  assert.deepEqual(m.layout.order, ['a', 'b', 'c']);
  assert.equal(m.layout.at.a, '2026-07-09');
});

test('壊れた入力は黙らず、正直にエラーを返す', () => {
  assert.ok(parse(`task a "X"`).errors.some((e) => /kind/.test(e)));   // kind 宣言なし
  assert.ok(parse(`kind arch
edge lonely`).errors.some((e) => /edge/.test(e)));                       // 片側だけの edge
});
