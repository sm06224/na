import test from 'node:test';
import assert from 'node:assert/strict';
import { dayEvents, sunPosition, julianDayNumber, hhmm } from '../js/core/sun.js';

const TOKYO = [35.6895, 139.6917, 9];
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

test('決定性：同じ場所・同じ日からは、同じ時刻', () => {
  const a = dayEvents(...TOKYO, { y: 2025, m: 6, d: 21 });
  const b = dayEvents(...TOKYO, { y: 2025, m: 6, d: 21 });
  assert.deepEqual(a, b);
});

test('東京の実測に合う（夏至・冬至の日の出入り、±5分）', () => {
  const summer = dayEvents(...TOKYO, { y: 2025, m: 6, d: 21 });
  near(summer.sunrise, 4 * 60 + 26, 5, '夏至の日の出 ≈ 04:26');
  near(summer.sunset, 19 * 60 + 0, 5, '夏至の日の入り ≈ 19:00');
  const winter = dayEvents(...TOKYO, { y: 2025, m: 12, d: 22 });
  near(winter.sunrise, 6 * 60 + 48, 5, '冬至の日の出 ≈ 06:48');
  near(winter.sunset, 16 * 60 + 32, 5, '冬至の日の入り ≈ 16:32');
});

test('春分・秋分は、どの緯度でもおよそ 12 時間（±20 分）', () => {
  for (const lat of [-45, -10, 0, 35.69, 60]) {
    for (const date of [{ y: 2025, m: 3, d: 20 }, { y: 2025, m: 9, d: 23 }]) {
      const e = dayEvents(lat, 0, 0, date);
      near(e.dayLength, 720, 20, `緯度 ${lat} の昼の長さ`);
    }
  }
});

test('正午は左右対称：(日の出+日の入り)/2 = 南中', () => {
  const e = dayEvents(...TOKYO, { y: 2025, m: 5, d: 1 });
  near((e.sunrise + e.sunset) / 2, e.solarNoon, 0.6, '南中の対称性');
});

test('南中高度 = 90 − |緯度 − 赤緯|', () => {
  for (const date of [{ y: 2025, m: 6, d: 21 }, { y: 2025, m: 12, d: 22 }, { y: 2025, m: 9, d: 23 }]) {
    const e = dayEvents(...TOKYO, date);
    const noon = sunPosition(...TOKYO, date, Math.round(e.solarNoon));
    near(e.noonElevation, 90 - Math.abs(35.6895 - noon.decl), 0.3, '南中高度');
  }
});

test('夏は長く、冬は短い（北半球）。南半球は逆', () => {
  const tN = lat => [lat, 139, 9];
  const nSummer = dayEvents(...tN(35.69), { y: 2025, m: 6, d: 21 }).dayLength;
  const nWinter = dayEvents(...tN(35.69), { y: 2025, m: 12, d: 22 }).dayLength;
  assert.ok(nSummer > nWinter, '北半球：夏 > 冬');
  const sJun = dayEvents(-33.87, 151, 10, { y: 2025, m: 6, d: 21 }).dayLength;
  const sDec = dayEvents(-33.87, 151, 10, { y: 2025, m: 12, d: 22 }).dayLength;
  assert.ok(sDec > sJun, '南半球：12月 > 6月');
});

test('太陽は北半球で南を通り、午前は東・午後は西', () => {
  const date = { y: 2025, m: 3, d: 20 };
  const e = dayEvents(...TOKYO, date);
  near(e.noonAzimuth, 180, 1.5, '南中は真南');
  const morning = sunPosition(...TOKYO, date, 9 * 60);
  const evening = sunPosition(...TOKYO, date, 15 * 60);
  assert.ok(morning.azimuth < 180, '午前は東寄り（方位 < 180）');
  assert.ok(evening.azimuth > 180, '午後は西寄り（方位 > 180）');
});

test('薄明は日の出より前、日の入りより後の順に並ぶ', () => {
  const e = dayEvents(...TOKYO, { y: 2025, m: 4, d: 10 });
  assert.ok(e.astroDawn < e.nauticalDawn);
  assert.ok(e.nauticalDawn < e.civilDawn);
  assert.ok(e.civilDawn < e.sunrise);
  assert.ok(e.sunset < e.civilDusk);
  assert.ok(e.civilDusk < e.nauticalDusk);
  assert.ok(e.nauticalDusk < e.astroDusk);
});

test('白夜と極夜：北極圏では夏に沈まず、冬に昇らない', () => {
  const summer = dayEvents(69.6, 18.9, 1, { y: 2025, m: 6, d: 21 });
  assert.equal(summer.polar, 'up');
  assert.equal(summer.sunrise, null);
  assert.equal(summer.dayLength, 1440);
  const winter = dayEvents(69.6, 18.9, 1, { y: 2025, m: 12, d: 22 });
  assert.equal(winter.polar, 'down');
  assert.equal(winter.dayLength, 0);
});

test('ユリウス日と時刻表記', () => {
  assert.equal(julianDayNumber(2000, 1, 1), 2451545);   // 2000-01-01 正午
  assert.equal(hhmm(0), '00:00');
  assert.equal(hhmm(9 * 60 + 5), '09:05');
  assert.equal(hhmm(1440 + 30), '00:30');               // 翌日へ丸める
  assert.equal(hhmm(null), '--:--');
});
