import { SIZE, WATER, BIOME } from '../core/terrain.js';

/* ============================================================
   地図 — 歴史書の挿絵。地形・政治・道・都市を層で描く。
   ============================================================ */

export const PX = 8;   // ベイク解像度（px / タイル）

export class Camera {
  constructor(viewW, viewH) {
    this.x = SIZE / 2; this.y = SIZE / 2;       // タイル座標の中心
    this.zoom = Math.min(viewW, viewH) / SIZE;  // px / タイル
    this.minZoom = this.zoom * 0.8;
  }
  clamp() {
    this.zoom = Math.max(this.minZoom, Math.min(26, this.zoom));
    const m = 30;
    this.x = Math.max(-m, Math.min(SIZE + m, this.x));
    this.y = Math.max(-m, Math.min(SIZE + m, this.y));
  }
  toScreen(tx, ty, w, h) {
    return { x: (tx - this.x) * this.zoom + w / 2, y: (ty - this.y) * this.zoom + h / 2 };
  }
  toTile(sx, sy, w, h) {
    return { x: this.x + (sx - w / 2) / this.zoom, y: this.y + (sy - h / 2) / this.zoom };
  }
}

/* ---------- 地形ベイク（世界の誕生時に一度だけ） ---------- */
const BIOME_COLOR = [
  [88, 110, 70],    // GRASS
  [58, 84, 60],     // FOREST
  [168, 144, 92],   // DESERT
  [142, 150, 155],  // TUNDRA
  [120, 114, 104],  // MOUNTAIN
];

export function bakeTerrain(world) {
  const t = world.terrain;
  const cv = makeCanvas(SIZE * PX, SIZE * PX);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(SIZE, SIZE);
  const d = img.data;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      let r, g, b;
      if (t.water[i] === WATER.OCEAN) {
        const depth = Math.max(0, (t.sea - t.elev[i]) / t.sea);
        r = 11 + (1 - depth) * 14; g = 30 + (1 - depth) * 24; b = 52 + (1 - depth) * 28;
      } else if (t.water[i] === WATER.LAKE) {
        r = 26; g = 64; b = 88;
      } else {
        [r, g, b] = BIOME_COLOR[t.biome[i]];
        // 標高による陰影（左上からの光）
        const e = t.elev[i];
        const ex = x > 0 ? t.elev[i - 1] : e;
        const ey = y > 0 ? t.elev[i - SIZE] : e;
        const shade = 1 + ((ex - e) + (ey - e)) * 6;
        const heightFade = 0.75 + 0.45 * ((e - t.sea) / (t.peak - t.sea));
        const k = Math.max(0.55, Math.min(1.5, shade)) * heightFade;
        r *= k; g *= k; b *= k;
        // 高峰は雪
        if (t.biome[i] === BIOME.MOUNTAIN && (e - t.sea) / (t.peak - t.sea) > 0.82) {
          r = 196; g = 202; b = 210;
        }
        if (t.river[i]) { r = 42; g = 104; b = 140; }
      }
      const o = i * 4;
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
  }
  // 1px で描いて PX 倍に引き伸ばす
  const small = makeCanvas(SIZE, SIZE);
  small.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, SIZE * PX, SIZE * PX);
  return cv;
}

/* ---------- 政治レイヤー（領土が変わるたびに塗り直す） ---------- */
export function bakePolitical(world, cv) {
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  const owner = world.owner;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const o = owner[i];
      if (o <= 0) continue;
      const n = world.nations.get(o);
      if (!n) continue;
      // 国境のタイルは濃く
      const isBorder =
        (x > 0 && owner[i - 1] !== o) || (x < SIZE - 1 && owner[i + 1] !== o) ||
        (y > 0 && owner[i - SIZE] !== o) || (y < SIZE - 1 && owner[i + SIZE] !== o);
      ctx.fillStyle = `hsla(${n.hue}, 65%, 58%, ${isBorder ? 0.55 : 0.22})`;
      ctx.fillRect(x * PX, y * PX, PX, PX);
    }
  }
}

/* ---------- 道路レイヤー ---------- */
export function bakeRoads(world, cv) {
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = 'rgba(206, 176, 120, 0.75)';
  ctx.lineWidth = PX * 0.22;
  ctx.lineCap = 'round';
  const road = world.road;
  ctx.beginPath();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!road[y * SIZE + x]) continue;
      const cx = (x + 0.5) * PX, cy = (y + 0.5) * PX;
      // 右・下・右下・左下にだけ線を引けば重複しない
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
        if (road[ny * SIZE + nx]) {
          ctx.moveTo(cx, cy);
          ctx.lineTo((nx + 0.5) * PX, (ny + 0.5) * PX);
        }
      }
    }
  }
  ctx.stroke();
}

function makeCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return cv;
}

/* ---------- 毎フレームの合成 ---------- */
export function drawMap(ctx, world, cam, layers, opts, w, h) {
  ctx.fillStyle = '#04050a';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2 - cam.x * cam.zoom, h / 2 - cam.y * cam.zoom);
  const s = cam.zoom / PX;
  ctx.scale(s, s);
  ctx.imageSmoothingEnabled = cam.zoom < PX;
  ctx.drawImage(layers.terrain, 0, 0);
  if (opts.political) ctx.drawImage(layers.political, 0, 0);
  ctx.drawImage(layers.roads, 0, 0);
  ctx.restore();

  /* 交易路 */
  if (opts.trade) {
    ctx.strokeStyle = 'rgba(140, 200, 255, 0.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const [a, b] of world.tradePairs) {
      const sa = world.settlementById.get(a);
      const sb = world.settlementById.get(b);
      if (!sa || !sb) continue;
      const p = cam.toScreen(sa.x + 0.5, sa.y + 0.5, w, h);
      const q = cam.toScreen(sb.x + 0.5, sb.y + 0.5, w, h);
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
  }

  /* 都市 */
  const month = world.totalMonths;
  for (const c of world.settlements) {
    const p = cam.toScreen(c.x + 0.5, c.y + 0.5, w, h);
    if (p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) continue;
    const tier = c.tier();
    const r = (1.2 + tier * 0.9) * Math.max(1.4, cam.zoom * 0.32);
    const n = world.nations.get(c.nationId);
    const color = n ? `hsl(${n.hue}, 70%, 62%)` : '#9aa0ae';

    if (c === opts.selected) {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    if (c.isCapital) {  // 首都は輪を戴く
      ctx.strokeStyle = 'rgba(255, 226, 150, 0.95)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2); ctx.stroke();
    }
    if (c.wonders.length) {  // 大事業の光
      ctx.fillStyle = 'rgba(255, 220, 130, 0.95)';
      ctx.beginPath(); ctx.arc(p.x + r * 0.9, p.y - r * 0.9, 1.8, 0, Math.PI * 2); ctx.fill();
    }
    if (c.plagueUntil > month) {  // 疫病の印
      const pulse = 0.5 + 0.5 * Math.sin(month * 0.8 + c.id);
      ctx.strokeStyle = `rgba(170, 255, 120, ${0.35 + 0.4 * pulse})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 3 + pulse * 2, 0, Math.PI * 2); ctx.stroke();
    }
  }

  /* 地名 — ズームに応じて、大きな都市から */
  if (opts.labels && cam.zoom > 2.6) {
    ctx.font = `${Math.min(13, 9 + cam.zoom * 0.18)}px ui-sans-serif, sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 3;
    const minPop = cam.zoom > 8 ? 100 : (cam.zoom > 5 ? 800 : 2500);
    for (const c of world.settlements) {
      if (c.pop < minPop && !c.isCapital) continue;
      const p = cam.toScreen(c.x + 0.5, c.y + 0.5, w, h);
      if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) continue;
      ctx.fillStyle = c.isCapital ? 'rgba(255,236,190,0.95)' : 'rgba(225,230,245,0.85)';
      ctx.fillText(c.name, p.x, p.y - (1.2 + c.tier() * 0.9) * Math.max(1.4, cam.zoom * 0.32) - 4);
    }
    ctx.shadowBlur = 0;
  }

  /* 出来事の閃光（陥落・疫病・反乱・大事業） */
  const now = performance.now();
  for (let i = opts.flashes.length - 1; i >= 0; i--) {
    const f = opts.flashes[i];
    const age = (now - f.t0) / 1600;
    if (age > 1) { opts.flashes.splice(i, 1); continue; }
    const p = cam.toScreen(f.x + 0.5, f.y + 0.5, w, h);
    ctx.strokeStyle = f.color.replace('%a', String(0.8 * (1 - age)));
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4 + age * 26, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/* ---------- ミニマップ ---------- */
export function drawMinimap(ctx, world, cam, layers, viewW, viewH, w, h) {
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(layers.terrain, 0, 0, w, h);
  ctx.drawImage(layers.political, 0, 0, w, h);
  for (const c of world.settlements) {
    if (c.pop < 800) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(c.x / SIZE * w - 0.5, c.y / SIZE * h - 0.5, 1.5, 1.5);
  }
  const vw = viewW / cam.zoom / SIZE * w;
  const vh = viewH / cam.zoom / SIZE * h;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cam.x / SIZE * w - vw / 2, cam.y / SIZE * h - vh / 2, vw, vh);
}
