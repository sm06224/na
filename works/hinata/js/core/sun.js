/* ============================================================
   陽 — 太陽の位置を、種ではなく「場所と日付」から決める。

   `針` が球面三角で帰り道を指したように、ここでは球面天文で
   太陽の高さと方位を出す。NOAA Solar Calculator と同じ式
   （太陽の赤緯・均時差・時角）。依存ゼロ・DOM 非依存——
   Node の中でも、同じ陽が同じ時刻に昇る。

   時刻はすべて「その地の真夜中 0:00 からの分」で返す。
   経度は東経を正（東京＝+139.69）、tz は UTC からの時差（東京＝+9）。
   ============================================================ */

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const sin = d => Math.sin(d * D2R), cos = d => Math.cos(d * D2R);
const asin = x => Math.asin(Math.max(-1, Math.min(1, x))) * R2D;
const acos = x => Math.acos(Math.max(-1, Math.min(1, x))) * R2D;

/* 暦日 → ユリウス日（正午基準の整数 JDN） */
export function julianDayNumber(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy
    + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
}

/* JD（時刻込み）から、太陽の赤緯 δ(度) と 均時差 EoT(分) を出す */
function solarParams(jd) {
  const jc = (jd - 2451545) / 36525;
  const L0 = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360;
  const M = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
  const C = sin(M) * (1.914602 - jc * (0.004817 + 0.000014 * jc))
    + sin(2 * M) * (0.019993 - 0.000101 * jc)
    + sin(3 * M) * 0.000289;
  const trueLong = L0 + C;
  const lambda = trueLong - 0.00569 - 0.00478 * sin(125.04 - 1934.136 * jc);
  const eps0 = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * cos(125.04 - 1934.136 * jc);
  const decl = asin(sin(eps) * sin(lambda));
  // 均時差（分）
  const y = Math.tan(eps / 2 * D2R) ** 2;
  const L0r = L0 * D2R, Mr = M * D2R;
  const eot = 4 * R2D * (y * Math.sin(2 * L0r) - 2 * e * Math.sin(Mr)
    + 4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r)
    - 0.5 * y * y * Math.sin(4 * L0r) - 1.25 * e * e * Math.sin(2 * Mr));
  return { decl, eot };
}

function jdAt(date, tz, minutes) {
  const jdn = julianDayNumber(date.y, date.m, date.d);
  const utcHours = minutes / 60 - tz;     // 0:00 地方時 = (−tz)h UTC
  return jdn - 0.5 + utcHours / 24;
}

/* ----- 太陽の位置：ある地・ある日・ある分の、高さと方位 ----- */
export function sunPosition(lat, lonE, tz, date, minutes) {
  const jd = jdAt(date, tz, minutes);
  const { decl, eot } = solarParams(jd);
  const tst = minutes - tz * 60 + 4 * lonE + eot;   // 真太陽時（分）
  const H = tst / 4 - 180;                           // 時角（度・正午で 0）
  const elevation = asin(sin(lat) * sin(decl) + cos(lat) * cos(decl) * cos(H));
  let az = acos((sin(decl) - sin(elevation) * sin(lat)) / (cos(elevation) * cos(lat)));
  if (H > 0) az = 360 - az;                          // 午後は西寄り
  return { elevation, azimuth: az, decl, eot };
}

/* ある高さ a(度) を、朝と夕にまたぐ時刻（分）を返す。
   返り値 {rise, set}。極夜・白夜のときは null。 */
function crossing(lat, lonE, tz, date, a) {
  const { decl, eot } = solarParams(jdAt(date, tz, 720));
  const solarNoon = 720 + tz * 60 - 4 * lonE - eot;
  const cosH = (sin(a) - sin(lat) * sin(decl)) / (cos(lat) * cos(decl));
  if (cosH < -1) return { rise: null, set: null, always: 'up', solarNoon };   // 沈まない
  if (cosH > 1) return { rise: null, set: null, always: 'down', solarNoon };  // 昇らない
  const H0 = acos(cosH);
  return { rise: solarNoon - 4 * H0, set: solarNoon + 4 * H0, solarNoon };
}

/* ----- その日のひとそろい：日の出・日の入り・薄明・黄金時間 ----- */
export function dayEvents(lat, lonE, tz, date) {
  const sun = crossing(lat, lonE, tz, date, -0.833);        // 太陽の上端＋大気差
  const civil = crossing(lat, lonE, tz, date, -6);
  const nautical = crossing(lat, lonE, tz, date, -12);
  const astro = crossing(lat, lonE, tz, date, -18);
  const goldenLo = crossing(lat, lonE, tz, date, -4);       // 黄金時間の外端
  const goldenHi = crossing(lat, lonE, tz, date, 6);        // 黄金時間の内端
  const noon = sunPosition(lat, lonE, tz, date, Math.round(sun.solarNoon));

  let dayLength = null;
  if (sun.rise != null) dayLength = sun.set - sun.rise;
  else if (sun.always === 'up') dayLength = 1440;
  else if (sun.always === 'down') dayLength = 0;

  return {
    solarNoon: sun.solarNoon,
    noonElevation: noon.elevation,
    noonAzimuth: noon.azimuth,
    sunrise: sun.rise, sunset: sun.set,
    polar: sun.rise == null ? sun.always : null,    // 'up'=白夜 / 'down'=極夜
    dayLength,
    civilDawn: civil.rise, civilDusk: civil.set,
    nauticalDawn: nautical.rise, nauticalDusk: nautical.set,
    astroDawn: astro.rise, astroDusk: astro.set,
    // 黄金時間：高さ −4°〜+6°。朝は rise(−4) → rise(+6)、夕は set(+6) → set(−4)
    goldenMorning: (goldenLo.rise != null && goldenHi.rise != null)
      ? { start: goldenLo.rise, end: goldenHi.rise } : null,
    goldenEvening: (goldenHi.set != null && goldenLo.set != null)
      ? { start: goldenHi.set, end: goldenLo.set } : null,
  };
}

/* 分 → "HH:MM"（24h 内に丸める） */
export function hhmm(min) {
  if (min == null) return '--:--';
  let m = Math.round(min);
  m = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
