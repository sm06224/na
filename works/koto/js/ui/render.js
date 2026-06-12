import { wordToKana } from '../core/phonology.js';
import { CONCEPTS } from '../core/meaning.js';

/* ============================================================
   地図 — 群（言語の話し手たち）を空間に描く。
   円 = 群、大きさ = 人口、色 = 系統。線 = 親子（方言の分岐）と接触。
   発話の瞬間は、概念の色の波紋として広がる。
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
  ctx.fillStyle = '#070810';
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

  const alive = world.aliveDemes();

  // 親子の線（系統＝方言の分岐）
  ctx.lineWidth = 1.2;
  for (const d of alive) {
    if (d.parent == null) continue;
    const p = world.demeById.get(d.parent);
    if (!p || p.diedAt !== null) continue;
    const a = cam.toScreen(d.x, d.y, w, h), b = cam.toScreen(p.x, p.y, w, h);
    const intel = world.intelligibility(d, p);
    // 通じ合うほど明るい線。訛って通じなくなると薄れる。
    ctx.strokeStyle = `hsla(${d.hue}, 50%, 60%, ${0.12 + intel * 0.4})`;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  // 接触の線（近接する群＝借用が起こりうる関係）
  if (opts.showContact) {
    ctx.strokeStyle = 'rgba(180, 210, 255, 0.10)';
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

  // 発話の波紋
  const now = performance.now();
  for (let i = opts.flashes.length - 1; i >= 0; i--) {
    const f = opts.flashes[i];
    const age = (now - f.t0) / 1500;
    if (age > 1) { opts.flashes.splice(i, 1); continue; }
    const s = cam.toScreen(f.x, f.y, w, h);
    ctx.strokeStyle = `hsla(${f.hue}, 80%, 65%, ${0.7 * (1 - age)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x, s.y, 4 + age * 30, 0, Math.PI * 2); ctx.stroke();
  }

  // 群そのもの
  for (const d of alive) {
    const s = cam.toScreen(d.x, d.y, w, h);
    const r = Math.max(4, Math.sqrt(d.pop) * 0.55 * Math.max(0.6, cam.zoom / 3));
    const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 1.6);
    grd.addColorStop(0, `hsla(${d.hue}, 70%, 62%, 0.95)`);
    grd.addColorStop(1, `hsla(${d.hue}, 70%, 40%, 0)`);
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `hsl(${d.hue}, 65%, 58%)`;
    ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();

    if (d === opts.selected) {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, r + 4, 0, Math.PI * 2); ctx.stroke();
    }

    // 名札と「捕食者」語（その言語の手触りが一目でわかる）
    if (cam.zoom > 2 || d === opts.selected) {
      ctx.font = '11px ui-sans-serif, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(235,238,250,0.9)';
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 3;
      ctx.fillText(`${d.name}語`, s.x, s.y - r - 6);
      const pred = d.lexicon.dominant('predator');
      if (pred && cam.zoom > 3) {
        ctx.font = '10px ui-sans-serif';
        ctx.fillStyle = 'rgba(255,170,170,0.85)';
        ctx.fillText(`危険=${wordToKana(pred.form)}`, s.x, s.y + r + 13);
      }
      ctx.shadowBlur = 0;
    }
  }
}

export function drawMinimap(ctx, world, cam, w, h, viewW, viewH) {
  ctx.fillStyle = '#070810';
  ctx.fillRect(0, 0, w, h);
  for (const d of world.aliveDemes()) {
    ctx.fillStyle = `hsl(${d.hue}, 65%, 58%)`;
    const r = Math.max(1.5, Math.sqrt(d.pop) * 0.12);
    ctx.beginPath(); ctx.arc(d.x / 200 * w, d.y / 200 * h, r, 0, Math.PI * 2); ctx.fill();
  }
  const vw = viewW / cam.zoom / 200 * w, vh = viewH / cam.zoom / 200 * h;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cam.x / 200 * w - vw / 2, cam.y / 200 * h - vh / 2, vw, vh);
}
