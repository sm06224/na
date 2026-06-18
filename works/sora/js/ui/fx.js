/* ============================================================
   宙 — fx. メガデモのエフェクト群。コアの数学を画面に刷る。
   重い毎ピクセル系（星雲・トンネル）は低解像度のバッファに描いて
   拡大する。星空・惑星・スクローラーはベクタで。
   ============================================================ */

import { makeStars, wrapZ, project, rotate, plasma, tunnel, sphere, STAR_NEAR, STAR_FAR } from '../core/space.js';

/* 低解像度バッファ（毎ピクセル系の下絵）。 */
const buf = document.createElement('canvas');
const bx = buf.getContext('2d', { willReadFrequently: true });
let bimg = null;
function ensureBuf(w, h) {
  if (buf.width !== w || buf.height !== h) { buf.width = w; buf.height = h; bimg = bx.createImageData(w, h); }
  return bimg;
}

/* ---- 星空（ワープ）。状態は持ち回り。 ---- */
const stars = makeStars(900, 'sora');
const prevP = new Array(stars.length).fill(null);
export function advanceStars(dt, speed) {
  for (let i = 0; i < stars.length; i++) { stars[i].z = wrapZ(stars[i].z - speed * dt); }
}
export function starfield(ctx, W, H, opts = {}) {
  const cx = W / 2, cy = H / 2;
  const streak = opts.streak ?? 1;          // 0=点、1=線（超光速）
  ctx.fillStyle = opts.bg ?? '#02030a';
  ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'round';
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    const p = project(s.x, s.y, s.z, 320);
    if (!p) { prevP[i] = null; continue; }
    const x = cx + p.x, y = cy + p.y;
    const depth = 1 - s.z / STAR_FAR;
    const r = Math.max(0.4, depth * 2.6);
    const a = Math.min(1, depth * 1.4);
    if (streak > 0 && prevP[i]) {
      ctx.strokeStyle = `rgba(${180 + 70 * depth | 0},${200 + 40 * depth | 0},255,${a})`;
      ctx.lineWidth = r;
      ctx.beginPath(); ctx.moveTo(prevP[i].x, prevP[i].y);
      ctx.lineTo(x, y + 0); ctx.stroke();
    } else {
      ctx.fillStyle = `rgba(${200 + 50 * depth | 0},${215 + 30 * depth | 0},255,${a})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    prevP[i] = { x, y };
  }
}

/* ---- プラズマ星雲 ---- */
export function nebula(ctx, W, H, t) {
  const w = Math.max(80, Math.min(240, W >> 2)), h = Math.max(50, Math.floor(w * H / W));
  const img = ensureBuf(w, h), d = img.data;
  let i = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = plasma((x / w - 0.5) * 12, (y / h - 0.5) * 9, t * 0.8);
      // 星雲の色：藍→紫→洋紅→淡青
      const a = v * 6.283;
      d[i] = 90 + 90 * Math.sin(a) + 50;
      d[i + 1] = 40 + 70 * Math.sin(a + 2.1);
      d[i + 2] = 130 + 110 * Math.sin(a + 4.2);
      d[i + 3] = 255; i += 4;
    }
  }
  bx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(buf, 0, 0, w, h, 0, 0, W, H);
  // 星を散らす
  ctx.globalCompositeOperation = 'lighter';
  starOverlay(ctx, W, H, t, 90);
  ctx.globalCompositeOperation = 'source-over';
}

/* 静かな星の散らし（点）。 */
function starOverlay(ctx, W, H, t, n) {
  for (let k = 0; k < n; k++) {
    const x = (Math.sin(k * 12.9 + 1) * 43758.5) % 1, y = (Math.sin(k * 78.2 + 2) * 12543.3) % 1;
    const px = ((x + 1) % 1) * W, py = ((y + 1) % 1) * H;
    const tw = 0.5 + 0.5 * Math.sin(t * 3 + k);
    ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.5 * tw})`;
    ctx.fillRect(px, py, 1.5, 1.5);
  }
}

/* ---- 回るベクターボールの惑星 ---- */
const planetPts = sphere(520);
export function planet(ctx, W, H, t) {
  ctx.fillStyle = '#02030a'; ctx.fillRect(0, 0, W, H);
  starOverlay(ctx, W, H, t, 70);
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.32;
  const drawn = [];
  for (const [x, y, z] of planetPts) {
    const [rx, ry, rz] = rotate(x, y, z, t * 0.3, t * 0.5, 0);
    drawn.push([rx, ry, rz]);
  }
  drawn.sort((a, b) => a[2] - b[2]);          // 奥から描く
  for (const [rx, ry, rz] of drawn) {
    const depth = (rz + 1) / 2;               // 0..1
    const px = cx + rx * R, py = cy + ry * R;
    const r = 1 + depth * 3.2;
    const hue = 190 + 40 * depth;
    ctx.fillStyle = `hsla(${hue},80%,${30 + 50 * depth}%,${0.25 + 0.7 * depth})`;
    ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill();
  }
  // 周回するリング
  ctx.strokeStyle = 'rgba(150,210,255,0.25)'; ctx.lineWidth = 1.5;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.32); ctx.rotate(Math.sin(t * 0.2) * 0.3);
  ctx.beginPath(); ctx.arc(0, 0, R * 1.7, 0, 7); ctx.stroke(); ctx.restore();
}

