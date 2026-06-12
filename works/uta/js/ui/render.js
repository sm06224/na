import { melodyToKana } from '../core/scale.js';

/* ============================================================
   地図 — 群（歌い手たち）を空間に描く。
   円 = 群、大きさ = 人口、色 = 系統。線 = 親子（節回しの分派）と接触。
   歌の瞬間は、場の色の波紋として広がる。
   ============================================================ */

export class Camera {
  constructor(w, h) {
    this.x = 100; this.y = 100;
    this.zoom = Math.min(w, h) / 210;
    this.min = this.zoom * 0.7;
  }
  clamp() {
    this.zoom = Math.max(this.min, Math.min(14, this.zoom));
    this.x = Math.max(-20, Math.min(220, this.x));
    this.y = Math.max(-20, Math.min(220, this.y));
  }
  toScreen(x, y, w, h) {
    return { x: (x - this.x) * this.zoom + w / 2, y: (y - this.y) * this.zoom + h / 2 };
  }
  toWorld(sx, sy, w, h) {
    return { x: this.x + (sx - w / 2) / this.zoom, y: this.y + (sy - h / 2) / this.zoom };
  }
}

export function drawMap(ctx, world, cam, opts, w, h) {
  ctx.fillStyle = '#080709';
  ctx.fillRect(0, 0, w, h);

  // ほのかな背景グリッド
  ctx.strokeStyle = 'rgba(255,255,255,0.022)';
  ctx.lineWidth = 1;
  for (let g = 0; g <= 200; g += 25) {
    const a = cam.toScreen(g, 0, w, h), b = cam.toScreen(g, 200, w, h);
    const c = cam.toScreen(0, g, w, h), d = cam.toScreen(200, g, w, h);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.stroke();
  }

  const alive = world.aliveFlocks();

  // 親子の線（系統＝節回しの分派）
  ctx.lineWidth = 1.2;
  for (const f of alive) {
    if (f.parent == null) continue;
    const p = world.flockById.get(f.parent);
    if (!p || p.diedAt !== null) continue;
    const a = cam.toScreen(f.x, f.y, w, h), b = cam.toScreen(p.x, p.y, w, h);
    const res = world.resonance(f, p);
    // 響き合うほど明るい線。節が分かれると薄れる。
    ctx.strokeStyle = `hsla(${f.hue}, 50%, 60%, ${0.12 + res * 0.4})`;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  // 接触の線（歌が届く距離＝流行が起こりうる関係）
  if (opts.showContact) {
    ctx.strokeStyle = 'rgba(255, 220, 180, 0.10)';
    ctx.setLineDash([3, 4]);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const A = alive[i], B = alive[j];
        const dx = A.x - B.x, dy = A.y - B.y;
        if (dx * dx + dy * dy > 26 * 26) continue;
        const a = cam.toScreen(A.x, A.y, w, h), b = cam.toScreen(B.x, B.y, w, h);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  // 歌の波紋（音が広がるように、二重の輪で）
  const now = performance.now();
  for (let i = opts.flashes.length - 1; i >= 0; i--) {
    const f = opts.flashes[i];
    const life = f.long ? 3200 : 1500;
    const age = (now - f.t0) / life;
    if (age > 1) { opts.flashes.splice(i, 1); continue; }
    const s = cam.toScreen(f.x, f.y, w, h);
    ctx.lineWidth = 1.6;
    for (const lag of [0, 0.18]) {
      const a = age - lag;
      if (a < 0) continue;
      ctx.strokeStyle = `hsla(${f.hue}, 80%, 65%, ${0.6 * (1 - a)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, 4 + a * (f.long ? 60 : 30), 0, Math.PI * 2); ctx.stroke();
    }
  }

  // 群そのもの
  for (const f of alive) {
    const s = cam.toScreen(f.x, f.y, w, h);
    const r = Math.max(4, Math.sqrt(f.pop) * 0.55 * Math.max(0.6, cam.zoom / 3));
    const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 1.6);
    grd.addColorStop(0, `hsla(${f.hue}, 70%, 62%, 0.95)`);
    grd.addColorStop(1, `hsla(${f.hue}, 70%, 40%, 0)`);
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `hsl(${f.hue}, 65%, 58%)`;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();

    if (f === opts.selected) {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, r + 4, 0, Math.PI * 2); ctx.stroke();
    }

    // 名札と子守歌（その群の節回しの手触りが一目でわかる）
    if (cam.zoom > 2 || f === opts.selected) {
      ctx.font = '11px ui-sans-serif, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(250,242,235,0.9)';
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 3;
      ctx.fillText(`${f.name}の民`, s.x, s.y - r - 6);
      const lull = f.repertoire.dominant('lull');
      if (lull && cam.zoom > 3) {
        ctx.font = '10px ui-sans-serif';
        ctx.fillStyle = 'rgba(190,210,255,0.85)';
        ctx.fillText(`♪${melodyToKana(lull.melody)}`, s.x, s.y + r + 13);
      }
      ctx.shadowBlur = 0;
    }
  }
}

export function drawMinimap(ctx, world, cam, w, h, viewW, viewH) {
  ctx.fillStyle = '#080709';
  ctx.fillRect(0, 0, w, h);
  for (const f of world.aliveFlocks()) {
    ctx.fillStyle = `hsl(${f.hue}, 65%, 58%)`;
    const r = Math.max(1.5, Math.sqrt(f.pop) * 0.12);
    ctx.beginPath(); ctx.arc(f.x / 200 * w, f.y / 200 * h, r, 0, Math.PI * 2); ctx.fill();
  }
  const vw = viewW / cam.zoom / 200 * w, vh = viewH / cam.zoom / 200 * h;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cam.x / 200 * w - vw / 2, cam.y / 200 * h - vh / 2, vw, vh);
}
