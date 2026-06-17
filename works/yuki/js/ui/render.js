/* 雪 — 描画。コアの結晶（六方格子の水量）を、氷の華として刷る。
   ここに形の判断はない。凍った升を、量に応じた明るさで置くだけ。
   六回対称はコアが厳密に保証しているので、ただ素直に描けば華になる。 */

const SQ3 = Math.sqrt(3);

/* 立方座標 (x,y) を平面の点へ（flat-top 軸座標）。 */
function hexToPixel(x, y, size) {
  return { px: size * 1.5 * x, py: size * SQ3 * (y + x / 2) };
}

/* 結晶を画布に収める寸法を測り、cr に貼っておく（一度だけ）。 */
function layout(cr, W, H) {
  if (cr._lay && cr._lay.W === W && cr._lay.H === H) return cr._lay;
  // まず単位寸法で凍り升の広がりを測り、画布の 86% に収まる縮尺を出す。
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (let i = 0; i < cr.N; i++) {
    if (!cr.frozen[i]) continue;
    const { px, py } = hexToPixel(cr.xs[i], cr.ys[i], 1);
    if (px < minx) minx = px; if (px > maxx) maxx = px;
    if (py < miny) miny = py; if (py > maxy) maxy = py;
  }
  if (!isFinite(minx)) { minx = maxx = miny = maxy = 0; }
  const spanx = (maxx - minx) || 1, spany = (maxy - miny) || 1;
  const size = Math.min((W * 0.86) / (spanx + 2), (H * 0.86) / (spany + 2));
  const cx = W / 2 - size * (minx + maxx) / 2;
  const cy = H / 2 - size * (miny + maxy) / 2;
  cr._lay = { W, H, size, cx, cy };
  return cr._lay;
}

/* 一片の六角形を描く（flat-top）。 */
function hexPath(ctx, px, py, r) {
  ctx.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k;                 // flat-top: 0,60,…
    const vx = px + r * Math.cos(a), vy = py + r * Math.sin(a);
    if (k === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
}

/* 夜空と、舞い落ちる雪（装飾・非決定）。 */
export function drawSky(ctx, W, H, flakes) {
  const g = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.4, Math.max(W, H) * 0.75);
  g.addColorStop(0, '#0d1626');
  g.addColorStop(1, '#05080f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (flakes) for (const f of flakes) {
    ctx.fillStyle = `rgba(200,225,255,${f.a})`;
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
  }
}

/* 結晶を描く。reveal は 0..1（凍った順に、中心から外へ現れる）。 */
export function drawCrystal(ctx, W, H, cr, reveal = 1) {
  const { size, cx, cy } = layout(cr, W, H);
  const maxStep = cr.steps || 1;
  const upto = reveal >= 1 ? Infinity : reveal * maxStep;
  const r = size * 0.62;                          // 升より少し小さめ＝粒の隙に夜がのぞく

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';       // 氷は光を重ねる
  for (let i = 0; i < cr.N; i++) {
    if (!cr.frozen[i]) continue;
    if (cr.frozenAt[i] > upto) continue;
    const { px, py } = hexToPixel(cr.xs[i], cr.ys[i], size);
    // 量が多い（厚い氷）ほど白く明るい。芯は青みを抜く。
    const s = cr.s[i];
    const k = Math.min(1, (s - 1) * 0.55 + 0.35);  // 0.35..1
    const R = 150 + 80 * k, Gc = 195 + 55 * k, B = 235 + 20 * k;
    const a = 0.35 + 0.5 * k;
    ctx.fillStyle = `rgba(${R | 0},${Gc | 0},${B | 0},${a})`;
    hexPath(ctx, cx + px, cy + py, r);
    ctx.fill();
  }
  ctx.restore();

  // 芯のほのかな光。
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 6);
  core.addColorStop(0, 'rgba(210,235,255,0.10)');
  core.addColorStop(1, 'rgba(210,235,255,0)');
  ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, size * 6, 0, 7); ctx.fill();
}
