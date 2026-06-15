/* 水面を描く — 高さの場を、空を映す水にする。
   傾きで空のグラデを屈折させて帯（caustics）をつくり、稜にきらめき（specular）を載せる。
   格子ぶんの ImageData を一枚作り、画面いっぱいへなめらかに引き伸ばす。 */

const LZ = 2.4;          // 法線の z 成分（小さいほど波が立って見える）
const REFR = 5.5;        // 屈折で空をどれだけずらして映すか

/* 空（遠くの水ほど明るく、手前ほど深い）— 行ごとの色を先に作っておく */
function buildSky(h) {
  const top = [30, 86, 112], bot = [7, 26, 42];
  const sky = new Float32Array(h * 3);
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    sky[y * 3] = top[0] + (bot[0] - top[0]) * t;
    sky[y * 3 + 1] = top[1] + (bot[1] - top[1]) * t;
    sky[y * 3 + 2] = top[2] + (bot[2] - top[2]) * t;
  }
  return sky;
}

export function fitView(view, water, cssW, cssH) {
  view.cssW = cssW; view.cssH = cssH;
  view.off = view.off || document.createElement('canvas');
  view.off.width = water.w; view.off.height = water.h;
  view.octx = view.off.getContext('2d');
  view.img = view.octx.createImageData(water.w, water.h);
  view.sky = buildSky(water.h);
}

export function drawWater(ctx, water, view, now) {
  const { w, h } = water;
  const cur = water.cur;
  const { img, sky } = view;
  const data = img.data;

  // 光は、ゆっくり水面を巡る
  const a = now * 0.00018;
  let lx = Math.cos(a) * 0.7, ly = Math.sin(a) * 0.7 - 0.2;
  const ll = Math.hypot(lx, ly, LZ);
  lx /= ll; ly /= ll; const lz = LZ / ll;

  for (let y = 0; y < h; y++) {
    const ym = (y > 0 ? y - 1 : y) * w;
    const yp = (y < h - 1 ? y + 1 : y) * w;
    const yc = y * w;
    for (let x = 0; x < w; x++) {
      const i = yc + x;
      const xm = x > 0 ? x - 1 : x, xp = x < w - 1 ? x + 1 : x;
      const L = cur[yc + xm], R = cur[yc + xp], U = cur[ym + x], D = cur[yp + x];
      const c = cur[i];
      const dx = L - R, dy = U - D;
      const lap = L + R + U + D - 4 * c;

      // 屈折：傾きぶん、映す空の行をずらす
      let sy = y + dy * REFR;
      if (sy < 0) sy = 0; else if (sy > h - 1) sy = h - 1;
      const si = (sy | 0) * 3;

      // きらめき：法線が光を向くほど強い
      const nl = (dx * lx + dy * ly + lz * LZ) / Math.hypot(dx, dy, LZ);
      const spec = nl > 0 ? Math.pow(nl, 60) : 0;
      // 稜（盛り上がり lap<0）はほのかに明るむ
      const caust = lap < 0 ? -lap * 80 : 0;

      let r = sky[si] + spec * 210 + caust * 0.7;
      let g = sky[si + 1] + spec * 225 + caust * 0.9;
      let b = sky[si + 2] + spec * 255 + caust * 1.1;
      const o = i * 4;
      data[o] = r > 255 ? 255 : r;
      data[o + 1] = g > 255 ? 255 : g;
      data[o + 2] = b > 255 ? 255 : b;
      data[o + 3] = 255;
    }
  }

  view.octx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(view.off, 0, 0, view.cssW, view.cssH);
}
