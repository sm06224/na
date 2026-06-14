/* 太陽の通り道を、方位×高度の極座標ドームに描く。
   中心が天頂（高度90°）、ふちが地平線（高度0°）、上が北・右が東。 */

const D2R = Math.PI / 180;

export function drawDome(ctx, w, h, data) {
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2;
  const R = Math.min(w, h) / 2 - 26;

  // 方位 az(度・北0時計回り)・高度 el(度) → 画面座標
  const pt = (az, el) => {
    const r = R * (1 - Math.max(0, Math.min(90, el)) / 90);
    return [cx + r * Math.sin(az * D2R), cy - r * Math.cos(az * D2R)];
  };

  // 空の円（地平より上）
  const g = ctx.createRadialGradient(cx, cy - R * 0.25, R * 0.1, cx, cy, R);
  g.addColorStop(0, '#bfe2ff');
  g.addColorStop(0.7, '#e9f3ff');
  g.addColorStop(1, '#f3ece0');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  // 高度リング 30/60、地平線
  ctx.strokeStyle = 'rgba(120,140,170,.35)';
  ctx.lineWidth = 1;
  for (const el of [30, 60]) {
    const r = R * (1 - el / 90);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(90,110,140,.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

  // 方位の十字と文字
  ctx.strokeStyle = 'rgba(120,140,170,.25)';
  ctx.lineWidth = 1;
  for (const az of [0, 90, 180, 270]) {
    const [x, y] = pt(az, 0);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(70,84,110,.85)';
  ctx.font = '600 13px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const labels = [['北', 0], ['東', 90], ['南', 180], ['西', 270]];
  for (const [t, az] of labels) {
    const r = R + 14;
    ctx.fillText(t, cx + r * Math.sin(az * D2R), cy - r * Math.cos(az * D2R));
  }

  // 太陽の通り道（その日のぶん、高度0以上のところだけ）
  const path = data.path.filter(p => p.el >= -0.5);
  if (path.length > 1) {
    // 影のように地平すれすれを濃く
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const lowest = Math.min(a.el, b.el);
      // 黄金時間帯（高度 -4〜6°）は橙、それ以上は明るい黄
      ctx.strokeStyle = lowest < 6 ? 'rgba(245,158,66,.95)' : 'rgba(255,206,84,.95)';
      const [x0, y0] = pt(a.az, a.el), [x1, y1] = pt(b.az, b.el);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
  }

  // 日の出・日の入りの印（地平線上）
  ctx.fillStyle = 'rgba(225,120,60,.9)';
  for (const m of data.marks || []) {
    const [x, y] = pt(m.az, 0);
    ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
  }

  // いまの太陽
  if (data.sun && data.sun.el > -1) {
    const [x, y] = pt(data.sun.az, data.sun.el);
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 22);
    glow.addColorStop(0, 'rgba(255,221,120,.95)');
    glow.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd24a';
    ctx.strokeStyle = '#f08a3c'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (data.sun) {
    // 地平の下：ふちに小さく示す
    const [x, y] = pt(data.sun.az, 0);
    ctx.fillStyle = 'rgba(120,130,160,.5)';
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
  }
}
