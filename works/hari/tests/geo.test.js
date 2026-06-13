import test from 'node:test';
import assert from 'node:assert/strict';
import {
  distance, bearing, declination, trueHeading, headingFromEvent,
  needleAngle, HeadingSmoother, averagePosition, fmtDistance, dirWord,
  pulseInterval, pickHeading,
} from '../js/core/geo.js';

const 東京駅 = [35.6812, 139.7671];
const 新宿駅 = [35.6896, 139.7006];
const 大阪駅 = [34.7025, 135.4959];
const 札幌 = [43.0680, 141.3500];
const 那覇 = [26.2124, 127.6792];

test('距離：東京駅—新宿駅はおよそ 6km、東京—大阪はおよそ 400km', () => {
  const a = distance(...東京駅, ...新宿駅);
  assert.ok(a > 5500 && a < 6500, `東京—新宿 ${a}m`);
  const b = distance(...東京駅, ...大阪駅);
  assert.ok(b > 390_000 && b < 410_000, `東京—大阪 ${b}m`);
  assert.equal(distance(...東京駅, ...東京駅), 0);
});

test('方位：真東は 90°、真北は 0°、札幌は東京のほぼ真北', () => {
  assert.ok(Math.abs(bearing(0, 0, 0, 1) - 90) < 1e-9);
  assert.ok(Math.abs(bearing(0, 0, 1, 0) - 0) < 1e-9);
  assert.ok(Math.abs(bearing(0, 0, -1, 0) - 180) < 1e-9);
  const b = bearing(...東京駅, ...札幌);
  assert.ok(b > 5 && b < 15, `東京→札幌 ${b}°`);
  assert.equal(dirWord(b), '北');
  assert.equal(dirWord(bearing(...東京駅, ...大阪駅)), '西南西');
});

test('磁気偏角：国土地理院の近似式が観測値のそばに落ちる（西偏が正）', () => {
  // 磁気図 2020.0 のおよその値：東京 7°40′、札幌 9°30′、那覇 5°00′
  assert.ok(Math.abs(declination(...東京駅) - 7.66) < 0.35, `東京 ${declination(...東京駅)}`);
  assert.ok(Math.abs(declination(...札幌) - 9.5) < 0.45, `札幌 ${declination(...札幌)}`);
  assert.ok(Math.abs(declination(...那覇) - 5.0) < 0.45, `那覇 ${declination(...那覇)}`);
});

test('磁気偏角：日本のそとでは補正しない（0 を返す）', () => {
  assert.equal(declination(48.85, 2.35), 0);     // パリ
  assert.equal(declination(-33.87, 151.21), 0);  // シドニー
});

test('真北への直し：東京で磁石が 8° を指すとき、ほぼ真北を向いている', () => {
  const t = trueHeading(8, ...東京駅);
  assert.ok(t < 1 || t > 359, `trueHeading ${t}`);
  // 偏角ぶんだけ戻すので、0 を切っても負にならず 360 側に巻く
  assert.ok(trueHeading(0, ...東京駅) > 350);
});

test('センサのことば：iOS の webkitCompassHeading をそのまま信じる', () => {
  assert.equal(headingFromEvent({ webkitCompassHeading: 45 }), 45);
  assert.equal(headingFromEvent({ webkitCompassHeading: 0, alpha: 90 }), 0);
});

test('センサのことば：absolute な alpha は反時計回り→時計回りに直し、画面の回転を足す', () => {
  assert.equal(headingFromEvent({ alpha: 90, absolute: true }), 270);
  assert.equal(headingFromEvent({ alpha: 90, absolute: true }, 90), 0);
  assert.equal(headingFromEvent({ alpha: 0, absolute: true }), 0);
});

test('センサのことば：相対 alpha やセンサ無しは null（嘘をつかない）', () => {
  assert.equal(headingFromEvent({ alpha: 90, absolute: false }), null);
  assert.equal(headingFromEvent({}), null);
});

test('針の角度：継ぎ目（0/360）をまたいでも近いほうに振れる', () => {
  assert.equal(needleAngle(350, 10), -20);
  assert.equal(needleAngle(10, 350), 20);
  assert.equal(needleAngle(90, 90), 0);
  assert.equal(Math.abs(needleAngle(180, 0)), 180);
});

test('向きの川下り：359° と 1° をならすと 180° ではなく 0° のそばへ', () => {
  const s = new HeadingSmoother(0.5);
  s.push(359);
  for (let i = 0; i < 20; i++) s.push(1);
  const v = s.value();
  assert.ok(v < 5 || v > 355, `smoothed ${v}`);
});

test('測位の平均：精度の良い点が強く信じられる', () => {
  const p = averagePosition([
    { lat: 35.0, lon: 139.0, acc: 5 },
    { lat: 36.0, lon: 140.0, acc: 100 },
  ]);
  assert.ok(Math.abs(p.lat - 35.0) < 0.01, `lat ${p.lat}`);
  assert.ok(Math.abs(p.lon - 139.0) < 0.01);
  assert.equal(p.acc, 5);
  assert.equal(averagePosition([]), null);
});

test('距離のことば：m / km / 歩いて何分', () => {
  assert.deepEqual(fmtDistance(35), { main: '35', unit: 'm', walk: 'すぐそこ' });
  assert.deepEqual(fmtDistance(842), { main: '840', unit: 'm', walk: '歩いて約11分' });
  assert.deepEqual(fmtDistance(1234), { main: '1.2', unit: 'km', walk: '歩いて約15分' });
  assert.deepEqual(fmtDistance(15400), { main: '15', unit: 'km', walk: '歩いて約193分' });
  assert.equal(fmtDistance(NaN), '—');
});

test('方位のことば：十六方位', () => {
  assert.equal(dirWord(0), '北');
  assert.equal(dirWord(45), '北東');
  assert.equal(dirWord(90), '東');
  assert.equal(dirWord(200), '南南西');
  assert.equal(dirWord(350), '北');
});

test('振動の脈：合うほど速く、90° からは沈黙', () => {
  assert.equal(pulseInterval(0), 250);
  assert.equal(pulseInterval(-12), 250);
  assert.equal(pulseInterval(90), null);
  assert.equal(pulseInterval(170), null);
  const mid = pulseInterval(52.5);
  assert.ok(mid > 600 && mid < 900, `mid ${mid}`);
  assert.ok(pulseInterval(30) < pulseInterval(60), '近いほうが速い');
});

test('向きの出どころ：磁石が生きていれば磁石を信じる', () => {
  const now = 10_000;
  const p = pickHeading({ compass: 80, compassAt: now - 500, gps: 200, gpsSpeed: 2, gpsAt: now, now });
  assert.deepEqual(p, { heading: 80, source: 'compass' });
});

test('向きの出どころ：磁石が黙ったら、歩いている間は GPS の進行方位', () => {
  const now = 10_000;
  const p = pickHeading({ compass: 80, compassAt: now - 5000, gps: 365, gpsSpeed: 1.2, gpsAt: now - 1000, now });
  assert.deepEqual(p, { heading: 5, source: 'gps' });
});

test('向きの出どころ：立ち止まれば GPS は信じない、古い情報も信じない', () => {
  const now = 10_000;
  assert.equal(pickHeading({ gps: 90, gpsSpeed: 0.2, gpsAt: now, now }).source, 'none');
  assert.equal(pickHeading({ gps: 90, gpsSpeed: 2, gpsAt: now - 9000, now }).source, 'none');
  assert.equal(pickHeading({ gps: NaN, gpsSpeed: 2, gpsAt: now, now }).source, 'none');
  assert.equal(pickHeading({ now }).heading, null);
});
