/* トーラス世界（端がつながった世界）の幾何ユーティリティ */

/* a→b の最短符号付き距離（世界の継ぎ目をまたぐ場合を考慮） */
export function wrapDelta(a, b, size) {
  let d = b - a;
  if (d > size / 2) d -= size;
  else if (d < -size / 2) d += size;
  return d;
}

export function wrapPos(x, size) {
  x %= size;
  return x < 0 ? x + size : x;
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

export function torusDist2(ax, ay, bx, by, size) {
  const dx = wrapDelta(ax, bx, size);
  const dy = wrapDelta(ay, by, size);
  return dx * dx + dy * dy;
}
