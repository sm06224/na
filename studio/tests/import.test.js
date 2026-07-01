/* 流し込みの検証 — 表データ（CSV/TSV）が正しく Mermaid になり、そのまま描けるか。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, csvToMermaid } from '../engine/import.js';
import { parse } from '../engine/parse.js';
import { layout } from '../engine/layout.js';

test('CSV：引用符（カンマ内包・"" エスケープ）と TSV を読める', () => {
  const rows = parseCSV('a,"b,c","d""e"\n1,2,3');
  assert.deepEqual(rows, [['a', 'b,c', 'd"e'], ['1', '2', '3']]);
  const tsv = parseCSV('from\tto\nA\tB');
  assert.deepEqual(tsv, [['from', 'to'], ['A', 'B']]);
});

test('ガント：日本語ヘッダ・状態の言い換え・依存のラベル参照・link 列を吸収する', () => {
  const csv = [
    '名前,開始,期間,依存,状態,区分,リンク',
    '要件定義,2026-07-01,5,,完了,設計,https://example.com/req',
    '基本設計,,7,要件定義,進行中,設計,',
    '出荷,,,基本設計,マイルストーン,出荷,',
  ].join('\n');
  const r = csvToMermaid(csv);
  assert.equal(r.kind, 'gantt');
  const m = parse(r.text);
  assert.equal(m.errors.length, 0, r.text);
  assert.equal(m.items.length, 3);
  const [req, design, ship] = m.items;
  assert.equal(req.status, 'done');
  assert.equal(req.at, '2026-07-01');
  assert.equal(req.dur, 5);
  assert.equal(req.link, 'https://example.com/req');        // link 列 → click 行
  assert.equal(design.status, 'active');
  assert.deepEqual(design.after, [req.id]);                  // ラベル「要件定義」→ id に解決
  assert.equal(ship.type, 'milestone');
  assert.equal(req.section, '設計');
  const L = layout(m);
  assert.equal(L.errors.length, 0);                          // そのまま日程が引ける
});

test('ガント：開始未指定は直前の後ろに明示され、日付の / 区切りも読む', () => {
  const r = csvToMermaid('label,start,duration\nA,2026/07/01,3\nB,,2');
  const m = parse(r.text);
  assert.equal(m.items[0].at, '2026-07-01');
  assert.deepEqual(m.items[1].after, [m.items[0].id]);
});

test('フロー：from/to のエッジリストから、日本語ラベルのノードが生える', () => {
  const csv = ['from,to,label', 'Web,API ゲートウェイ,認証', 'API ゲートウェイ,データベース,'].join('\n');
  const r = csvToMermaid(csv);
  assert.equal(r.kind, 'flowchart');
  const m = parse(r.text);
  assert.equal(m.errors.length, 0, r.text);
  const labels = m.items.map((n) => n.label);
  assert.ok(labels.includes('Web') && labels.includes('API ゲートウェイ') && labels.includes('データベース'));
  assert.equal(m.edges.length, 2);
  assert.equal(m.edges[0].label, '認証');
});

test('読めない表は黙らず、正直に断る', () => {
  assert.ok(csvToMermaid('x,y\n1,2').error);
  assert.ok(csvToMermaid('たった1行').error);
});
