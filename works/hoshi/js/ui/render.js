/* 夜空を描く — 星・星座の線・名前・一番星の光輪。
   座標は world(0..1000) を view（拡大と移動）で画面へ写す。 */

export function drawSky(ctx, sky, view, time, selected) {
  const { w, h, scale, offX, offY } = view;
  ctx.clearRect(0, 0, w, h);

  // 夜の底 — ほのかな天の川のにじみ
  const g = ctx.createRadialGradient(w * 0.5, h * 0.34, 0, w * 0.5, h * 0.4, Math.max(w, h) * 0.8);
  g.addColorStop(0, 'rgba(20,24,48,0.5)');
  g.addColorStop(1, 'rgba(5,6,13,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const sx = wx => wx * scale + offX;
  const sy = wy => wy * scale + offY;

  // 星座の線
  for (const c of sky.constellations) {
    const on = c === selected;
    ctx.strokeStyle = on ? 'rgba(180,196,255,0.55)' : 'rgba(150,168,235,0.16)';
    ctx.lineWidth = on ? 1.4 : 0.8;
    ctx.beginPath();
    for (const [a, b] of c.edges) {
      const p = c.stars[a], q = c.stars[b];
      ctx.moveTo(sx(p.x), sy(p.y));
      ctx.lineTo(sx(q.x), sy(q.y));
    }
    ctx.stroke();
  }

  // 星
  for (const s of sky.stars) {
    const x = sx(s.x), y = sy(s.y);
    if (x < -20 || x > w + 20 || y < -20 || y > h + 20) continue;
    const bright = (6 - s.mag) / 7;                       // 0..1
    const tw = 0.72 + 0.28 * Math.sin(time * 0.0017 + s.twinkle);
    const r = 0.5 + bright * bright * 2.9;
    const [cr, cg, cb] = s.color;
    if (bright > 0.55) {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4.5);
      glow.addColorStop(0, `rgba(${cr},${cg},${cb},${0.5 * tw})`);
      glow.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(x, y, r * 4.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${Math.min(1, (0.35 + bright) * tw)})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // 一番星の光輪
  const L = sky.leadStar, lx = sx(L.x), ly = sy(L.y);
  const halo = ctx.createRadialGradient(lx, ly, 0, lx, ly, 26);
  halo.addColorStop(0, 'rgba(255,236,190,0.5)');
  halo.addColorStop(1, 'rgba(255,236,190,0)');
  ctx.fillStyle = halo;
  ctx.beginPath(); ctx.arc(lx, ly, 26, 0, Math.PI * 2); ctx.fill();

  // 名前
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const c of sky.constellations) {
    const on = c === selected;
    ctx.font = `300 ${on ? 15 : 12}px ui-sans-serif, "Hiragino Kaku Gothic ProN", sans-serif`;
    ctx.fillStyle = on ? 'rgba(220,228,255,0.95)' : 'rgba(190,200,240,0.34)';
    ctx.fillText(c.name, sx(c.cx), sy(c.cy) - 16);
  }
  ctx.font = '300 13px ui-sans-serif, "Hiragino Kaku Gothic ProN", sans-serif';
  ctx.fillStyle = 'rgba(255,238,196,0.92)';
  ctx.fillText(`★ ${L.name}`, lx, ly - 20);
}

/* 画面の点に近い星座を探す（world 距離のしきい値内） */
export function pickConstellation(sky, view, px, py, threshold = 64) {
  const wx = (px - view.offX) / view.scale, wy = (py - view.offY) / view.scale;
  let best = null, bestD = threshold * threshold;
  for (const c of sky.constellations) {
    for (const s of c.stars) {
      const d = (s.x - wx) ** 2 + (s.y - wy) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    const dc = (c.cx - wx) ** 2 + (c.cy - wy) ** 2;
    if (dc < bestD) { bestD = dc; best = c; }
  }
  return best;
}
