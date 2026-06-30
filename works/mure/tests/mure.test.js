/* ============================================================
   群 のヘッドレス検証 — 絵は見えなくても、むれの理は確かめられる。
   同じ種からは寸分たがわぬ同じうねりか。むれは空に留まり破綻しないか。
   ばらばらの始まりから、向きはひとつに揃うか（創発）。
   近すぎず離れすぎず、ほどよい密度を保つか。
   隼がよぎれば、むれは散り、やがてまた結ぶか。
   「ひとりでに」を理に保証させる。ここはその保証書。
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFlock, advance, step, order, alarmed, meanNearest } from '../js/core/flock.js';

const hash = (F) => {
  let h = 0x811c9dc5;
  for (const b of F.birds) for (const v of [b.x, b.y, b.vx, b.vy]) { h ^= (v * 1000) | 0; h = Math.imul(h, 0x01000193); }
  return h >>> 0;
};

test('決定的：同じ種からは、寸分たがわぬ同じうねり', () => {
  const a = makeFlock('むれ'); const b = makeFlock('むれ');
  advance(a, 200); advance(b, 200);
  assert.equal(hash(a), hash(b));
});

test('決定的：ちがう種からは、ちがうむれ', () => {
  const a = makeFlock('alpha'); const b = makeFlock('omega');
  advance(a, 200); advance(b, 200);
  assert.notEqual(hash(a), hash(b));
});

test('安定：何刻み進めても、むれは空に留まり、破綻（NaN）しない', () => {
  const F = makeFlock('stable'); advance(F, 800);
  for (const b of F.birds) {
    assert.ok(Number.isFinite(b.x) && Number.isFinite(b.vx), 'NaN/∞ が出た');
    assert.ok(b.x >= 0 && b.x <= F.p.W && b.y >= 0 && b.y <= F.p.H, '空の外へ出た');
    const s = Math.hypot(b.vx, b.vy);
    assert.ok(s >= F.p.minSpeed - 1e-6 && s <= F.p.maxSpeed + 1e-6, `速さが範囲外: ${s}`);
  }
});

test('創発：ばらばらの始まりから、向きはひとつに揃う', () => {
  const F = makeFlock('emerge');
  const o0 = order(F);
  advance(F, 400);
  const o1 = order(F);
  assert.ok(o0 < 0.25, `始まりが揃いすぎ: ${o0}`);   // 最初はてんで
  assert.ok(o1 > 0.6, `揃わなかった: ${o1}`);          // やがてひとつに
});

test('密度：近すぎず離れすぎず——分離は守られ、結束は崩れない', () => {
  const F = makeFlock('density'); advance(F, 400);
  const nn = meanNearest(F);
  assert.ok(nn > 1, `潰れている（重なり）: ${nn}`);
  assert.ok(nn < F.p.view, `散りすぎ（群れていない）: ${nn}`);
  // 二羽が同じ点に重ならない。
  const seen = new Set();
  for (const b of F.birds) { const k = `${b.x.toFixed(2)},${b.y.toFixed(2)}`; assert.ok(!seen.has(k), '重なった'); seen.add(k); }
});

test('驚きの波：隼がよぎれば、むれは散り、おびえが灯る', () => {
  const F = makeFlock('falcon'); advance(F, 300);
  const oBefore = order(F), nnBefore = meanNearest(F);
  // 隼はむれの中の一羽を追う（輪の中心＝空洞ではなく、群れの身に飛び込む）。
  for (let i = 0; i < 30; i++) step(F, { x: F.birds[0].x, y: F.birds[0].y });
  assert.ok(meanNearest(F) > nnBefore, '散らばらなかった');
  assert.ok(order(F) < oBefore, 'むれが乱れなかった');
  let maxAlarm = 0; for (const b of F.birds) maxAlarm = Math.max(maxAlarm, b.alarm);
  assert.ok(maxAlarm > 0.2, `おびえが灯らなかった: ${maxAlarm}`);
});

test('再結束：隼が去れば、むれはまたひとつに戻る', () => {
  const F = makeFlock('regroup'); advance(F, 200);
  for (let i = 0; i < 40; i++) step(F, { x: F.birds[0].x, y: F.birds[0].y });  // 散らす
  advance(F, 400);                                            // 隼は去る
  assert.ok(order(F) > 0.6, 'むれが戻らなかった');
  assert.ok(alarmed(F) < 0.05, 'おびえが残った');
});
