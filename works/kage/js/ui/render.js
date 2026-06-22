/* ============================================================
   影を壁に落とす絵筆。コアが返す「壁の上のポリゴン」を、ぼけ（半影）と
   濃さをつけて canvas に塗る。誰も影のかたちは描かない——ただ塗るだけ。
   ============================================================ */

import { castPuppet, flicker } from '../core/kage.js';
import { PUPPETS } from '../core/puppets.js';

/* 舞台座標 [0,1]² ↔ 画面ピクセル。歪まないよう一様倍率（cover）。 */
export function makeView(W, H) {
  const unit = Math.max(W, H);
  return {
    W, H, unit, cx: W / 2, cy: H / 2,
    toPx(x, y) { return [this.cx + (x - 0.5) * this.unit, this.cy + (y - 0.5) * this.unit]; },
    toStage(px, py) { return [(px - this.cx) / this.unit + 0.5, (py - this.cy) / this.unit + 0.5]; },
  };
}

function tracePath(ctx, partsPx) {
  for (const part of partsPx) {
    ctx.moveTo(part[0][0], part[0][1]);
    for (let i = 1; i < part.length; i++) ctx.lineTo(part[i][0], part[i][1]);
    ctx.closePath();
  }
}

/* ひと幕を描く。t は秒。selected は強調する切り絵（なければ null）。 */
export function render(ctx, view, scene, t, selected = null) {
  const { W, H, unit } = view;

  // 炎のゆらぎ。灯りは少し震え、明るさも脈打つ。
  const fx = flicker(t, 1) * 0.006;
  const fy = flicker(t, 2) * 0.006;
  const bright = 0.82 + 0.18 * flicker(t * 0.9, 3);
  const lamp = { x: scene.lamp.x + fx, y: scene.lamp.y + fy };
  const [lpx, lpy] = view.toPx(lamp.x, lamp.y);

  // 壁。行灯に照らされた和紙のように、ぜんたいが温かく灯る。
  ctx.fillStyle = '#180c06';
  ctx.fillRect(0, 0, W, H);
  const halo = ctx.createRadialGradient(lpx, lpy, 0, lpx, lpy, unit * 1.35);
  halo.addColorStop(0, `rgba(255,231,180,${(1.0 * bright).toFixed(3)})`);
  halo.addColorStop(0.18, `rgba(251,208,137,${(0.96 * bright).toFixed(3)})`);
  halo.addColorStop(0.42, `rgba(233,168,94,${(0.82 * bright).toFixed(3)})`);
  halo.addColorStop(0.72, `rgba(176,106,58,${(0.55 * bright).toFixed(3)})`);
  halo.addColorStop(1, 'rgba(94,51,32,0.32)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);

  // 影。明るい壁に落ちる、黒いシルエット。遠い（壁ぎわ）ものから順に重ねる。
  const order = scene.puppets.slice().sort((a, b) => b.depth - a.depth);
  let selShadow = null;
  for (const pup of order) {
    const { parts, blur } = castPuppet(lamp, pup);
    const partsPx = parts.map((part) => part.map((v) => view.toPx(v.x, v.y)));
    if (pup === selected) selShadow = partsPx;
    // 壁ぎわ（深い p）ほど濃く締まり、灯りに近い（浅い p）ほど薄く拡がる。
    const alpha = 0.6 + 0.32 * pup.depth;
    ctx.save();
    ctx.filter = `blur(${Math.max(0, blur * unit * 0.85).toFixed(2)}px)`;
    ctx.fillStyle = `rgba(20,10,8,${alpha.toFixed(3)})`;
    ctx.beginPath();
    tracePath(ctx, partsPx);
    ctx.fill('evenodd');
    ctx.restore();
  }

  // 選んだ影には、そっと縁取りを（掴んでいる手がかり）。
  if (selShadow) {
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 6]);
    ctx.strokeStyle = 'rgba(40,18,10,0.7)';
    ctx.beginPath();
    tracePath(ctx, selShadow);
    ctx.stroke();
    ctx.restore();
  }

  // 焔。芯のまわりの暈、ゆらぐ炎、白い芯。ここが「動いて、生きている」ところ。
  const fh = unit * 0.05 * (0.82 + 0.3 * flicker(t * 1.3, 4));
  const fw = unit * 0.015;
  const lean = flicker(t * 1.7, 5) * unit * 0.006;
  const aura = ctx.createRadialGradient(lpx, lpy, 0, lpx, lpy, unit * 0.13 * bright);
  aura.addColorStop(0, 'rgba(255,246,221,0.9)');
  aura.addColorStop(0.5, 'rgba(255,210,138,0.42)');
  aura.addColorStop(1, 'rgba(255,176,96,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(lpx - unit * 0.13, lpy - unit * 0.13, unit * 0.26, unit * 0.26);
  const drawFlame = (h, w, color) => {
    ctx.beginPath();
    ctx.moveTo(lpx + lean, lpy - h);
    ctx.bezierCurveTo(lpx - w * 1.7, lpy - h * 0.42, lpx - w * 1.2, lpy + w * 0.9, lpx, lpy + w * 1.2);
    ctx.bezierCurveTo(lpx + w * 1.2, lpy + w * 0.9, lpx + w * 1.7, lpy - h * 0.42, lpx + lean, lpy - h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  drawFlame(fh, fw, 'rgba(255,170,70,0.95)');
  drawFlame(fh * 0.6, fw * 0.6, 'rgba(255,245,212,0.95)');

  // ヴィネット。縁を静かに落として、灯りに目を集める。
  const vig = ctx.createRadialGradient(lpx, lpy, unit * 0.2, lpx, lpy, unit * 0.95);
  vig.addColorStop(0, 'rgba(18,8,2,0)');
  vig.addColorStop(0.7, 'rgba(18,8,2,0)');
  vig.addColorStop(1, 'rgba(18,8,2,0.66)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

/* 道具箱に並べる、切り絵の小さな見本（影絵らしく黒で）。 */
export function thumbPath(kind, size = 40) {
  const pup = PUPPETS[kind];
  const half = size / 2;
  let d = '';
  for (const part of pup.parts) {
    d += 'M';
    for (let i = 0; i < part.length; i++) {
      const [x, y] = part[i];
      d += `${(half + x * size * 0.9).toFixed(1)} ${(half + y * size * 0.9).toFixed(1)} ${i === 0 ? 'L' : ''}`;
    }
    d += 'Z';
  }
  return d.replace(/L$/g, '');
}
