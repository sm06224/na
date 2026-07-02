/* draw.io 出力の検証 — 編集できる図形として、正しく持ち出せるか。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../engine/parse.js';
import { layout } from '../engine/layout.js';
import { toDrawio } from '../engine/drawio.js';

const gen = (src) => { const m = parse(src); return { m, xml: toDrawio(m, layout(m)) }; };

// ざっくりした整形式チェック：mxCell の開閉が揃い、素の & が残っていない。
function wellFormed(xml) {
  const opens = (xml.match(/<mxCell /g) || []).length;
  const selfClosed = (xml.match(/<mxCell [^>]*\/>/g) || []).length;   // root の 2 セルは自己終了
  assert.equal(opens - selfClosed, (xml.match(/<\/mxCell>/g) || []).length, 'mxCell の開閉が合わない');
  assert.ok(xml.startsWith('<mxfile') && xml.endsWith('</mxfile>'), 'mxfile で包まれていない');
  assert.doesNotMatch(xml, /&(?!amp;|lt;|gt;|quot;|#10;)/, '素の & が残っている');
}

test('フロー：形状がオートシェイプに写り、エッジはノードに接続される', () => {
  const { xml } = gen(`flowchart TD
  a[四角] --> b{菱形}
  b -.-> c((円))
  b ==> d[(円柱)]
  subgraph 箱
    c
    d
  end`);
  wellFormed(xml);
  assert.match(xml, /rhombus;whiteSpace/);
  assert.match(xml, /ellipse;whiteSpace/);
  assert.match(xml, /shape=cylinder3/);
  assert.match(xml, /dashed=1/);                              // 点線
  assert.match(xml, /strokeWidth=3/);                         // 太線
  assert.match(xml, /source="s\d+" target="s\d+"/);           // 接続つきエッジ
  assert.match(xml, /value="箱"/);                            // グループ枠
  assert.match(xml, /value="四角"/);
});

test('クラス：swimlane＋stackLayout の UML クラスに、関係は UML 矢印に', () => {
  const { xml } = gen(`classDiagram
  class Animal {
    +String name
    +speak() string
  }
  Animal <|-- Dog
  Dog o-- Leash`);
  wellFormed(xml);
  assert.match(xml, /swimlane;fontStyle=1[^"]*childLayout=stackLayout/);
  assert.match(xml, /value="\+String name"/);                 // メンバが子セル
  assert.match(xml, /endArrow=block;endFill=0/);              // 継承の三角
  assert.match(xml, /endArrow=diamondThin;endFill=0/);        // 集約の白菱形
});

test('ガント：棒・マイルストン・today 線が編集できる図形として出る', () => {
  const { xml } = gen(`gantt
  dateFormat YYYY-MM-DD
    設計 :done, a, 2026-07-01, 5d
    出荷 :milestone, m, after a, 0d
%% @layout
%% today 2026-07-03`);
  wellFormed(xml);
  assert.match(xml, /rounded=1;arcSize=40/);                  // 棒
  assert.match(xml, /rhombus;html=1/);                        // マイルストン
  assert.match(xml, /value="today"/);                         // today 線
  assert.match(xml, /value="設計"/);
});

test('シーケンス：ライフライン・矢印・付箋・枠が出る', () => {
  const { xml } = gen(`sequenceDiagram
  a->>b: こんにちは
  b--xa: だめ
  Note over a,b: メモ
  loop 毎分
    a->>b: ping
  end`);
  wellFormed(xml);
  assert.match(xml, /endArrow=block;endFill=1/);              // 実線矢印
  assert.match(xml, /endArrow=cross/);                        // バツ
  assert.match(xml, /fillColor=#FFF2CC/);                     // 付箋
  assert.match(xml, /value="loop 毎分"/);                     // 枠
  assert.match(xml, /dashed=1/);                              // ライフライン
});

test('画像ノード：%% img が draw.io の image スタイルに写る（;base64, → ,）', () => {
  const { m, xml } = gen(`flowchart TD
  shot[スクショ]
%% @layout
%% img shot data:image/png;base64,iVBORtest`);
  assert.equal(m.images.shot, 'data:image/png;base64,iVBORtest');
  assert.match(xml, /image=data:image\/png,iVBORtest/);       // style 流儀に変換
  wellFormed(xml);
});

test('決定的：同じモデルからは同じ XML', () => {
  const src = `flowchart LR
  a --> b`;
  assert.equal(gen(src).xml, gen(src).xml);
});
