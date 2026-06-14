/* ============================================================
   窓の日当たり — その窓に、一日どれだけ直射日光が入るか。

   窓は「向き（方位角 facingAz・南＝180）」と、目の前をふさぐ
   「遮り（obstructionElev・度。隣家や山の高さ）」を持つ。
   太陽が遮りより高く、かつ窓の正面（向きから±90°）にいる
   あいだだけ、直射が射し込む。一分きざみで決定的に数える。
   ============================================================ */

import { sunPosition } from './sun.js';

/* 方位角の差（0〜180） */
function azDiff(a, b) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/* その日、窓に直射が入る時間帯（分）と合計を返す。
   facingAz: 窓の向き（南=180, 東=90, 西=270, 北=0）
   obstructionElev: 遮りの仰角（度）。0 なら水平線まで開けている。
   acceptance: 正面とみなす半角（既定 90° ＝ 真横まで）。 */
export function windowSunlight(lat, lonE, tz, date, facingAz, obstructionElev = 0, acceptance = 90) {
  const intervals = [];
  let cur = null;
  let total = 0;
  for (let min = 0; min <= 1440; min++) {
    const lit = isLit(lat, lonE, tz, date, min, facingAz, obstructionElev, acceptance);
    if (lit && min < 1440) {
      if (cur == null) cur = min;
      total++;
    } else if (cur != null) {
      intervals.push({ start: cur, end: min });
      cur = null;
    }
  }
  return { intervals, totalMinutes: total };
}

function isLit(lat, lonE, tz, date, min, facingAz, obstructionElev, acceptance) {
  const s = sunPosition(lat, lonE, tz, date, min);
  return s.elevation > obstructionElev && azDiff(s.azimuth, facingAz) <= acceptance;
}

/* 通年：毎月 15 日の日当たり時間（時間）を 12 個の配列で。
   部屋探し・家庭菜園で「冬にどれだけ陽が入るか」を見るための早見。 */
export function yearlySunlight(lat, lonE, tz, year, facingAz, obstructionElev = 0, acceptance = 90) {
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const { totalMinutes } = windowSunlight(lat, lonE, tz, { y: year, m, d: 15 }, facingAz, obstructionElev, acceptance);
    out.push(totalMinutes / 60);
  }
  return out;
}

export const FACING = {
  '南': 180, '南東': 135, '東': 90, '北東': 45,
  '北': 0, '北西': 315, '西': 270, '南西': 225,
};
