import { test } from 'node:test';
import assert from 'node:assert/strict';

import { garden, lineOf, weekOf, GENESIS } from '../js/core/garden.js';

test('庭は週番号の純粋関数：同じ週は一画素もちがわない', () => {
  assert.equal(garden(10), garden(10));
  assert.notEqual(garden(10), garden(11));
});

test('週番号：創世の日は第0週、7日後に第1週、過去は0に丸める', () => {
  const t0 = Date.parse(GENESIS + 'T00:00:00Z');
  assert.equal(weekOf(new Date(t0)), 0);
  assert.equal(weekOf(new Date(t0 + 6.9 * 86400e3)), 0);
  assert.equal(weekOf(new Date(t0 + 7.1 * 86400e3)), 1);
  assert.equal(weekOf(new Date(t0 + 70 * 86400e3)), 10);
  assert.equal(weekOf(new Date(t0 - 86400e3)), 0, '創世以前は第0週');
});

test('苔は歳月とともに増える（早送りしても辻褄が合う）', () => {
  const count = svg => (svg.match(/<circle/g) || []).length;
  assert.ok(count(garden(60)) > count(garden(5)));
  assert.ok(count(garden(5)) > count(garden(0)) || count(garden(0)) > 0);
});

test('SVG として體裁が整っている', () => {
  for (const w of [0, 8, 52, 200]) {
    const s = garden(w);
    assert.ok(s.startsWith('<svg '));
    assert.ok(s.trimEnd().endsWith('</svg>'));
    assert.equal((s.match(/<svg /g) || []).length, 1);
    assert.ok(s.includes(`第${w}週`));
    // 開きタグと閉じタグの釣り合い（自己閉じは除く）
    for (const tag of ['g', 'text']) {
      const open = (s.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length;
      const close = (s.match(new RegExp(`</${tag}>`, 'g')) || []).length;
      assert.equal(open, close, `<${tag}>`);
    }
  }
});

test('歳月だけが連れてくる客：シダは8週、灯籠は52週、蛙は156週', () => {
  assert.ok(!garden(7).includes('stroke-linecap'), '7週にシダはまだ');
  assert.ok(garden(8).includes('stroke-linecap'), '8週でシダ');
  assert.ok(!garden(51).includes('#ffd9a0'), '51週に灯はまだ');
  assert.ok(garden(52).includes('#ffd9a0'), '52週で灯籠に灯が入る');
  assert.ok(!garden(155).includes('#5a7d4a'), '155週に蛙はまだ');
  assert.ok(garden(156).includes('#5a7d4a'), '156週で蛙がくる');
});

test('ひとことは週で巡り、週番号を含む', () => {
  assert.ok(lineOf(0).startsWith('苔 — 第0週: '));
  assert.ok(lineOf(12).includes('第12週'));
  assert.equal(typeof lineOf(9999), 'string');
});

test('庭が古びても、サイズは暴れない（README に埋める前提）', () => {
  const kb = s => Buffer.byteLength(s) / 1024;
  assert.ok(kb(garden(520)) < 600, `10年でも ${kb(garden(520)).toFixed(0)}KB`);
});
