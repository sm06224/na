import { CFG } from './world.js';
import { wrapDelta, wrapPos } from './util.js';

/* ============================================================
   描画 — 世界をカメラ越しに眺める。
   トーラスなので、各オブジェクトはカメラ中心に対する
   「最短のラップ位置」に描く（端を越えてもシームレス）。
   ============================================================ */

export class Camera {
  constructor() {
    this.x = CFG.WORLD / 2;
    this.y = CFG.WORLD / 2;
    this.zoom = 0.22;
    this.follow = null; // 追従中の個体
  }
  screenToWorld(sx, sy, w, h) {
    return {
      x: wrapPos(this.x + (sx - w / 2) / this.zoom, CFG.WORLD),
      y: wrapPos(this.y + (sy - h / 2) / this.zoom, CFG.WORLD),
    };
  }
}

/* 肥沃度マップを一度だけオフスクリーンに焼く */
export function bakeFertility(world) {
  const N = world.fertN;
  const cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const c = cv.getContext('2d');
  const img = c.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const f = world.fertility[i];
    // 不毛 = 冷たい闇 / 肥沃 = かすかに緑がかった土
    img.data[i * 4 + 0] = 8 + f * 10;
    img.data[i * 4 + 1] = 10 + f * 26;
    img.data[i * 4 + 2] = 14 + f * 18;
    img.data[i * 4 + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  return cv;
}

export function drawWorld(ctx, world, cam, selected, fertCanvas, w, h) {
  const W = CFG.WORLD;
  const z = cam.zoom;

  if (cam.follow && cam.follow.alive) {
    cam.x = cam.follow.x;
    cam.y = cam.follow.y;
  }

  // 地面（肥沃度）— カメラのまわり 3x3 タイルで敷き詰める
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#04050a';
  ctx.fillRect(0, 0, w, h);
  const tile = W * z;
  const ox = w / 2 - cam.x * z;
  const oy = h / 2 - cam.y * z;
  for (let tx = -1; tx <= 1; tx++) {
    for (let ty = -1; ty <= 1; ty++) {
      const px = ox + tx * tile, py = oy + ty * tile;
      if (px > w || py > h || px + tile < 0 || py + tile < 0) continue;
      ctx.drawImage(fertCanvas, px, py, tile, tile);
    }
  }

  const toScreen = (x, y) => ({
    x: w / 2 + wrapDelta(cam.x, x, W) * z,
    y: h / 2 + wrapDelta(cam.y, y, W) * z,
  });
  const margin = 30;

  // 植物
  ctx.fillStyle = 'rgba(110, 220, 140, 0.85)';
  const pr = Math.max(1, 2.2 * z * 4);
  for (const p of world.plants) {
    const s = toScreen(p.x, p.y);
    if (s.x < -margin || s.x > w + margin || s.y < -margin || s.y > h + margin) continue;
    ctx.fillRect(s.x - pr / 2, s.y - pr / 2, pr, pr);
  }

  // 生き物 — しずく型。色は遺伝子、大きさは体格、輪郭は食性
  for (const c of world.creatures) {
    const s = toScreen(c.x, c.y);
    if (s.x < -margin || s.x > w + margin || s.y < -margin || s.y > h + margin) continue;
    const g = c.genome;
    const r = Math.max(2, 7 * g.size * z * 3.2);
    const hue = g.hue;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(c.angle);

    if (c === selected) {
      // 選択中：視野扇を薄く描く
      ctx.fillStyle = `hsla(${hue}, 80%, 70%, 0.10)`;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, g.vision * z, -g.fov / 2, g.fov / 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    const light = 50 + c.energy / CFG.MAX_ENERGY * 25;
    ctx.fillStyle = `hsl(${hue}, 75%, ${light}%)`;
    ctx.beginPath();
    ctx.moveTo(r * 1.4, 0);                 // 鼻先
    ctx.quadraticCurveTo(0, r, -r, 0);      // 下半身
    ctx.quadraticCurveTo(0, -r, r * 1.4, 0);// 上半身
    ctx.fill();
    // 肉食ほど赤い縁取り
    if (g.diet > 0.25) {
      ctx.strokeStyle = `rgba(255, 80, 80, ${(g.diet - 0.25) * 1.1})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ミニマップ — 神の視点。世界全体を一目に。 */
export function drawMinimap(ctx, world, cam, w, h) {
  const W = CFG.WORLD;
  ctx.fillStyle = '#04050a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(90, 190, 120, 0.5)';
  for (const p of world.plants) {
    ctx.fillRect(p.x / W * w, p.y / W * h, 1, 1);
  }
  for (const c of world.creatures) {
    ctx.fillStyle = `hsl(${c.genome.hue}, 80%, 65%)`;
    ctx.fillRect(c.x / W * w - 1, c.y / W * h - 1, 2, 2);
  }
  // 現在のビューポート
  const vw = Math.min(w, (innerWidth / cam.zoom) / W * w);
  const vh = Math.min(h, (innerHeight / cam.zoom) / W * h);
  const vx = cam.x / W * w - vw / 2;
  const vy = cam.y / W * h - vh / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  // ラップを考慮して 9 回描いても良いが、簡易に 1 回 + はみ出し分
  for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) {
    ctx.strokeRect(vx + dx, vy + dy, vw, vh);
  }
}
