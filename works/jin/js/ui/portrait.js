/* 陣 — 顔。画像ファイルなし。名前から決定的に、その人の顔を描く。
   同じ名前からは、いつも同じ顔。会話の話者と、会心のカットインに使う。 */

import { roundRect } from './sprites.js';

const SKINS = ['#f1d2b0', '#e9c39c', '#d8a878', '#c08a5a', '#b7d0c4', '#cdbce0'];
const HAIRS = ['#3a2a1e', '#5a3a22', '#8a5a2a', '#caa24a', '#d8d0c0', '#2a3a5a', '#6a2a3a', '#3a5a4a', '#aa3a5a', '#222831'];
const EYES = ['#3a6ea5', '#7a4a2a', '#3a8a5a', '#7a3a8a', '#a03a3a', '#444'];

function hash(s) {
  let h = 0x811c9dc5;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/* 名前から、決定的な顔のつくり */
export function faceFeatures(key) {
  const h = hash(key);
  const pick = (arr, shift) => arr[(h >>> shift) % arr.length];
  return {
    skin: pick(SKINS, 2),
    hair: pick(HAIRS, 7),
    eye: pick(EYES, 13),
    hairStyle: (h >>> 17) % 5,      // 0..4
    browAngle: ((h >>> 20) % 5) - 2,
    mouth: (h >>> 23) % 3,
    long: ((h >>> 25) & 1) === 1,   // 長髪か
    eyeW: 0.9 + ((h >>> 27) % 4) * 0.08,
  };
}

/* 顔を描く。(x,y) 左上、s 一辺。opts.color=襟の色, opts.flip=左右反転 */
export function drawPortrait(ctx, key, x, y, s, opts = {}) {
  const f = faceFeatures(key);
  ctx.save();
  ctx.translate(x, y);
  if (opts.flip) { ctx.translate(s, 0); ctx.scale(-1, 1); }
  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, s);
  bg.addColorStop(0, 'rgba(30,36,56,.9)'); bg.addColorStop(1, 'rgba(14,18,30,.92)');
  ctx.fillStyle = bg; roundRect(ctx, 0, 0, s, s, s * 0.12); ctx.fill();
  ctx.save(); roundRect(ctx, 0, 0, s, s, s * 0.12); ctx.clip();

  const cx = s * 0.5, cy = s * 0.52, fw = s * 0.30, fh = s * 0.36;
  // 襟・肩（職/陣営の色）
  ctx.fillStyle = opts.color || '#5f7cff';
  ctx.beginPath(); ctx.moveTo(s * 0.12, s); ctx.quadraticCurveTo(cx, s * 0.74, s * 0.88, s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  ctx.beginPath(); ctx.moveTo(cx, s * 0.8); ctx.lineTo(s * 0.4, s); ctx.lineTo(s * 0.6, s); ctx.closePath(); ctx.fill();
  // 首
  ctx.fillStyle = f.skin; ctx.fillRect(cx - s * 0.09, cy + fh * 0.5, s * 0.18, s * 0.18);
  // 後ろ髪（長髪）
  if (f.long) { ctx.fillStyle = f.hair; ctx.beginPath(); ctx.ellipse(cx, cy + fh * 0.2, fw * 1.25, fh * 1.25, 0, 0, Math.PI * 2); ctx.fill(); }
  // 顔
  ctx.fillStyle = f.skin;
  ctx.beginPath(); ctx.ellipse(cx, cy, fw, fh, 0, 0, Math.PI * 2); ctx.fill();
  // 頬の影
  ctx.fillStyle = 'rgba(0,0,0,.06)'; ctx.beginPath(); ctx.ellipse(cx, cy + fh * 0.3, fw * 0.8, fh * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  // 目
  const ey = cy + fh * 0.02, ex = fw * 0.42, ew = fw * 0.26 * f.eyeW, eh = fh * 0.22;
  for (const sgn of [-1, 1]) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(cx + sgn * ex, ey, ew, eh, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = f.eye; ctx.beginPath(); ctx.ellipse(cx + sgn * ex, ey, ew * 0.6, eh * 0.78, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a22'; ctx.beginPath(); ctx.arc(cx + sgn * ex, ey, ew * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.beginPath(); ctx.arc(cx + sgn * ex - ew * 0.2, ey - eh * 0.25, ew * 0.14, 0, Math.PI * 2); ctx.fill();
    // 眉
    ctx.strokeStyle = f.hair; ctx.lineWidth = s * 0.018; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx + sgn * (ex - ew), ey - eh * 1.3 + sgn * f.browAngle * 0.01 * s);
    ctx.lineTo(cx + sgn * (ex + ew), ey - eh * 1.3 - sgn * f.browAngle * 0.01 * s); ctx.stroke();
  }
  // 口
  ctx.strokeStyle = '#9a5a4a'; ctx.lineWidth = s * 0.016;
  ctx.beginPath();
  const my = cy + fh * 0.55;
  if (f.mouth === 0) { ctx.moveTo(cx - fw * 0.18, my); ctx.quadraticCurveTo(cx, my + fh * 0.12, cx + fw * 0.18, my); }
  else if (f.mouth === 1) { ctx.moveTo(cx - fw * 0.15, my); ctx.lineTo(cx + fw * 0.15, my); }
  else { ctx.moveTo(cx - fw * 0.15, my + fh * 0.06); ctx.quadraticCurveTo(cx, my - fh * 0.06, cx + fw * 0.15, my + fh * 0.06); }
  ctx.stroke();
  // 前髪（型ちがい）
  ctx.fillStyle = f.hair;
  const ty = cy - fh;
  ctx.beginPath();
  if (f.hairStyle === 0) {            // ぱっつん
    ctx.moveTo(cx - fw * 1.05, cy); ctx.quadraticCurveTo(cx - fw * 1.1, ty, cx, ty - fh * 0.15);
    ctx.quadraticCurveTo(cx + fw * 1.1, ty, cx + fw * 1.05, cy);
    ctx.lineTo(cx + fw * 0.9, cy - fh * 0.25); ctx.lineTo(cx + fw * 0.4, cy - fh * 0.1);
    ctx.lineTo(cx, cy - fh * 0.3); ctx.lineTo(cx - fw * 0.4, cy - fh * 0.1); ctx.lineTo(cx - fw * 0.9, cy - fh * 0.25);
  } else if (f.hairStyle === 1) {     // 分け目
    ctx.moveTo(cx - fw * 1.05, cy); ctx.quadraticCurveTo(cx - fw, ty, cx + fw * 0.2, ty - fh * 0.12);
    ctx.quadraticCurveTo(cx + fw * 1.1, ty, cx + fw * 1.05, cy);
    ctx.lineTo(cx + fw * 0.7, cy - fh * 0.2); ctx.quadraticCurveTo(cx + fw * 0.1, cy - fh * 0.45, cx - fw * 0.2, cy - fh * 0.05);
  } else if (f.hairStyle === 2) {     // 立て髪
    ctx.moveTo(cx - fw * 1.05, cy);
    for (let i = -3; i <= 3; i++) { ctx.lineTo(cx + i * fw * 0.32, ty - fh * (0.1 + (i % 2 ? 0.18 : 0))); }
    ctx.lineTo(cx + fw * 1.05, cy); ctx.lineTo(cx + fw * 0.9, cy - fh * 0.2); ctx.lineTo(cx - fw * 0.9, cy - fh * 0.2);
  } else if (f.hairStyle === 3) {     // ふんわり
    ctx.moveTo(cx - fw * 1.1, cy + fh * 0.1); ctx.quadraticCurveTo(cx - fw * 1.2, ty - fh * 0.1, cx, ty - fh * 0.2);
    ctx.quadraticCurveTo(cx + fw * 1.2, ty - fh * 0.1, cx + fw * 1.1, cy + fh * 0.1);
    ctx.quadraticCurveTo(cx + fw * 0.5, cy - fh * 0.5, cx, cy - fh * 0.3); ctx.quadraticCurveTo(cx - fw * 0.5, cy - fh * 0.5, cx - fw * 1.1, cy + fh * 0.1);
  } else {                            // 短髪
    ctx.moveTo(cx - fw * 1.02, cy - fh * 0.1); ctx.quadraticCurveTo(cx, ty, cx + fw * 1.02, cy - fh * 0.1);
    ctx.quadraticCurveTo(cx, cy - fh * 0.55, cx - fw * 1.02, cy - fh * 0.1);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
  // 枠
  ctx.strokeStyle = 'rgba(150,175,235,.3)'; ctx.lineWidth = 1.5; roundRect(ctx, 0.5, 0.5, s - 1, s - 1, s * 0.12); ctx.stroke();
  ctx.restore();
}
