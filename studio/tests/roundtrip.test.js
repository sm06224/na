/* 往復の検証 — ドラッグの結果を書き戻しても意味は崩れないか。
   そしてビルダが、依存を畳んで単一 HTML を吐けるか。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../engine/parse.js';
import { serialize } from '../engine/serialize.js';
import { html } from '../build.js';

const GANTT = `gantt
    title リリース
    dateFormat YYYY-MM-DD
    section 設計
      要件定義 :done, req, 2026-07-01, 5d
      基本設計 :active, design, after req, 7d
      出荷 :milestone, ship, after design, 0d
`;
const FLOW = `flowchart TD
    web[Web] --> gw(API)
    gw -->|認証| db[(DB)]
    subgraph 裏方
      gw
      db
    end
`;

function sameModel(a, b) {
  for (const k of ['kind', 'meta', 'order', 'edges', 'groups', 'items', 'layout'])
    assert.deepEqual(a[k], b[k], `${k} がずれた`);
}

test('serialize→parse は安定（ガント・フローとも）', () => {
  for (const src of [GANTT, FLOW]) sameModel(parse(src), parse(serialize(parse(src))));
});

test('フロー：ノードを動かすと %% pos に入り、意味部は無傷', () => {
  const m = parse(FLOW);
  m.layout.pos.web = [120, 240];
  const out = serialize(m);
  assert.match(out, /%% @layout/);
  assert.match(out, /%% pos web 120 240/);
  assert.match(out, /web\[Web\]/);                         // 形・ラベルは残る
  assert.doesNotMatch(out.split('%% @layout')[0], /120|240/);
  assert.deepEqual(parse(out).layout.pos.web, [120, 240]);
});

test('ガント：開始日と並びを動かすと %% に入り、タスク行は元のまま', () => {
  const m = parse(GANTT);
  m.layout.at.req = '2026-07-03';
  m.layout.order = ['design', 'req', 'ship'];
  const out = serialize(m);
  const [semantic, trailer] = out.split('%% @layout');
  assert.match(semantic, /:done, req, 2026-07-01, 5d/);    // タスク行は不変
  assert.match(trailer, /%% at req 2026-07-03/);
  assert.match(trailer, /%% order design req ship/);
  const re = parse(out);
  assert.equal(re.layout.at.req, '2026-07-03');
  assert.deepEqual(re.layout.order, ['design', 'req', 'ship']);
});

test('ハイパーリンク：click 行が読めて、往復で保たれ、意味部に残る', () => {
  const f = parse(`flowchart TD
  A[Web] --> B[Docs]
  click B "https://example.com/docs"`);
  assert.equal(f.items.find((n) => n.id === 'B').link, 'https://example.com/docs');
  const fo = serialize(f);
  assert.match(fo, /click B "https:\/\/example\.com\/docs"/);
  assert.deepEqual(parse(fo).items, f.items);

  const g = parse(`gantt
  dateFormat YYYY-MM-DD
    設計 :a, 2026-07-01, 3d
  click a href "https://example.com/spec"`);
  assert.equal(g.items[0].link, 'https://example.com/spec');
  const go = serialize(g);
  assert.match(go, /click a href "https:\/\/example\.com\/spec"/);
  assert.deepEqual(parse(go).items, g.items);
  // 相手のいない click は指摘される。
  assert.ok(parse(`flowchart TD
  A[x]
  click zzz "https://e.com"`).errors.length);
});

test('Mermaid 互換：本物の Mermaid 記法をそのまま読める', () => {
  const m = parse(`gantt
    title A Gantt Diagram
    dateFormat YYYY-MM-DD
    section Section
      A task :a1, 2014-01-01, 30d
      Another task :after a1, 20d`);
  assert.equal(m.kind, 'gantt');
  assert.equal(m.items[0].id, 'a1');
  assert.equal(m.items[0].dur, 30);
  assert.deepEqual(m.items[1].after, ['a1']);
});

test('ビルド：依存を畳んで単一 HTML を吐き、図を埋め込み、script を壊さない', () => {
  const page = html(FLOW);
  assert.ok(page.includes(JSON.stringify(FLOW)), '図の DSL が埋め込まれている');
  assert.match(page, /function parse\b/);                  // エンジン同梱
  assert.match(page, /function boot\b/);                   // エディタ同梱
  assert.match(page, /id="canvas"/);                       // 受け皿
  assert.match(page, /window\.STUDIO_SOURCE=/);            // SOURCE 注入済み
  assert.doesNotMatch(page, /import \{ boot \} from/);     // 元のモジュールローダは消えた
  // 埋め込みスクリプト内に生の </script> が無い（あると途中で切れる）。
  const body = page.slice(page.indexOf('<script>') + 8);
  assert.ok(!body.slice(0, body.indexOf('<\/script>')).includes('</script>'), '生の閉じタグが混入していない');
});
