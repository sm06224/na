/* ============================================================
   影を壁に落とす絵筆。コアが返す「壁の上のポリゴン」を、ぼけ（半影）と
   濃さをつけて canvas に塗る。誰も影のかたちは描かない——ただ塗るだけ。
   ============================================================ */

import { castPuppet, worldParts, flicker } from '../core/kage.js';
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

  // 壁。冷たい闇に、灯りのあたたかい暈（かさ）。
  ctx.fillStyle = '#0a0708';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(lpx, lpy, 0, lpx, lpy, unit * 0.95);
  glow.addColorStop(0, `rgba(255,206,128,${0.42 * bright})`);
  glow.addColorStop(0.18, `rgba(228,150,86,${0.26 * bright})`);
  glow.addColorStop(0.5, `rgba(120,70,48,${0.12 * bright})`);
  glow.addColorStop(1, 'rgba(20,12,10,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 影。遠い（壁ぎわ＝深い p）ものから先に、近いものを後に重ねる。
  const order = scene.puppets.slice().sort((a, b) => b.depth - a.depth);
  for (const pup of order) {
    const { parts, blur } = castPuppet(lamp, pup);
    const partsPx = parts.map((part) => part.map(([x, y]) => view.toPx(x, y)));
    // 近い（p 小）ほど大きく拡がり、薄くなる。壁ぎわは濃く締まる。
    const alpha = 0.28 + 0.46 * pup.depth;
    ctx.save();
    ctx.filter = `blur(${Math.max(0, blur * unit * 0.85).toFixed(2)}px)`;
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(8,5,7,${alpha.toFixed(3)})`;
    ctx.beginPath();
    tracePath(ctx, partsPx);
    ctx.fill('evenodd');
    ctx.restore();
  }

  // 紙。光を受けて、ほのかに浮かぶ切り絵そのもの（触れる手がかり）。
  for (const pup of scene.puppets) {
    const partsPx = worldParts(pup).map((part) => part.map(([x, y]) => view.toPx(x, y)));
    const sel = pup === selected;
    ctx.save();
    ctx.beginPath();
    tracePath(ctx, partsPx);
    ctx.fillStyle = sel ? 'rgba(255,214,150,0.16)' : 'rgba(255,214,150,0.06)';
    ctx.fill('evenodd');
    if (sel) {
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,206,128,0.7)';
      ctx.stroke();
    }
    ctx.restore();
  }

  // 灯り。掴める小さな焔。
  const r = unit * 0.018 * bright;
  const flame = ctx.createRadialGradient(lpx, lpy, 0, lpx, lpy, r * 3);
  flame.addColorStop(0, 'rgba(255,244,214,0.95)');
  flame.addColorStop(0.5, 'rgba(255,196,110,0.6)');
  flame.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.arc(lpx, lpy, r * 3, 0, Math.PI * 2);
  ctx.fill();
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