/* ---- ワームホール・トンネル ---- */
export function wormhole(ctx, W, H, t) {
  const w = Math.max(80, Math.min(240, W >> 2)), h = Math.max(50, Math.floor(w * H / W));
  const img = ensureBuf(w, h), d = img.data;
  let i = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x / w - 0.5) * 2, ny = (y / h - 0.5) * 2;
      const c = tunnel(nx, ny, t * 0.6);
      const tex = (Math.sin(c.v * 18) * 0.5 + 0.5) * (Math.sin(c.u * 12) * 0.5 + 0.5);
      const sh = c.shade * (0.4 + 0.6 * tex);
      d[i] = 60 * sh + 30 * Math.sin(c.v * 4);
      d[i + 1] = 120 * sh;
      d[i + 2] = 200 * sh + 40;
      d[i + 3] = 255; i += 4;
    }
  }
  bx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(buf, 0, 0, w, h, 0, 0, W, H);
}

/* ---- タイトル ---- */
export function title(ctx, W, H, t, u) {
  starfield(ctx, W, H, { streak: 0, bg: '#02030a' });
  const a = Math.min(1, u * 2.2) * (u > 0.85 ? (1 - u) / 0.15 : 1);
  ctx.save();
  ctx.globalAlpha = Math.max(0, a);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const glow = 18 + 10 * Math.sin(t * 4);
  ctx.shadowColor = '#6cf'; ctx.shadowBlur = glow;
  ctx.fillStyle = '#dff1ff';
  ctx.font = `800 ${Math.min(W * 0.26, 200)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText('宙', W / 2, H * 0.43);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#9fc7e6';
  ctx.font = `300 ${Math.min(W * 0.06, 34)}px ui-monospace, monospace`;
  ctx.fillText('S O R A', W / 2, H * 0.6);
  ctx.fillStyle = 'rgba(160,200,230,.7)';
  ctx.font = `300 ${Math.min(W * 0.032, 16)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText('a space megademo — 無から', W / 2, H * 0.68);
  ctx.restore();
}

/* ---- コッパー・バー（横帯）＋大サインスクローラー ---- */
export function copperScroller(ctx, W, H, t, text, scrollX) {
  starfield(ctx, W, H, { streak: 0, bg: '#03030c' });
  // コッパーバー
  const bars = 7;
  ctx.globalCompositeOperation = 'lighter';
  for (let b = 0; b < bars; b++) {
    const cy = H * 0.5 + Math.sin(t * 1.1 + b * 0.5) * H * 0.28;
    const hue = (t * 40 + b * 30) % 360;
    const grad = ctx.createLinearGradient(0, cy - 26, 0, cy + 26);
    grad.addColorStop(0, `hsla(${hue},90%,50%,0)`);
    grad.addColorStop(0.5, `hsla(${hue},90%,60%,0.5)`);
    grad.addColorStop(1, `hsla(${hue},90%,50%,0)`);
    ctx.fillStyle = grad; ctx.fillRect(0, cy - 26, W, 52);
  }
  ctx.globalCompositeOperation = 'source-over';
  // 大サインスクローラー
  bigScroller(ctx, W, H, t, text, scrollX);
}

/* サインスクローラー：文字が波打って流れる。scrollX は左へ進む距離(px)。 */
export function bigScroller(ctx, W, H, t, text, scrollX) {
  const size = Math.min(W * 0.07, 40);
  ctx.font = `700 ${size}px ui-monospace, monospace`;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const chW = size * 0.62;
  let x = W - scrollX;
  const baseY = H * 0.5;
  for (let k = 0; k < text.length; k++) {
    if (x > -chW && x < W + chW) {
      const y = baseY + Math.sin(t * 3 + x * 0.012) * H * 0.16;
      const hue = (x * 0.5 + t * 60) % 360;
      ctx.fillStyle = `hsl(${hue},85%,72%)`;
      ctx.save(); ctx.shadowColor = `hsl(${hue},85%,55%)`; ctx.shadowBlur = 12;
      ctx.fillText(text[k], x, y); ctx.restore();
    }
    x += chW;
  }
  return x;                                   // 末尾の位置（折り返し判定に）
}

/* 画面下の細い情報スクローラー（全編で流れる）。 */
export function infoLine(ctx, W, H, t, text, scrollX) {
  const size = Math.max(11, Math.min(16, W * 0.018));
  ctx.font = `${size}px ui-monospace, monospace`;
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const chW = size * 0.62;
  const y = H - size * 0.8;
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, H - size * 2, W, size * 2);
  let x = W - scrollX;
  for (let k = 0; k < text.length; k++) {
    if (x > -chW && x < W + chW) { ctx.fillStyle = 'rgba(150,210,255,.85)'; ctx.fillText(text[k], x, y); }
    x += chW;
  }
  return chW * text.length;
}
