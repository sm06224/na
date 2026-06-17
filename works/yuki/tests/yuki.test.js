import test from 'node:test';
import assert from 'node:assert/strict';
import {
  grow, weather, paramsFor, summary, habit, letter, crystalName, mei,
  HABITS, habitJa, frozenCells, isFrozen, valueAt,
  rot60, mirror, hexDist, mulberry32, hashSeed, NAKAYA,
} from '../js/core/yuki.js';

const HABITSET = new Set(HABITS);
// テストは速く回るよう、小さな盤で固定パラメータを使う。
const fixed = { R: 22, steps: 140, weather: { temp: -15, humid: 0.85 }, params: { alpha: 1.6, beta: 0.5, gamma: 0.003 } };

test('種は決定的：同じ種・同じ空なら、寸分たがわぬひとひら', () => {
  const a = grow('hello', fixed);
  const b = grow('hello', fixed);
  assert.deepEqual(Array.from(a.s), Array.from(b.s));
  assert.deepEqual(Array.from(a.frozen), Array.from(b.frozen));
  // 一文字変えれば別の空、別の結晶
  const c = grow('hellp');
  const d = grow('hellp');
  assert.deepEqual(Array.from(c.s), Array.from(d.s));
  assert.notDeepEqual(weather('hello'), weather('hellp'));
  // 数値の種でも安定
  assert.deepEqual(Array.from(grow(20260617, fixed).s), Array.from(grow(20260617, fixed).s));
});

test('六回対称：60°回転で結晶は寸分たがわず重なる（ビット単位）', () => {
  const cr = grow('snow', fixed);
  for (let i = 0; i < cr.N; i++) {
    const x = cr.xs[i], y = cr.ys[i];
    const [rx, ry] = rot60(x, y);
    assert.equal(valueAt(cr, rx, ry), cr.s[i], `回転対称が崩れた (${x},${y})`);
  }
});

test('鏡映対称：鏡に映しても同じ華', () => {
  const cr = grow('mirror-seed', fixed);
  let frozenChecked = 0;
  for (let i = 0; i < cr.N; i++) {
    if (!cr.frozen[i]) continue;
    const [mx, my] = mirror(cr.xs[i], cr.ys[i]);
    assert.equal(valueAt(cr, mx, my), cr.s[i], `鏡映対称が崩れた`);
    frozenChecked++;
  }
  assert.ok(frozenChecked > 12, '結晶がほとんど育っていない');
});

test('六方の幾何：回転・鏡映は座標を六角形の内に閉じこめ、中心は不動', () => {
  assert.deepEqual(rot60(0, 0), [0, 0]);
  assert.deepEqual(mirror(0, 0), [0, 0]);
  // 回転を6回かければ元に戻る
  for (const [sx, sy] of [[3, -1], [-2, 5], [4, 0]]) {
    let x = sx, y = sy;
    for (let k = 0; k < 6; k++)[x, y] = rot60(x, y);
    assert.deepEqual([x, y], [sx, sy], '60°×6 で元に戻らない');
    // 回転で中心からの距離は変わらない
    assert.equal(hexDist(...rot60(sx, sy)), hexDist(sx, sy));
  }
});

test('成長は単調：歩を進めても、凍った升は決して解けない（部分集合）', () => {
  const few = grow('grow', { ...fixed, steps: 40 });
  const many = grow('grow', { ...fixed, steps: 140 });
  for (let i = 0; i < few.N; i++) {
    if (few.frozen[i]) assert.equal(many.frozen[i], 1, '凍った升が消えた');
  }
  assert.ok(many.count >= few.count, '結晶は縮まないはず');
});

