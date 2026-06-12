/* ============================================================
   年表のグラフ — 人口（白）、都市（緑）、国の数（紫）。
   興亡は、折れ線のかたちで残る。
   ============================================================ */
export function drawChart(ctx, world, w, h) {
  ctx.clearRect(0, 0, w, h);
  const hist = world.history;
  if (hist.length < 2) return;

  let maxPop = 10, maxCities = 5, maxNations = 3;
  for (const s of hist) {
    if (s.pop > maxPop) maxPop = s.pop;
    if (s.cities > maxCities) maxCities = s.cities;
    if (s.nations > maxNations) maxNations = s.nations;
  }
  const X = i => (i / (hist.length - 1)) * (w - 4) + 2;

  const line = (get, max, style, width = 1.2) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    hist.forEach((s, i) => {
      const y = h - 4 - (get(s) / max) * (h - 10);
      if (i === 0) ctx.moveTo(X(i), y); else ctx.lineTo(X(i), y);
    });
    ctx.stroke();
  };
  line(s => s.cities, maxCities, 'rgba(120, 200, 140, 0.7)');
  line(s => s.nations, maxNations, 'rgba(190, 140, 255, 0.7)');
  line(s => s.pop, maxPop, 'rgba(235, 240, 255, 0.95)', 1.6);

  const last = hist[hist.length - 1];
  ctx.font = '9px ui-monospace, monospace';
  ctx.fillStyle = 'rgba(235,240,255,0.6)';
  ctx.fillText(`人口 ${last.pop.toLocaleString()}`, 6, 11);
  ctx.fillStyle = 'rgba(120,200,140,0.7)';
  ctx.fillText(`都市 ${last.cities}`, 6, 22);
  ctx.fillStyle = 'rgba(190,140,255,0.75)';
  ctx.fillText(`国 ${last.nations}`, 6, 33);
}
