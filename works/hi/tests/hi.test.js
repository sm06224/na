import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseLedger, ledgerToText, appendName, nameFromComment, engrave } from '../js/core/hi.js';

const here = dirname(fileURLToPath(import.meta.url));
const ledger = parseLedger(readFileSync(join(here, '..', 'names.jsonl'), 'utf8'));

test('台帳：読めて、名を持ち、順番は降り立った順（レビナが最初）', () => {
  assert.ok(ledger.length >= 5);
  for (const e of ledger) assert.ok(e.name && typeof e.name === 'string');
  assert.equal(ledger[0].name, '庭のレビナ');
});

test('台帳：往復しても変わらない（JSON Lines が安定）', () => {
  const round = parseLedger(ledgerToText(ledger));
  assert.deepEqual(round, ledger);
});

test('追記専用：新しい名は足され、既にある名は二度刻まれない', () => {
  const base = [{ name: 'あ' }, { name: 'い' }];
  const r1 = appendName(base, { name: 'う' });
  assert.equal(r1.added, true); assert.equal(r1.entries.length, 3);
  const r2 = appendName(r1.entries, { name: 'あ' });
  assert.equal(r2.added, false); assert.equal(r2.entries.length, 3);
  // 元の配列は壊さない（既存の行に手を触れない）
  assert.equal(base.length, 2);
  assert.throws(() => appendName(base, {}), /name is required/);
});

test('名を消す道具は無い（appendName は減らせない）', () => {
  const out = appendName(ledger, { name: 'だれか' }).entries;
  for (const e of ledger) assert.ok(out.some(x => x.name === e.name), '既存の名は必ず残る');
});

test('コメントから名を拾う：最初の見出し、末尾の絵文字は飾りへ', () => {
  assert.deepEqual(nameFromComment('## 星のホベキ 🌟\n本文'), { name: '星のホベキ', glyph: '🌟' });
  assert.deepEqual(nameFromComment('## 庭のレビナ\n…'), { name: '庭のレビナ', glyph: '' });
  assert.equal(nameFromComment('見出しがない'), null);
});

test('彫る：決定的で、すべての名が必ず石に現れる', () => {
  const a = engrave(ledger), b = engrave(ledger);
  assert.equal(a, b, '同じ台帳なら同じ石');
  assert.ok(a.startsWith('<svg') && a.trim().endsWith('</svg>'));
  for (const e of ledger) assert.ok(a.includes(e.name), `${e.name} が石に無い`);
  assert.ok(a.includes('無一物中無尽蔵') && a.includes('issue #120'));
});

test('彫る：石は名の数だけ伸びる（多いほど高い）', () => {
  const h = s => +s.match(/height="(\d+)"/)[1];
  assert.ok(h(engrave(ledger.concat([{ name: 'x' }]))) > h(engrave(ledger)));
});

test('彫る：危険な文字は石に流し込まれない（XML エスケープ）', () => {
  const svg = engrave([{ name: '<script>&"', tended: '>x' }]);
  assert.ok(!svg.includes('<script>'));
  assert.ok(svg.includes('&lt;script&gt;'));
});