test('結晶は連結：ひとつの華であって、宙に浮く氷はない', () => {
  const cr = grow('connected', fixed);
  const center = cr.idx.get('0,0');
  assert.equal(cr.frozen[center], 1, '中心が凍っていない');
  // 中心から隣りづたいに辿れる凍り升の数 = 全凍り升の数
  const seen = new Uint8Array(cr.N);
  const stack = [center]; seen[center] = 1; let reached = 1;
  const DIRS = [[1, -1], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1]];
  while (stack.length) {
    const i = stack.pop(), x = cr.xs[i], y = cr.ys[i];
    for (const [dx, dy] of DIRS) {
      const j = cr.idx.get((x + dx) + ',' + (y + dy));
      if (j !== undefined && cr.frozen[j] && !seen[j]) { seen[j] = 1; reached++; stack.push(j); }
    }
  }
  assert.equal(reached, cr.count, '宙に浮いた氷がある（連結でない）');
});

test('値は健全：すべて有限で非負、外周にはまだ届いていない', () => {
  const cr = grow('sane', fixed);
  for (let i = 0; i < cr.N; i++) {
    assert.ok(Number.isFinite(cr.s[i]) && cr.s[i] >= 0, `不正な水量 ${cr.s[i]}`);
  }
  assert.ok(cr.maxR < cr.R, '結晶が盤のふちに達した（蒸気だまりが壊れる）');
  assert.ok(cr.count >= 7, 'まったく育っていない');
});

test('空：温度と湿りは妥当な範囲、湿りが高いほど枝が繁る', () => {
  for (const seed of ['a', 'b', 'c', 'fuyu', 12345]) {
    const w = weather(seed);
    assert.ok(w.temp <= -1 && w.temp >= -29, `温度域 ${w.temp}`);
    assert.ok(w.humid >= 0 && w.humid <= 1, `湿り域 ${w.humid}`);
  }
  const dry = paramsFor({ temp: -15, humid: 0.2 });
  const wet = paramsFor({ temp: -15, humid: 0.95 });
  assert.ok(wet.branch > dry.branch, '湿った空ほど枝が繁るはず');
  assert.ok(wet.beta < dry.beta, '枝が繁る空ほど周囲蒸気は薄い');
});

test('晶癖：既知の語彙だけ。湿った空は角板にならず、乾いた空は枝を広げない', () => {
  const wetH = habit(grow('wet', { R: 30, steps: 220, weather: { temp: -15, humid: 0.97 } }));
  const dryH = habit(grow('dry', { R: 30, steps: 220, weather: { temp: -15, humid: 0.22 } }));
  assert.ok(HABITSET.has(wetH) && HABITSET.has(dryH));
  const order = ['plate', 'sector', 'stellar', 'dendrite', 'fern'];
  // 湿った空のほうが、より枝の側（配列の後ろ）に来る
  assert.ok(order.indexOf(wetH) >= order.indexOf(dryH), `湿=${wetH} 乾=${dryH}`);
});

test('手紙と銘：決定的で、晶癖の語彙に根ざす。銘は種で変わる', () => {
  const s1 = summary('tegami', fixed);
  const s2 = summary('tegami', fixed);
  assert.equal(s1.letter, s2.letter);
  assert.equal(s1.mei, s2.mei);
  assert.equal(s1.name, s2.name);
  assert.ok(typeof s1.letter === 'string' && s1.letter.length > 8);
  assert.ok(HABITSET.has(s1.habit));
  assert.ok(typeof habitJa(s1.habit) === 'string');
  assert.notEqual(mei('tegami'), mei('tegamj'), '種が変われば銘も変わる');
  assert.ok(s1.mei.startsWith('❄'));
  assert.ok(NAKAYA.includes('中谷'));
});

test('frozenCells と valueAt：取り出した升はすべて結晶で、量は 1 以上', () => {
  const cr = grow('cells', fixed);
  const cells = frozenCells(cr);
  assert.equal(cells.length, cr.count);
  for (const c of cells.slice(0, 50)) {
    assert.ok(c.s >= 1, '凍り升なのに量が 1 未満');
    assert.ok(isFrozen(cr, c.x, c.y));
    assert.equal(valueAt(cr, c.x, c.y), c.s);
  }
});
