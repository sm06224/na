/* クラス図の検証 — UML の箱と関係を正しく読み、積み、往復できるか。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../engine/parse.js';
import { layoutClass } from '../engine/layout.js';
import { serialize } from '../engine/serialize.js';

const SRC = `classDiagram
    class Animal {
      +String name
      +speak() string
    }
    class Dog
    Animal <|-- Dog
    Dog o-- Leash
    Owner --> Animal : 飼う
    Cat ..> Owner
    Animal : +int age
`;

test('パース：class ブロック・一行メンバ・属性/メソッドの区画分け・自動宣言', () => {
  const m = parse(SRC);
  assert.equal(m.kind, 'class');
  const a = m.items.find((x) => x.id === 'Animal');
  assert.deepEqual(a.attrs, ['+String name', '+int age']);   // ブロック＋一行メンバ
  assert.deepEqual(a.methods, ['+speak() string']);          // () があればメソッド区画
  assert.ok(m.items.some((x) => x.id === 'Leash'), '関係に登場した Leash が自動宣言される');
  assert.equal(m.errors.length, 0);
});

test('パース：関係演算子が from→to（to 側に印）へ正規化される', () => {
  const m = parse(SRC);
  const by = (k) => m.edges.find((e) => e.kind === k);
  assert.deepEqual({ from: by('inherit').from, to: by('inherit').to }, { from: 'Dog', to: 'Animal' });
  assert.deepEqual({ from: by('aggregation').from, to: by('aggregation').to }, { from: 'Leash', to: 'Dog' });
  const assoc = m.edges.filter((e) => e.kind === 'assoc');
  assert.equal(assoc[0].label, '飼う');
  assert.equal(assoc[1].dotted, true);                        // ..> は点線の依存
  // 左右どちら書きでも同じ意味に畳まれる。
  const rev = parse(`classDiagram
    A --|> B
    C <-- D`);
  assert.deepEqual({ f: rev.edges[0].from, t: rev.edges[0].to, k: rev.edges[0].kind }, { f: 'A', t: 'B', k: 'inherit' });
  assert.deepEqual({ f: rev.edges[1].from, t: rev.edges[1].to, k: rev.edges[1].kind }, { f: 'D', t: 'C', k: 'assoc' });
});

test('パース：閉じていない class ブロックは正直に報告する', () => {
  assert.ok(parse(`classDiagram
    class X {
      +y`).errors.some((e) => /\}/.test(e)));
});

test('レイアウト：継承は親が上、%% pos が上書き、決定的', () => {
  const m = parse(SRC);
  const L = layoutClass(m);
  const y = (id) => L.nodes.find((n) => n.id === id).y;
  assert.ok(y('Animal') < y('Dog'), '親 Animal が子 Dog より上');
  assert.ok(L.nodes.find((n) => n.id === 'Animal').h > L.nodes.find((n) => n.id === 'Cat').h, 'メンバが多いほど箱が高い');
  m.layout.pos.Dog = [400, 300];
  const L2 = layoutClass(m);
  assert.deepEqual([L2.nodes.find((n) => n.id === 'Dog').x, L2.nodes.find((n) => n.id === 'Dog').y], [400, 300]);
  assert.deepEqual(layoutClass(parse(SRC)), layoutClass(parse(SRC)));
});

test('往復：serialize→parse は安定し、ドラッグは %% pos にだけ入る', () => {
  const m = parse(SRC);
  const re = parse(serialize(m));
  for (const k of ['kind', 'order', 'items', 'edges', 'layout'])
    assert.deepEqual(re[k], m[k], `${k} がずれた`);
  m.layout.pos.Animal = [120, 40];
  const out = serialize(m);
  const [semantic, trailer] = out.split('%% @layout');
  assert.match(semantic, /class Animal \{/);
  assert.match(semantic, /Animal <\|-- Dog/);                 // 正規形で書き戻る
  assert.match(trailer, /%% pos Animal 120 40/);
  assert.doesNotMatch(semantic, /120/);
});
