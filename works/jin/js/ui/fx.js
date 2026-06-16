/* 陣 — 演出（粒と閃き）。攻撃の薙ぎ、矢の弧、魔の炸裂、命中の火花、画面の揺れ。
   座標はすべて盤（タイル）空間。draw だけが ctx と camera を使う。
   更新の理（update）は DOM を知らない——粒は生まれ、飛び、薄れて消える。 */

export class FX {
  constructor() {
    this.parts = [];      // 火花・破片
    this.arcs = [];       // 斬撃・魔法弧などの線
    this.shots = [];      // 飛び道具（矢・弾）
    this.flashes = [];    // 画面全体の閃光（スクリーン空間）
    this.shake = 0;       // 画面の揺れ（px 相当）
  }
  clear() { this.parts.length = 0; this.arcs.length = 0; this.shots.length = 0; this.flashes.length = 0; this.shake = 0; }
  get count() { return this.parts.length + this.arcs.length + this.shots.length + this.flashes.length; }
  addShake(a) { this.shake = Math.min(14, Math.max(this.shake, a)); }

  /* 火花（中心から飛び散る粒） */
  spark(x, y, color = '#ffd86a', n = 10, spd = 3.2) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.6;
      const v = spd * (0.5 + Math.random());
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, life: 0.5 + Math.random() * 0.3, max: 0.8, color, size: 2 + Math.random() * 2.5, grav: 8 });
    }
  }
  /* 斬撃（from→to に走る一閃） */
  slash(from, to, color = '#ffffff') {
    this.arcs.push({ x0: from.x, y0: from.y, x1: to.x, y1: to.y, life: 0.28, max: 0.28, color, w: 4, kind: 'slash' });
  }
  /* 魔法の炸裂（広がる輪） */
  burst(x, y, color = '#b79bff') {
    this.arcs.push({ cx: x, cy: y, life: 0.4, max: 0.4, color, kind: 'ring' });
    this.spark(x, y, color, 12, 2.4);
  }
  /* 画面全体の閃光（会心・撃破・魔法）。スクリーン空間 0..1 の強さ。 */
  flash(color = '#ffffff', strength = 0.4, dur = 0.26) {
    this.flashes.push({ color, life: dur, max: dur, strength });
  }
  /* 広がる輪（魔法・衝撃）。scale はタイル倍率。 */
  ring(x, y, color = '#b79bff', scale = 1.1) {
    this.arcs.push({ cx: x, cy: y, life: 0.4, max: 0.4, color, kind: 'ring', scale });
  }
  /* 会心の星はじけ（鋭い十字＋多数の火花＋輪）。 */
  star(x, y, color = '#ffd86a') {
    this.ring(x, y, color, 1.4);
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i;
      this.arcs.push({ x0: x, y0: y, x1: x + Math.cos(a) * 0.9, y1: y + Math.sin(a) * 0.9, life: 0.26, max: 0.26, color, w: 5, kind: 'slash' });
    }
    this.spark(x, y, color, 20, 5);
    this.spark(x, y, '#ffffff', 8, 3);
  }
  /* 物理の衝撃（小さな輪＋火花）。weapon 色で。 */
  impact(x, y, color = '#ffd0a0') {
    this.ring(x, y, color, 0.8);
    this.spark(x, y, color, 10, 3.4);
  }
  /* 稲妻（from→to のぎざぎざ）。雷の魔に。 */
  lightning(from, to, color = '#cfe6ff') {
    this.arcs.push({ kind: 'bolt', x0: from.x, y0: from.y, x1: to.x, y1: to.y, life: 0.2, max: 0.2, color, seed: Math.random() * 6.28 });
  }
  /* 光条（太い直線が一瞬走る）。光・闇の魔に。 */
  beam(from, to, color = '#ffe08a') {
    this.arcs.push({ kind: 'beam', x0: from.x, y0: from.y, x1: to.x, y1: to.y, life: 0.22, max: 0.22, color });
  }
  /* 魔法陣（術者の足元に一瞬の輪） */
  magicCircle(x, y, color = '#b79bff') {
    this.arcs.push({ cx: x, cy: y, life: 0.5, max: 0.5, color, kind: 'rune', scale: 0.9 });
  }
  /* 砂塵（移動・着地の小さな煙） */
  dust(x, y, color = 'rgba(210,200,180,.9)') {
    for (let i = 0; i < 6; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 0.4, y: y + 0.2, vx: (Math.random() - 0.5) * 1.2, vy: -0.3 - Math.random() * 0.4, life: 0.4 + Math.random() * 0.2, max: 0.6, color, size: 2 + Math.random() * 2, grav: 1 });
  }
  /* 癒しの粒（上へ昇る） */
  heal(x, y) {
    for (let i = 0; i < 10; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 0.6, y, vx: (Math.random() - 0.5) * 0.5, vy: -1.4 - Math.random(), life: 0.7, max: 0.7, color: '#9cf0c0', size: 2 + Math.random() * 2, grav: -1 });
  }
  /* 飛び道具（矢・弾）。到達で onArrive を呼ぶ。 */
  shoot(from, to, opts = {}) {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    this.shots.push({ x: from.x, y: from.y, x0: from.x, y0: from.y, x1: to.x, y1: to.y, t: 0, dur: opts.dur || Math.max(0.12, dist * 0.05), color: opts.color || '#e8e2c0', kind: opts.kind || 'arrow', arc: opts.arc ?? (opts.kind === 'arrow' ? 0.8 : 0.2), onArrive: opts.onArrive });
  }
  /* 勝利の紙吹雪（画面全域・スクリーン空間 0..1 で持ち、draw で展開） */
  confetti(n = 60) {
    for (let i = 0; i < n; i++) this.parts.push({ screen: true, x: Math.random(), y: -0.05 - Math.random() * 0.3, vx: (Math.random() - 0.5) * 0.1, vy: 0.25 + Math.random() * 0.3, life: 3, max: 3, color: `hsl(${(Math.random() * 360) | 0},80%,65%)`, size: 3 + Math.random() * 3, grav: 0.05, spin: Math.random() * 6 });
  }

  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += (p.grav || 0) * dt;
    }
    for (const a of this.arcs) a.life -= dt;
    for (const f of this.flashes) f.life -= dt;
    this.flashes = this.flashes.filter(f => f.life > 0);
    for (const s of this.shots) {
      s.t += dt / s.dur;
      const f = Math.min(1, s.t);
      s.x = s.x0 + (s.x1 - s.x0) * f;
      s.y = s.y0 + (s.y1 - s.y0) * f - Math.sin(f * Math.PI) * (s.arc || 0);
      if (s.t >= 1 && !s.done) { s.done = true; if (s.onArrive) s.onArrive(); }
    }
    this.parts = this.parts.filter(p => p.life > 0);
    this.arcs = this.arcs.filter(a => a.life > 0);
    this.shots = this.shots.filter(s => s.t < 1.05);
    this.shake *= Math.pow(0.0001, dt);    // すばやく収まる
    if (this.shake < 0.2) this.shake = 0;
  }

  draw(ctx, cam) {
    const T = cam.tile;
    const sx = wx => wx * T + cam.x + T / 2;
    const sy = wy => wy * T + cam.y + T / 2;
    // 弧
    for (const a of this.arcs) {
      const k = a.life / a.max;
      ctx.globalAlpha = k;
      if (a.kind === 'ring') {
        ctx.strokeStyle = a.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(sx(a.cx), sy(a.cy), (1 - k) * T * (a.scale || 1.1), 0, Math.PI * 2); ctx.stroke();
      } else if (a.kind === 'rune') {
        ctx.strokeStyle = a.color; ctx.lineWidth = 2;
        const rr = T * (a.scale || 0.9), cxp = sx(a.cx), cyp = sy(a.cy);
        ctx.beginPath(); ctx.arc(cxp, cyp, rr, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cxp, cyp, rr * 0.6, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 6; i++) { const a2 = (Math.PI / 3) * i + (1 - k) * 1.5; ctx.beginPath(); ctx.moveTo(cxp + Math.cos(a2) * rr * 0.6, cyp + Math.sin(a2) * rr * 0.6); ctx.lineTo(cxp + Math.cos(a2) * rr, cyp + Math.sin(a2) * rr); ctx.stroke(); }
      } else if (a.kind === 'bolt') {
        // 稲妻：from→to をぎざぎざに、二度描き（白芯＋色）
        const x0 = sx(a.x0), y0 = sy(a.y0), x1 = sx(a.x1), y1 = sy(a.y1);
        const seg = 8, nx = -(y1 - y0), ny = (x1 - x0), nl = Math.hypot(nx, ny) || 1;
        const pts = [];
        for (let i = 0; i <= seg; i++) {
          const f = i / seg; let jx = 0, jy = 0;
          if (i > 0 && i < seg) { const r = (Math.sin(a.seed * 99 + i * 37) ) * T * 0.5; jx = nx / nl * r; jy = ny / nl * r; }
          pts.push([x0 + (x1 - x0) * f + jx, y0 + (y1 - y0) * f + jy]);
        }
        ctx.strokeStyle = a.color; ctx.lineWidth = 5 * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * k;
        ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.stroke();
      } else if (a.kind === 'beam') {
        const x0 = sx(a.x0), y0 = sy(a.y0), x1 = sx(a.x1), y1 = sy(a.y1);
        ctx.strokeStyle = a.color; ctx.lineWidth = T * 0.5 * k; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = T * 0.18 * k;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      } else {
        ctx.strokeStyle = a.color; ctx.lineWidth = a.w * k; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx(a.x0), sy(a.y0)); ctx.lineTo(sx(a.x1), sy(a.y1)); ctx.stroke();
      }
    }
    // 飛び道具
    for (const s of this.shots) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = s.color;
      const px = sx(s.x), py = sy(s.y);
      if (s.kind === 'arrow') {
        const ang = Math.atan2(s.y1 - s.y0, s.x1 - s.x0);
        ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
        ctx.fillRect(-T * 0.2, -1.5, T * 0.4, 3); ctx.restore();
      } else {
        ctx.beginPath(); ctx.arc(px, py, T * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(px, py, T * 0.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 粒
    for (const p of this.parts) {
      const k = Math.max(0, p.life / p.max);
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      let X, Y;
      if (p.screen) { X = p.x * cam._vw; Y = p.y * cam._vh; }
      else { X = sx(p.x); Y = sy(p.y); }
      ctx.fillRect(X - p.size / 2, Y - p.size / 2, p.size, p.size);
    }
    // 画面全体の閃光（粒の上に被せる）
    for (const f of this.flashes) {
      const k = f.life / f.max;
      ctx.globalAlpha = k * f.strength;
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, cam._vw || 0, cam._vh || 0);
    }
    ctx.globalAlpha = 1;
  }
}
