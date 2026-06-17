/* 層 — 描画。コアの層データを、土の色と粒のきめで崖に刷る。
   ここに物語の判断はない。厚みと色と粒度を、ただ絵に移すだけ。 */

import { deposit, compact, totalDepth, mulberry32, hashSeed } from '../core/strata.js';

/* 鉱物色(0..11)＋粒度＋出来事から、土の色を決める。 */
function bandColor(layer) {
  if (layer.event === 'ash') return '#c7cdd6';          // 火山灰：青白い
  if (layer.event === 'bloom') return '#241c14';        // 繁茂：黒い腐植
  // 鉄分の縞のように、ゆっくり巡る暖色系の土。
  const hue = 18 + layer.hue * 6;                       // 18..84度（赤茶〜黄土）
  const grainLight = { gravel: -10, sand: 0, silt: 8, clay: 14 }[layer.grain] || 0;
  const sat = layer.grain === 'clay' ? 22 : 34;
  const light = 30 + grainLight + (layer.hue % 3) * 3;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

/* 粒のきめ：粗いほど大きく粗い斑、細かいほど滑らか。決定的に撒く。 */
function speckle(ctx, x, y, w, h, layer, rng) {
  const n = { gravel: 0.9, sand: 0.6, silt: 0.3, clay: 0.12 }[layer.grain] ?? 0.3;
  const dots = Math.floor(w * h * 0.018 * n);
  const size = { gravel: 2.2, sand: 1.5, silt: 1.1, clay: 1.0 }[layer.grain] ?? 1.2;
  ctx.save();
  for (let i = 0; i < dots; i++) {
    const px = x + rng() * w, py = y + rng() * h;
    const dark = rng() < 0.5;
    ctx.fillStyle = dark ? 'rgba(0,0,0,0.16)' : 'rgba(255,245,225,0.10)';
    const s = size * (0.6 + rng() * 0.8);
    ctx.fillRect(px, py, s, s);
  }
  ctx.restore();
}

/* 崖を描き、各層の矩形（年・出来事つき）を返す。reveal は 0..1 の侵食率。 */
export function drawCliff(ctx, W, H, seed, years, reveal = 1) {
  const layers = compact(deposit(seed, years));
  const total = totalDepth(layers);
  const rng = mulberry32(hashSeed(seed) ^ 0x5a17);

  ctx.clearRect(0, 0, W, H);
  // 空ではなく、削り出されたばかりの岩肌の地。
  ctx.fillStyle = '#0e0b08';
  ctx.fillRect(0, 0, W, H);

  const marginR = 64;                       // 右の物差し
  const faceW = W - marginR;
  const cutH = H * reveal;                  // 侵食はここまで進んだ

  // 上（新しい）から下（古い）へ。index 大が新しいので逆に下る。
  const rects = [];
  let y = 0;
  for (let i = layers.length - 1; i >= 0; i--) {
    const L = layers[i];
    const bh = (L.compacted / total) * H;
    const top = y, h = Math.max(0.6, bh);
    rects.push({ x: 0, y: top, w: faceW, h, layer: L });
    y += bh;
  }

  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, faceW, cutH); ctx.clip();   // 侵食ぶんだけ見せる
  for (const r of rects) {
    if (r.y > cutH) break;
    ctx.fillStyle = bandColor(r.layer);
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (r.h >= 1.2) speckle(ctx, r.x, r.y, r.w, r.h, r.layer, rng);

    if (r.layer.event === 'quake') {        // 断層：斜めに走る継ぎ目
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      const off = (hashSeed(seed + ':' + r.layer.year) % 40) - 20;
      ctx.moveTo(0, r.y + r.h * 0.3); ctx.lineTo(faceW, r.y + r.h * 0.7 + off * 0.02);
      ctx.stroke();
    }
    if (r.layer.event === 'drought') {      // 旱魃：ひび割れ
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 0.8;
      for (let k = 0; k < 5; k++) {
        const cx = rng() * faceW;
        ctx.beginPath(); ctx.moveTo(cx, r.y); ctx.lineTo(cx + (rng() - 0.5) * 18, r.y + r.h); ctx.stroke();
      }
    }
    // 縞のあいだの、ほのかな線。
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(r.x, r.y, r.w, 0.7);
  }
  // 出来事の縞には、淡い光の縁を添える。
  for (const r of rects) {
    if (r.y > cutH) break;
    if (r.layer.event && r.layer.event !== 'quake') {
      ctx.strokeStyle = 'rgba(255,240,210,0.35)'; ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, Math.max(1, r.h - 1));
    }
  }
  ctx.restore();

  // 右の物差し：深さ＝時間。何本かの目盛りに「◯年前」を刻む。
  ctx.fillStyle = '#1a1410'; ctx.fillRect(faceW, 0, marginR, H);
  ctx.fillStyle = '#7d6b54'; ctx.font = '10px ui-monospace, monospace'; ctx.textBaseline = 'middle';
  const ticks = 6;
  for (let t = 0; t <= ticks; t++) {
    const yy = (t / ticks) * (H - 1);
    const ago = Math.round((yy / H) * years);
    ctx.strokeStyle = 'rgba(180,150,110,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(faceW, yy); ctx.lineTo(faceW + 6, yy); ctx.stroke();
    ctx.fillText(ago === 0 ? '今' : `${ago}年前`, faceW + 9, Math.min(H - 6, Math.max(6, yy)));
  }
  return rects;
}
