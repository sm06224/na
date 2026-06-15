/* ============================================================
   窟 — 視界。再帰的シャドウキャストで、灯りの届く先を決める。
   壁の影に隠れたものは見えない。八つの八分円を同じ規則で。
   ============================================================ */

/* computeFOV(ox,oy,radius, isOpaque(x,y), setVisible(x,y,dist))
   原点はつねに見える。半径内で、遮りの向こうは陰になる。 */
export function computeFOV(ox, oy, radius, isOpaque, setVisible) {
  setVisible(ox, oy, 0);
  for (let oct = 0; oct < 8; oct++) {
    castLight(1, 1.0, 0.0, radius, OCT[oct], ox, oy, isOpaque, setVisible);
  }
}

/* 八分円の変換（xx,xy,yx,yy） */
const OCT = [
  [1, 0, 0, 1], [0, 1, 1, 0], [0, -1, 1, 0], [-1, 0, 0, 1],
  [-1, 0, 0, -1], [0, -1, -1, 0], [0, 1, -1, 0], [1, 0, 0, -1],
];

function castLight(row, start, end, radius, t, ox, oy, isOpaque, setVisible) {
  if (start < end) return;
  const [xx, xy, yx, yy] = t;
  const r2 = radius * radius;
  let nextStart = start;
  for (let i = row; i <= radius; i++) {
    let dx = -i - 1, dy = -i;
    let blocked = false;
    while (dx <= 0) {
      dx++;
      const mx = ox + dx * xx + dy * xy;
      const my = oy + dx * yx + dy * yy;
      const lSlope = (dx - 0.5) / (dy + 0.5);
      const rSlope = (dx + 0.5) / (dy - 0.5);
      if (rSlope > start) continue;
      if (lSlope < end) break;

      const dist2 = dx * dx + dy * dy;
      if (dist2 <= r2) setVisible(mx, my, Math.sqrt(dist2));

      const opaque = isOpaque(mx, my);
      if (blocked) {
        if (opaque) { nextStart = rSlope; continue; }
        else { blocked = false; start = nextStart; }
      } else if (opaque && i < radius) {
        blocked = true;
        castLight(i + 1, start, lSlope, radius, t, ox, oy, isOpaque, setVisible);
        nextStart = rSlope;
      }
    }
    if (blocked) break;
  }
}

/* 単純な直線見通し（投擲や遠隔の判定に） */
export function hasLine(ax, ay, bx, by, isOpaque) {
  let dx = Math.abs(bx - ax), dy = Math.abs(by - ay);
  let sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
  let err = dx - dy, x = ax, y = ay;
  for (;;) {
    if (x === bx && y === by) return true;
    if ((x !== ax || y !== ay) && isOpaque(x, y)) return false;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}
