/* ============================================================
   地理 — 針の数学。すべて DOM を知らない純粋な計算。

   距離と方位は球面三角（haversine / 大円の初期方位角）。
   磁石は磁北を指すので、国土地理院の磁気偏角近似式
   （2020.0年値、日本周辺で誤差おおむね 0.2° 以内）で真北に直す。
   針の角度 = 目的地の方位 − いま向いている方位。それだけ。
   ============================================================ */

const R = 6371008.8;                       // 地球の平均半径 [m]
const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;

/* 2 点間の距離 [m]（haversine） */
export function distance(lat1, lon1, lat2, lon2) {
  const dφ = rad(lat2 - lat1), dλ = rad(lon2 - lon1);
  const a = Math.sin(dφ / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/* 1 → 2 への初期方位角 [度、真北 0、時計回り 0–360) */
export function bearing(lat1, lon1, lat2, lon2) {
  const φ1 = rad(lat1), φ2 = rad(lat2), dλ = rad(lon2 - lon1);
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/* 磁気偏角 [度、西偏が正]。国土地理院の近似式（2020.0年値）。
   日本のあたりの外では 0 を返す（補正しないだけ。針は少し訛る）。 */
export function declination(lat, lon) {
  if (lat < 20 || lat > 50 || lon < 120 || lon > 155) return 0;
  const dp = lat - 37, dl = lon - 138;
  const minutes = (8 * 60 + 15.822)
    + 18.462 * dp - 7.726 * dl
    + 0.007 * dp * dp - 0.007 * dp * dl - 0.655 * dl * dl;
  return minutes / 60;
}

/* 磁北基準の向き → 真北基準の向き */
export function trueHeading(magneticHeading, lat, lon) {
  return ((magneticHeading - declination(lat, lon)) % 360 + 360) % 360;
}

/* 端末の向きセンサ → 磁北基準の向き [度]。
   iOS は webkitCompassHeading がそのまま磁北からの向き。
   それ以外は deviceorientationabsolute の alpha（反時計回り）を
   時計回りに返し、画面の回転ぶんを足す。 */
export function headingFromEvent({ webkitCompassHeading, alpha, absolute }, screenAngle = 0) {
  if (typeof webkitCompassHeading === 'number' && !Number.isNaN(webkitCompassHeading)) {
    return (webkitCompassHeading % 360 + 360) % 360;
  }
  if (typeof alpha === 'number' && absolute) {
    return ((360 - alpha + screenAngle) % 360 + 360) % 360;
  }
  return null;
}

/* 針の回す角度：目的地の方位 − いまの向き → -180..180 に畳む */
export function needleAngle(bearingDeg, headingDeg) {
  let a = (bearingDeg - headingDeg) % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

/* 向きの川下り — 角度の指数平滑。0/360 の継ぎ目で暴れないよう
   単位ベクトルの上でならす。alpha は 0..1（大きいほど機敏） */
export class HeadingSmoother {
  constructor(alpha = 0.25) {
    this.alpha = alpha;
    this.x = null;
    this.y = null;
  }
  push(h) {
    const x = Math.cos(rad(h)), y = Math.sin(rad(h));
    if (this.x === null) { this.x = x; this.y = y; }
    else {
      this.x += (x - this.x) * this.alpha;
      this.y += (y - this.y) * this.alpha;
    }
    return this.value();
  }
  value() {
    if (this.x === null) return null;
    return (deg(Math.atan2(this.y, this.x)) + 360) % 360;
  }
}

/* 測位の精度加重平均 — 「刺す」とき数秒ぶんの GPS をならして 1 点に。
   重みは 1/精度²（精度 [m] が良い点ほど信じる）。
   返り値 { lat, lon, acc } — acc は最良の精度を採る。 */
export function averagePosition(fixes) {
  if (!fixes.length) return null;
  let sw = 0, slat = 0, slon = 0, best = Infinity;
  for (const f of fixes) {
    const acc = Math.max(1, f.acc ?? 50);
    const w = 1 / (acc * acc);
    sw += w; slat += f.lat * w; slon += f.lon * w;
    if (acc < best) best = acc;
  }
  return { lat: slat / sw, lon: slon / sw, acc: best };
}

/* 距離のことば。1km 未満は m、それ以上は km。歩く速さ 80m/分。 */
export function fmtDistance(m) {
  if (!Number.isFinite(m)) return '—';
  const walk = Math.round(m / 80);
  if (m < 1000) {
    const v = m < 100 ? Math.round(m) : Math.round(m / 5) * 5;
    return { main: String(v), unit: 'm', walk: walk >= 1 ? `歩いて約${walk}分` : 'すぐそこ' };
  }
  const km = m < 10000 ? (m / 1000).toFixed(1) : String(Math.round(m / 1000));
  return { main: km, unit: 'km', walk: `歩いて約${walk}分` };
}

/* 方位のことば（コンパスの無い機械への、せめてもの言葉） */
const DIRS = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東',
  '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
export function dirWord(bearingDeg) {
  return DIRS[Math.round(((bearingDeg % 360 + 360) % 360) / 22.5) % 16];
}

/* 振動の脈 — 針が合っているほど速く脈打つ。
   ずれ |angle| ≤ 15° で最速 (250ms)、90° 以上は沈黙 (null)。 */
export function pulseInterval(angleDeg) {
  const a = Math.abs(angleDeg);
  if (a >= 90) return null;
  if (a <= 15) return 250;
  return Math.round(250 + (a - 15) * (1250 - 250) / (90 - 15));
}
