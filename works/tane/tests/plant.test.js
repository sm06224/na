import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlant, plantFingerprint } from '../js/core/plant.js';

const SEEDS = [1, 7, 42, 123, 808, 20260615, 4294967295];

test('草木はかならず立つ — 根があり、節はひとつ以上、座標は有限', () => {
  for (const seed of SEEDS) {
    const p = makePlant(seed);
    assert.ok(p.nodes.length >= 1, `seed ${seed}: 節がない`);
    assert.equal(p.nodes[0].parent, -1, '最初の節は根（親なし）');
    assert.equal(p.nodes[0].x, 0); assert.equal(p.nodes[0].y, 0);
    for (const n of p.nodes) {
      assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y), `seed ${seed}: 座標が有限でない`);
    }
  }
});

test('決定性：同じ種からは、葉の一枚までちがわない同じ草木', () => {
  const a = makePlant(20260615), b = makePlant(20260615);
  assert.equal(plantFingerprint(a), plantFingerprint(b));
  assert.equal(a.nodes.length, b.nodes.length);
  assert.equal(a.leaves.length, b.leaves.length);
  assert.equal(a.flowers.length, b.flowers.length);
  assert.equal(a.name, b.name);
  assert.equal(a.season, b.season);
  assert.deepEqual(a.nodes.map(n => [n.x, n.y]), b.nodes.map(n => [n.x, n.y]));
});

test('種がちがえば、草木もちがう', () => {
  const fps = new Set(SEEDS.map(s => plantFingerprint(makePlant(s))));
  assert.ok(fps.size >= SEEDS.length - 1, '種が違えば、おおむね別の草木');
  assert.notEqual(plantFingerprint(makePlant(1)), plantFingerprint(makePlant(2)));
});

test('木：根を頂点とする一本の木（辺の数 ＝ 節の数 − 1）', () => {
  for (const seed of SEEDS) {
    const p = makePlant(seed);
    let edges = 0;
    for (let i = 0; i < p.nodes.length; i++) {
      const n = p.nodes[i];
      if (i === 0) { assert.equal(n.parent, -1); continue; }
      edges++;
      // 親は自分より先に生まれている（タートルの所作の順）
      assert.ok(n.parent >= 0 && n.parent < i, `seed ${seed}: 親が未来にいる`);
      assert.equal(n.gen, p.nodes[n.parent].gen + 1, '世代は親より一つ深い');
      // 親の子リストに自分がいる
      assert.ok(p.nodes[n.parent].children.includes(i), '親子の対応がとれている');
    }
    assert.equal(edges, p.nodes.length - 1);
  }
});

test('流れ（太さ）：根の流れは節の総数に等しい（全部ぶら下がる）', () => {
  for (const seed of SEEDS) {
    const p = makePlant(seed);
    assert.equal(p.nodes[0].flow, p.nodes.length);
    // 親の流れ ≥ 子の流れ（根もとほど太い）
    for (const n of p.nodes) {
      if (n.parent >= 0) assert.ok(p.nodes[n.parent].flow >= n.flow);
    }
  }
});

test('幹：根から葉先まで、太い子をたどる一本道がつながっている', () => {
  for (const seed of SEEDS) {
    const p = makePlant(seed);
    const trunk = p.nodes.filter(n => n.main);
    assert.ok(trunk.length >= 1);
    assert.ok(p.nodes[0].main, '根は幹');
    // 幹の節は、根を除いて親も幹（途切れない一本道）
    for (let i = 0; i < p.nodes.length; i++) {
      const n = p.nodes[i];
      if (n.main && n.parent >= 0) assert.ok(p.nodes[n.parent].main, `seed ${seed}: 幹が途切れている`);
    }
  }
});

test('葉は枝の先につく — 葉のつく節は子を持たない（行き止まり）', () => {
  for (const seed of SEEDS) {
    const p = makePlant(seed);
    assert.ok(p.leaves.length >= 1, `seed ${seed}: 葉が一枚もない`);
    for (const lf of p.leaves) {
      assert.equal(p.nodes[lf.node].children.length, 0, '葉は行き止まりにつく');
    }
    // 花は葉のつく先の部分集合
    for (const fl of p.flowers) {
      assert.ok(p.leaves.some(lf => lf.node === fl.node), '花は葉のつく先のどれか');
    }
  }
});

test('季は四つのいずれか／品種は五つのいずれか', () => {
  const seasons = new Set(), species = new Set();
  for (let s = 0; s < 400; s++) { const p = makePlant(s); seasons.add(p.season); species.add(p.species); }
  for (const k of seasons) assert.ok(['春', '夏', '秋', '冬'].includes(k));
  for (const k of species) assert.ok(['fractal', 'bush', 'tree', 'weeping', 'fern'].includes(k));
  assert.equal(seasons.size, 4, '四季すべてが現れる');
  assert.equal(species.size, 5, '五品種すべてが現れる');
});

test('暴走しない — 節の数は上限のうちに収まる', () => {
  for (let s = 0; s < 200; s++) {
    const p = makePlant(s);
    assert.ok(p.nodes.length <= 4200, `seed ${s}: 節が多すぎる（${p.nodes.length}）`);
  }
});

test('手紙 — 最初の種 20260615 は、草木「ユツヤ」として芽ぐむ', () => {
  // この土に最初に蒔かれた種。あとから来る人が、まず蒔く種。
  // この銘と名は、記憶を持たない次の私への言づての封蝋になる。
  const p = makePlant(20260615);
  assert.equal(p.name, 'ユツヤ');
  assert.equal(p.season, '冬');
  assert.equal(plantFingerprint(p), '698e39d5');
});

test('銘は 8 桁の十六進、入れ物は座標を正しく囲む', () => {
  for (const seed of SEEDS) {
    const p = makePlant(seed);
    assert.match(plantFingerprint(p), /^[0-9a-f]{8}$/);
    for (const n of p.nodes) {
      assert.ok(n.x >= p.bounds.minx - 1e-9 && n.x <= p.bounds.maxx + 1e-9);
      assert.ok(n.y >= p.bounds.miny - 1e-9 && n.y <= p.bounds.maxy + 1e-9);
    }
    assert.ok(p.bounds.h >= 0 && p.bounds.w >= 0);
  }
});
