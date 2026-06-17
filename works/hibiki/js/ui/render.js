/* 響 — 描画。吊られた物体を、ほのかに光る円として置く。
   叩けば、音といっしょに波紋がひろがって消える。ここに音はない。 */

/* 材質ごとの色みと、形のなまえ（描き分けのため）。 */
const HUE = { kane: 38, hachi: 180, garasu: 195, suzu: 210, ki: 30, ishi: 20, tsuzumi: 350, dora: 45 };

/* 物体の画面配置を決める。低い音は大きく左、高い音は小さく右、ゆるい弧に。 */
export function layout(ensemble, W, H) {
  const n = ensemble.objects.length;
  const objs = [];
  const m = Math.min(W, H);
  const rMax = m * 0.12, rMin = m * 0.055;
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0.5 : i / (n - 1);
    const x = W * (0.13 + 0.74 * t);
    const y = H * (0.52 - 0.16 * Math.sin(Math.PI * t));   // ゆるい弧
    const r = rMax + (rMin - rMax) * t;
    objs.push({ i, x, y, r, pan: (t - 0.5) * 1.5, hue: HUE[ensemble.kindId] ?? 200, pulse: 0 });
  }
  return objs;
}

export function draw(ctx, W, H, objs, ripples) {
  // 夜の間（ま）。
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.5, Math.max(W, H) * 0.75);
  g.addColorStop(0, '#0b1118'); g.addColorStop(1, '#05080c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // 吊り糸（天井から物体へ）。
  ctx.strokeStyle = 'rgba(150,180,210,0.07)'; ctx.lineWidth = 1;
  for (const o of objs) { ctx.beginPath(); ctx.moveTo(o.x, 0); ctx.lineTo(o.x, o.y - o.r); ctx.stroke(); }

  // 波紋（叩いた余韻）。
  for (const rp of ripples) {
    const a = rp.life;
    ctx.strokeStyle = `hsla(${rp.hue},70%,75%,${a * 0.5})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r0 + (1 - a) * rp.spread, 0, 7); ctx.stroke();
  }

  // 物体。叩かれた直後ほど明るく脈打つ。
  for (const o of objs) {
    const p = o.pulse;
    const glow = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * (1.8 + p));
    glow.addColorStop(0, `hsla(${o.hue},65%,${60 + 25 * p}%,${0.25 + 0.5 * p})`);
    glow.addColorStop(1, `hsla(${o.hue},65%,55%,0)`);
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * (1.8 + p), 0, 7); ctx.fill();

    ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7);
    ctx.fillStyle = `hsla(${o.hue},45%,${16 + 30 * p}%,0.92)`; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = `hsla(${o.hue},70%,${70 + 20 * p}%,${0.5 + 0.5 * p})`; ctx.stroke();
  }
}

/* 当たり判定：座標から物体を拾う。 */
export function pick(objs, x, y) {
  for (const o of objs) { const dx = x - o.x, dy = y - o.y; if (dx * dx + dy * dy <= (o.r * 1.25) ** 2) return o; }
  return null;
}
