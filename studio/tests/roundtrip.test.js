/* 往復の検証 — ドラッグの結果を書き戻しても、意味は崩れないか。
   これが「DSL＋レイアウト情報」を持つツールの肝。AI 差分がきれいに保たれる。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../engine/parse.js';
import { serialize } from '../engine/serialize.js';
import { bundle, html } from '../build.js';

const GANTT = `kind gantt
title リリース
start 2026-07-01

section 設計
  task a "要件" at 2026-07-01 for 5d done 60
  task b "設計" after a for 7d
  milestone ship "出荷" after b
`;
const ARCH = `kind arch
title 構成

node web "Web"
node gw "GW"
node db "DB"

edge web -> gw
edge gw -> db
group "裏方" { gw db }
`;

function sameModel(a, b) {
  assert.equal(a.kind, b.kind);
  assert.deepEqual(a.meta, b.meta);
  assert.deepEqual(a.order, b.order);
  assert.deepEqual(a.edges, b.edges);
  assert.deepEqual(a.groups, b.groups);
  assert.deepEqual(a.items, b.items);
  assert.deepEqual(a.layout, b.layout);
}

test('serialize→parse は安定（ガント・アーキとも）', () => {
  for (const src of [GANTT, ARCH]) {
    const m1 = parse(src);
    const m2 = parse(serialize(m1));
    sameModel(m1, m2);
  }
});

test('アーキ：ノードを動かすと @layout pos に入り、意味部は無傷', () => {
  const m = parse(ARCH);
  m.layout.pos.web = [120, 240];                 // ドラッグ相当
  const out = serialize(m);
  assert.match(out, /@layout/);
  assert.match(out, /pos web 120 240/);
  assert.match(out, /node web "Web"/);           // 意味部はそのまま
  assert.doesNotMatch(out.split('@layout')[0], /120|240/); // 座標は意味部に漏れない
  assert.deepEqual(parse(out).layout.pos.web, [120, 240]);
});

test('ガント：開始日と並びを動かすと @layout に入り、task 行は元のまま', () => {
  const m = parse(GANTT);
  m.layout.at.a = '2026-07-03';                  // 横ドラッグ相当
  m.layout.order = ['b', 'a', 'ship'];           // 縦ドラッグ相当
  const out = serialize(m);
  const [semantic, trailer] = out.split('@layout');
  assert.match(semantic, /task a "要件" at 2026-07-01 for 5d done 60/); // task 行は不変
  assert.match(trailer, /at a 2026-07-03/);
  assert.match(trailer, /order b a ship/);
  const re = parse(out);
  assert.equal(re.layout.at.a, '2026-07-03');
  assert.deepEqual(re.layout.order, ['b', 'a', 'ship']);
});

test('ビルド：エンジンは import/export を剥がして畳まれ、図が埋め込まれる', () => {
  const engine = bundle();
  assert.doesNotMatch(engine, /^\s*import\b/m, 'import が残っている');
  assert.doesNotMatch(engine, /^\s*export\s+(function|const|class|let)\b/m, 'export 宣言が残っている');
  const page = html('テスト図', ARCH, engine);
  assert.match(page, /<svg|id="canvas"/);        // 受け皿がある
  assert.ok(page.includes(JSON.stringify(ARCH)), '図の DSL が埋め込まれている');
  assert.match(page, /function parse\b/);        // エンジンが同梱されている
});
