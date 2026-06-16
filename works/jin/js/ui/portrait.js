/* 陣 — 顔。画像ファイルなし。名前から決定的に、その人の顔を描く。
   同じ名前からは、いつも同じ顔。会話の話者と、会心のカットインに使う。
   作りは「やわらかなアニメ調」——大きく澄んだ瞳・細い眉・小さな口・ほのかな頬。 */

import { roundRect } from './sprites.js';

const SKINS = ['#f4d8b8', '#ecc8a0', '#e0b488', '#cf9d6e', '#bd8456', '#f6dcc4'];   // 自然な肌色のみ
const HAIRS = ['#33271c', '#5a3a22', '#8a5a2a', '#caa24a', '#e3dccb', '#33405f', '#6a2f3e', '#39564a', '#a23a5a', '#242a33'];
const EYES = ['#3a78b8', '#7a4a2a', '#3a9a64', '#8a48a0', '#b24040', '#445066'];

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

/* やわらかな影／明るみ */
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= (1 + f); g *= (1 + f); b *= (1 + f); }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

/* 顔を描く。(x,y) 左上、s 一辺。opts.color=襟の色, opts.flip=左右反転 */
export function drawPortrait(ctx, key, x, y, s, opts = {}) {
  const f = faceFeatures(key);
  ctx.save();
  ctx.translate(x, y);
  if (opts.flip) { ctx.translate(s, 0); ctx.scale(-1, 1); }
  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, s);
  bg.addColorStop(0, 'rgba(34,42,64,.95)'); bg.addColorStop(1, 'rgba(16,20,32,.95)');
  ctx.fillStyle = bg; roundRect(ctx, 0, 0, s, s, s * 0.12); ctx.fill();
  ctx.save(); roundRect(ctx, 0, 0, s, s, s * 0.12); ctx.clip();

  const cx = s * 0.5, cy = s * 0.50, fw = s * 0.28, fh = s * 0.32;
  // 襟・肩（職/陣営の色）
  const col = opts.color || '#5f7cff';
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.moveTo(s * 0.08, s); ctx.quadraticCurveTo(cx, s * 0.72, s * 0.92, s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(col, 0.18);
  ctx.beginPath(); ctx.moveTo(cx, s * 0.78); ctx.lineTo(s * 0.42, s); ctx.lineTo(s * 0.58, s); ctx.closePath(); ctx.fill();
  // 首
  ctx.fillStyle = shade(f.skin, -0.08); ctx.fillRect(cx - s * 0.08, cy + fh * 0.62, s * 0.16, s * 0.18);
  // 後ろ髪（長髪）
  if (f.long) { ctx.fillStyle = shade(f.hair, -0.12); ctx.beginPath(); ctx.ellipse(cx, cy + fh * 0.25, fw * 1.28, fh * 1.3, 0, 0, Math.PI * 2); ctx.fill(); }
  // 耳
  ctx.fillStyle = f.skin;
  for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + sg * fw * 0.96, cy + fh * 0.18, fw * 0.18, fh * 0.2, 0, 0, Math.PI * 2); ctx.fill(); }
  // 顔（まるい輪郭）
  ctx.fillStyle = f.skin;
  ctx.beginPath(); ctx.ellipse(cx, cy, fw, fh, 0, 0, Math.PI * 2); ctx.fill();
  // あごの丸み・額の明るみ
  ctx.fillStyle = shade(f.skin, 0.14); ctx.beginPath(); ctx.ellipse(cx, cy - fh * 0.32, fw * 0.7, fh * 0.4, 0, 0, Math.PI * 2); ctx.fill();
  // 頬の赤み
  ctx.fillStyle = 'rgba(240,140,130,.30)';
  for (const sg of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + sg * fw * 0.5, cy + fh * 0.34, fw * 0.22, fh * 0.13, 0, 0, Math.PI * 2); ctx.fill(); }

  // 目（大きく澄んだ瞳）——下めに置くと幼くやわらかい
  const ey = cy + fh * 0.16, ex = fw * 0.46, ew = fw * 0.30 * f.eyeW, eh = fh * 0.30;
  for (const sgn of [-1, 1]) {
    const exC = cx + sgn * ex;
    // 白目
    ctx.fillStyle = '#fdfdff'; ctx.beginPath(); ctx.ellipse(exC, ey, ew, eh, 0, 0, Math.PI * 2); ctx.fill();
    // 虹彩（大きめ）
    ctx.fillStyle = f.eye; ctx.beginPath(); ctx.arc(exC, ey + eh * 0.06, ew * 0.82, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(f.eye, -0.4); ctx.beginPath(); ctx.arc(exC, ey + eh * 0.06, ew * 0.46, 0, Math.PI * 2); ctx.fill();   // 瞳孔
    // 大きな光（生き生きと）
    ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.beginPath(); ctx.arc(exC - ew * 0.3, ey - eh * 0.3, ew * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(exC + ew * 0.28, ey + eh * 0.34, ew * 0.14, 0, Math.PI * 2); ctx.fill();
    // 上まぶたの線（目もとを締める）
    ctx.strokeStyle = shade(f.hair, -0.1); ctx.lineWidth = s * 0.02; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(exC, ey, ew, eh, 0, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke();
    // 眉（細く・やわらか）
    ctx.strokeStyle = shade(f.hair, 0.05); ctx.lineWidth = s * 0.016;
    const by = ey - eh * 1.5 + sgn * f.browAngle * 0.008 * s;
    ctx.beginPath(); ctx.moveTo(exC - ew * 0.9, by + eh * 0.12); ctx.quadraticCurveTo(exC, by - eh * 0.18, exC + ew * 0.9, by); ctx.stroke();
  }
  // 鼻（ちいさな点）
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.arc(cx, cy + fh * 0.4, s * 0.012, 0, Math.PI * 2); ctx.fill();
  // 口（小さく）
  ctx.strokeStyle = '#c0625a'; ctx.lineWidth = s * 0.018; ctx.lineCap = 'round';
  ctx.beginPath();
  const my = cy + fh * 0.62, mw = fw * 0.22;
  if (f.mouth === 0) { ctx.moveTo(cx - mw, my); ctx.quadraticCurveTo(cx, my + fh * 0.14, cx + mw, my); }       // 微笑
  else if (f.mouth === 1) { ctx.moveTo(cx - mw * 0.7, my); ctx.lineTo(cx + mw * 0.7, my); }                    // 真一文字
  else { ctx.moveTo(cx - mw * 0.7, my + fh * 0.04); ctx.quadraticCurveTo(cx, my + fh * 0.16, cx + mw * 0.7, my + fh * 0.04); }  // にっこり
  ctx.stroke();

  // 前髪（型ちがい）——艶ハイライトつき
  drawFringe(ctx, f, cx, cy, fw, fh);
  ctx.restore();
  // 枠
  ctx.strokeStyle = 'rgba(150,175,235,.35)'; ctx.lineWidth = 1.5; roundRect(ctx, 0.5, 0.5, s - 1, s - 1, s * 0.12); ctx.stroke();
  ctx.restore();
}

function drawFringe(ctx, f, cx, cy, fw, fh) {
  ctx.fillStyle = f.hair;
  const ty = cy - fh;
  ctx.beginPath();
  if (f.hairStyle === 0) {            // ぱっつん前髪
    ctx.moveTo(cx - fw * 1.08, cy + fh * 0.05); ctx.quadraticCurveTo(cx - fw * 1.12, ty - fh * 0.05, cx, ty - fh * 0.12);
    ctx.quadraticCurveTo(cx + fw * 1.12, ty - fh * 0.05, cx + fw * 1.08, cy + fh * 0.05);
    ctx.lineTo(cx + fw * 0.95, cy - fh * 0.2); ctx.lineTo(cx + fw * 0.5, cy - fh * 0.02);
    ctx.lineTo(cx + fw * 0.18, cy - fh * 0.22); ctx.lineTo(cx - fw * 0.18, cy - fh * 0.02);
    ctx.lineTo(cx - fw * 0.5, cy - fh * 0.22); ctx.lineTo(cx - fw * 0.95, cy - fh * 0.02);
  } else if (f.hairStyle === 1) {     // 横分け
    ctx.moveTo(cx - fw * 1.08, cy); ctx.quadraticCurveTo(cx - fw, ty - fh * 0.06, cx + fw * 0.2, ty - fh * 0.1);
    ctx.quadraticCurveTo(cx + fw * 1.12, ty, cx + fw * 1.08, cy);
    ctx.lineTo(cx + fw * 0.6, cy - fh * 0.18); ctx.quadraticCurveTo(cx - fw * 0.05, cy - fh * 0.5, cx - fw * 0.35, cy - fh * 0.02);
  } else if (f.hairStyle === 2) {     // とげ髪
    ctx.moveTo(cx - fw * 1.06, cy);
    for (let i = -3; i <= 3; i++) { ctx.lineTo(cx + i * fw * 0.32, ty - fh * (0.06 + (i % 2 ? 0.2 : 0))); }
    ctx.lineTo(cx + fw * 1.06, cy); ctx.lineTo(cx + fw * 0.92, cy - fh * 0.18); ctx.lineTo(cx - fw * 0.92, cy - fh * 0.18);
  } else if (f.hairStyle === 3) {     // ふんわり
    ctx.moveTo(cx - fw * 1.14, cy + fh * 0.08); ctx.quadraticCurveTo(cx - fw * 1.2, ty - fh * 0.16, cx, ty - fh * 0.22);
    ctx.quadraticCurveTo(cx + fw * 1.2, ty - fh * 0.16, cx + fw * 1.14, cy + fh * 0.08);
    ctx.quadraticCurveTo(cx + fw * 0.5, cy - fh * 0.52, cx, cy - fh * 0.28); ctx.quadraticCurveTo(cx - fw * 0.5, cy - fh * 0.52, cx - fw * 1.14, cy + fh * 0.08);
  } else {                            // 短め
    ctx.moveTo(cx - fw * 1.04, cy - fh * 0.05); ctx.quadraticCurveTo(cx, ty - fh * 0.05, cx + fw * 1.04, cy - fh * 0.05);
    ctx.quadraticCurveTo(cx, cy - fh * 0.5, cx - fw * 1.04, cy - fh * 0.05);
  }
  ctx.closePath(); ctx.fill();
  // 艶（前髪のハイライト）
  ctx.fillStyle = shade(f.hair, 0.28);
  ctx.beginPath(); ctx.ellipse(cx - fw * 0.35, cy - fh * 0.62, fw * 0.4, fh * 0.12, -0.3, 0, Math.PI * 2); ctx.fill();
}
