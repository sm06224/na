import test from 'node:test';
import assert from 'node:assert/strict';
import { windowSunlight, yearlySunlight, FACING } from '../js/core/window.js';

const TOKYO = [35.6895, 139.6917, 9];
const EQUINOX = { y: 2025, m: 3, d: 20 };

test('決定性：同じ窓・同じ日からは、同じ日当たり', () => {
  const a = windowSunlight(...TOKYO, EQUINOX, 180, 0);
  const b = windowSunlight(...TOKYO, EQUINOX, 180, 0);
  assert.deepEqual(a, b);
});

test('北半球の春分：北窓は直射ゼロ、南窓はたっぷり', () => {
  assert.equal(windowSunlight(...TOKYO, EQUINOX, FACING['北'], 0).totalMinutes, 0);
  assert.ok(windowSunlight(...TOKYO, EQUINOX, FACING['南'], 0).totalMinutes > 10 * 60);
});

test('区間は時間順・重ならず・一日の内に収まる', () => {
  const { intervals } = windowSunlight(...TOKYO, { y: 2025, m: 6, d: 21 }, FACING['北'], 0);
  let prev = -1;
  for (const iv of intervals) {
    assert.ok(iv.start >= 0 && iv.end <= 1440 && iv.start < iv.end);
    assert.ok(iv.start > prev, '区間は重ならず昇順');
    prev = iv.end;
  }
});

test('遮りが高いほど、日当たりは減る（単調）', () => {
  const date = { y: 2025, m: 12, d: 22 };
  let last = Infinity;
  for (const obs of [0, 10, 20, 30, 45]) {
    const t = windowSunlight(...TOKYO, date, FACING['南'], obs).totalMinutes;
    assert.ok(t <= last, `遮り ${obs}° は ${last} 以下のはず（${t}）`);
    last = t;
  }
  // 冬至の南中高度は約 31°。45° の遮りなら直射は入らない
  assert.equal(windowSunlight(...TOKYO, date, FACING['南'], 45).totalMinutes, 0);
});

test('合計は区間の和に等しく、0〜1440 分に収まる', () => {
  for (const az of [0, 90, 180, 270]) {
    const r = windowSunlight(...TOKYO, { y: 2025, m: 8, d: 1 }, az, 0);
    const sum = r.intervals.reduce((s, iv) => s + (iv.end - iv.start), 0);
    assert.equal(r.totalMinutes, sum);
    assert.ok(r.totalMinutes >= 0 && r.totalMinutes <= 1440);
  }
});

test('南窓は夏より冬のほうが直射が長い（夏は朝夕に陽が北へ回るため）', () => {
  const summer = windowSunlight(...TOKYO, { y: 2025, m: 6, d: 21 }, FACING['南'], 0).totalMinutes;
  const winter = windowSunlight(...TOKYO, { y: 2025, m: 12, d: 22 }, FACING['南'], 0).totalMinutes;
  assert.ok(winter > summer, `冬 ${winter} > 夏 ${summer}`);
});

test('通年は 12 か月ぶん、すべて 0 以上', () => {
  const y = yearlySunlight(...TOKYO, 2025, FACING['南'], 0);
  assert.equal(y.length, 12);
  for (const h of y) assert.ok(h >= 0 && h <= 24);
});
