/* ============================================================
   v10 の検証：巨大サンプル（全社グランドビュー）のスケールと健全性。
   目次（TOC）は DOM の仕事なのでヘッドレス検証が受け持つ。
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '../engine/parse.js';
import { layout } from '../engine/layout.js';
import { SAMPLES } from '../ui/editor.js';

const KEY = '巨大 — 全社グランドビュー（IT/OT/クラウド/拠点）';

test('巨大サンプル: 50+ 機器・16 ゾーン・44 接続がエラーゼロで読める', () => {
  const m = parse(SAMPLES[KEY]);
  assert.equal(m.errors.length, 0, m.errors.slice(0, 5).join(' / '));
  assert.ok(m.items.filter((x) => x.type === 'inode').length >= 45, '機器数');
  assert.ok(m.groups.length >= 15, 'ゾーン数');
  assert.ok(m.edges.length >= 40, '接続数');
  assert.ok(m.items.some((x) => x.type === 'bus') && m.items.some((x) => x.type === 'fence'));
});

test('巨大サンプル: 世界は縦にも横にも広がり、レイアウトは決定的', () => {
  const m = parse(SAMPLES[KEY]);
  const L = layout(m);
  assert.ok(L.width > 1000 && L.height > 1000, `size ${Math.round(L.width)}x${Math.round(L.height)}`);
  assert.deepEqual(layout(parse(SAMPLES[KEY])), L);
  // 全機器がどこかに置かれ、NaN が無い
  for (const n of L.nodes) assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y), n.id);
});

test('巨大サンプル: examples/enterprise.mmd と同一（単一 HTML 配布物の種）', () => {
  const file = readFileSync(new URL('../examples/enterprise.mmd', import.meta.url), 'utf8').trimEnd();
  assert.equal(file, SAMPLES[KEY].trimEnd());
});

test('巨大サンプル: 全ゾーンを畳んでも壊れず、札の台数が合う', () => {
  const top = ['東京本社', '大阪DR', 'クラウド', '名古屋工場', '福岡支社'];
  const m = parse(SAMPLES[KEY] + '\n%% @layout\n%% fold ' + top.join('|'));
  const L = layout(m);
  const totalShown = L.zones.filter((z) => z.folded).reduce((s, z) => s + z.count, 0);
  const totalNodes = m.items.filter((x) => x.type === 'inode' && x.zone).length;
  assert.equal(totalShown, totalNodes, '畳んだ札の台数合計 = ゾーン所属の全機器');
  assert.ok(L.nodes.length <= 1, '見えている機器は inet だけ');
});
