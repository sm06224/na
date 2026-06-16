/* 陣 — 顔。画像ファイルなし。名前から決定的に、その人の顔を“ドット絵”で描く。
   盤の駒・地形と同じ粒の手触りに揃える（トーン統一）。同じ名前は同じ顔。 */

import { roundRect } from './sprites.js';

const SKINS = ['#f4d8b8', '#ecc8a0', '#e0b488', '#cf9d6e', '#bd8456', '#f6dcc4'];
const HAIRS = ['#33271c', '#5a3a22', '#8a5a2a', '#caa24a', '#e3dccb', '#33405f', '#6a2f3e', '#39564a', '#a23a5a', '#242a33'];
const EYES = ['#3a78b8', '#7a4a2a', '#3a9a64', '#8a48a0', '#b24040', '#445066'];

function hash(s) {
  let h = 0x811c9dc5; s = String(s);
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

function darken(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r *= (1 - f); g *= (1 - f); b *= (1 - f);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

const R = 20;   // 論理解像度（20×20 の粒）

/* 顔をドット絵で描く。(x,y) 左上、s 一辺。opts.color=襟の色, opts.flip=左右反転 */
export function drawPortrait(ctx, key, x, y, s, opts = {}) {
  const f = faceFeatures(key);
  const hairD = darken(f.hair, 0.28), skinD = darken(f.skin, 0.14), ol = '#20242e';
  ctx.save();
  ctx.translate(x, y);
  if (opts.flip) { ctx.translate(s, 0); ctx.scale(-1, 1); }
  // 背景（角丸）でクリップ
  ctx.fillStyle = '#1b2030'; roundRect(ctx, 0, 0, s, s, s * 0.12); ctx.fill();
  ctx.save(); roundRect(ctx, 0, 0, s, s, s * 0.12); ctx.clip();
  ctx.fillStyle = '#222a3c'; ctx.fillRect(0, 0, s, s);

  const c = s / R;
  // 粒を置く（論理座標で）。範囲は 0..R。
  const grid = Array.from({ length: R }, () => Array(R).fill(null));
  const set = (gx, gy, col) => { if (gx >= 0 && gx < R && gy >= 0 && gy < R && col) grid[gy][gx] = col; };
  const box = (gx, gy, w, h, col) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(gx + i, gy + j, col); };

  const col = opts.color || '#5f7cff';
  // 襟・肩
  box(2, 17, 16, 3, col);
  box(7, 16, 6, 1, darken(col, 0.18));
  // 首
  box(8, 14, 4, 3, skinD);

  // 後ろ髪（長髪）
  if (f.long) { box(3, 4, 14, 13, hairD); }

  // 顔の輪郭（角を落として丸く）
  box(5, 4, 10, 12, f.skin);
  set(5, 4, null); set(14, 4, null); set(5, 15, null); set(14, 15, null);
  set(5, 5, skinD); set(14, 5, skinD);
  // 耳
  set(4, 9, f.skin); set(15, 9, f.skin); set(4, 10, skinD); set(15, 10, skinD);

  // 髪（前髪）型ちがい
  hairTop(box, set, f, hairD);

  // 眉（髪色）
  const bw = f.browAngle;
  box(6, 8, 3, 1, f.hair); box(11, 8, 3, 1, f.hair);
  if (bw > 0) { set(6, 9, f.hair); set(13, 9, f.hair); } else if (bw < 0) { set(8, 9, f.hair); set(11, 9, f.hair); }

  // 目（大きな粒の瞳：白・虹彩・光）
  const eye = (ex) => {
    box(ex, 9, 3, 3, '#fbfdff');           // 白目
    box(ex, 10, 3, 2, f.eye);              // 虹彩
    set(ex + 1, 10, darken(f.eye, 0.45));  // 瞳孔
    set(ex, 9, '#ffffff');                 // ハイライト
  };
  eye(6); eye(11);
  // 鼻
  set(10, 12, skinD);
  // 頬の赤み
  set(6, 12, '#f0a0a0'); set(13, 12, '#f0a0a0');
  // 口
  if (f.mouth === 0) { box(9, 13, 2, 1, '#b65a52'); }                 // 真一文字
  else if (f.mouth === 1) { set(8, 13, '#b65a52'); box(9, 14, 2, 1, '#b65a52'); set(11, 13, '#b65a52'); }  // 笑み
  else { box(9, 13, 2, 1, '#b65a52'); set(8, 14, '#b65a52'); set(11, 14, '#b65a52'); }

  // 描画（整数ピクセルで刻む）
  for (let gy = 0; gy < R; gy++) for (let gx = 0; gx < R; gx++) {
    const cc = grid[gy][gx]; if (!cc) continue;
    ctx.fillStyle = cc; ctx.fillRect(Math.round(gx * c), Math.round(gy * c), Math.ceil(c), Math.ceil(c));
  }
  ctx.restore();
  // 枠
  ctx.strokeStyle = 'rgba(150,175,235,.35)'; ctx.lineWidth = 1.5; roundRect(ctx, 0.5, 0.5, s - 1, s - 1, s * 0.12); ctx.stroke();
  ctx.restore();
}

function hairTop(box, set, f, hairD) {
  const H = f.hair;
  if (f.hairStyle === 0) {            // ぱっつん
    box(5, 3, 10, 4, H); box(4, 5, 1, 4, H); box(15, 5, 1, 4, H);
    // 毛先（前髪の段）
    set(7, 7, H); set(10, 7, H); set(13, 7, H);
  } else if (f.hairStyle === 1) {     // 横分け
    box(5, 3, 10, 3, H); box(4, 5, 1, 4, H); box(15, 5, 1, 4, H);
    box(5, 6, 6, 1, H); set(11, 6, H);
  } else if (f.hairStyle === 2) {     // とげ髪
    box(5, 4, 10, 2, H);
    for (let i = 0; i < 5; i++) set(5 + i * 2, 2 + (i % 2), H);
    box(4, 5, 1, 4, H); box(15, 5, 1, 4, H);
  } else if (f.hairStyle === 3) {     // ふんわり
    box(4, 2, 12, 5, H); box(3, 5, 1, 5, hairD); box(16, 5, 1, 5, hairD);
    set(6, 7, H); set(13, 7, H);
  } else {                            // 短め
    box(5, 3, 10, 3, H); box(4, 5, 1, 3, H); box(15, 5, 1, 3, H);
  }
  // 艶（一段明るい粒）
  set(7, 4, '#ffffff'); set(8, 4, hairD);
}
