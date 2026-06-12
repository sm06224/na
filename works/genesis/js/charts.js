/* ============================================================
   年代記 — 個体数と植生の推移、繁栄する種の系列を折れ線で描く。
   ============================================================ */
export function drawChart(ctx, world, w, h) {
  ctx.clearRect(0, 0, w, h);
  const hist = world.history;
  if (hist.length < 2) return;

  let maxPop = 10, maxPlant = 10;
  for (const s of hist) {
    if (s.pop > maxPop) maxPop = s.pop;
    if (s.plants > maxPlant) maxPlant = s.plants;
  }

  const X = i => (i / (hist.length - 1)) * (w - 4) + 2;

  // 植生（背景の面）
  ctx.beginPath();
  ctx.moveTo(X(0), h);
  hist.forEach((s, i) => ctx.lineTo(X(i), h - (s.plants / maxPlant) * (h - 6)));
  ctx.lineTo(X(hist.length - 1), h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(90, 190, 120, 0.13)';
  ctx.fill();

  // 上位種ごとの個体数（最新サンプルの上位 5 種を系列として遡る）
  const latest = hist[hist.length - 1];
  const topIds = latest.top.slice(0, 5).map(([id]) => id);
  for (const id of topIds) {
    const sp = world.species.get(id);
    if (!sp) continue;
    ctx.strokeStyle = `hsla(${sp.hue}, 80%, 62%, 0.85)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    let started = false;
    hist.forEach((s, i) => {
      const e = s.top.find(([tid]) => tid === id);
      const v = e ? e[1] : 0;
      const y = h - (v / maxPop) * (h - 6);
      if (!started) { ctx.moveTo(X(i), y); started = true; }
      else ctx.lineTo(X(i), y);
    });
    ctx.stroke();
  }

  // 総個体数（白）
  ctx.strokeStyle = 'rgba(235, 240, 255, 0.95)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  hist.forEach((s, i) => {
    const y = h - (s.pop / maxPop) * (h - 6);
    if (i === 0) ctx.moveTo(X(i), y); else ctx.lineTo(X(i), y);
  });
  ctx.stroke();

  ctx.fillStyle = 'rgba(220,226,245,0.5)';
  ctx.font = '9px ui-monospace, monospace';
  ctx.fillText(`pop ${latest.pop}`, 6, 11);
  ctx.fillStyle = 'rgba(120,210,150,0.6)';
  ctx.fillText(`plants ${latest.plants}`, 6, 22);
}
