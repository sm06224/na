/* 稲妻を描く — 嵐の空に、リーダーが降り、閃光し、残光となって消える。
   セルの座標は格子（0..GRID_W, 0..GRID_H）。view が画面へ写す。 */

import { GRID_W, GRID_H } from '../core/bolt.js';

/* 空の入れ物を画面に合わせる（上に雲、下に地の余白を少し残す） */
export function fitView(view, w, h) {
  view.w = w; view.h = h;
  const margin = 0.14;
  const s = Math.min(w / GRID_W, h / GRID_H) * (1 - margin);
  view.scale = s;
  view.offX = (w - GRID_W * s) / 2;
  view.offY = (h - GRID_H * s) / 2;
}

/* 雨だれ（決定的でなくてよい、ただの雰囲気） */
const RAIN = Array.from({ length: 140 }, () => ({
  x: Math.random(), y: Math.random(), v: 0.5 + Math.random() * 0.9, len: 8 + Math.random() * 16,
}));

export function drawStorm(ctx, bolt, view, now, strikeAt) {
  const { w, h, scale, offX, offY } = view;
  const sx = gx => gx * scale + offX;
  const sy = gy => gy * scale + offY;

  const el = now - strikeAt;                       // 閃光からの経過 ms
  const LEAD = 320;                                // リーダーが降りる時間
  const FLASH = 150;                               // 閃光
  const FADE = 1600;                               // 残光が消えるまで

  // ---- 空の底（嵐の雲と、閃光のときの空ぜんたいの明るみ） ----
  const flash = el < LEAD ? 0 : Math.max(0, 1 - (el - LEAD) / FLASH);
  ctx.fillStyle = '#04050b';
  ctx.fillRect(0, 0, w, h);
  const cloud = ctx.createLinearGradient(0, 0, 0, h);
  cloud.addColorStop(0, `rgba(${36 + flash * 120},${40 + flash * 130},${64 + flash * 150},${0.55 + flash * 0.4})`);
  cloud.addColorStop(0.28, `rgba(18,20,34,${0.5 + flash * 0.3})`);
  cloud.addColorStop(1, 'rgba(4,5,11,0)');
  ctx.fillStyle = cloud;
  ctx.fillRect(0, 0, w, h);
  if (flash > 0) {
    ctx.fillStyle = `rgba(190,205,255,${flash * 0.5})`;
    ctx.fillRect(0, 0, w, h);
  }

  // ---- 地面の線 ----
  const groundY = sy(GRID_H - 1);
  ctx.strokeStyle = `rgba(120,140,190,${0.18 + flash * 0.5})`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke();

  // ---- 雨 ----
  ctx.strokeStyle = 'rgba(150,170,220,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const r of RAIN) {
    const yy = ((r.y + (now * 0.00045 * r.v)) % 1) * h;
    const xx = r.x * w + 6;
    ctx.moveTo(xx, yy); ctx.lineTo(xx - 2, yy + r.len);
  }
  ctx.stroke();

  if (!bolt) return;

  // ---- 稲妻 ----
  // リーダーの降下：深さ順に到達する。f は降下の進み（0..1）。
  let maxDepth = 1;
  for (const c of bolt.cells) if (c.depth > maxDepth) maxDepth = c.depth;
  const f = Math.min(1, el / LEAD);
  const front = f * maxDepth;                      // いまの降下前線（深さ）

  // 残光：閃光のあと、全体が明るみから消えていく
  const after = el < LEAD ? 0 : Math.max(0, 1 - (el - LEAD) / FADE);
  const bright = Math.max(flash, after * 0.7);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 外側のにじみ（紫がかった放電のグロー）
  for (const pass of [0, 1]) {
    for (const c of bolt.cells) {
      if (c.parent < 0) continue;
      if (el < LEAD && c.depth > front) continue;  // まだ降りていない枝は描かない
      const p = bolt.cells[c.parent];
      const flowW = Math.log2(c.flow + 1);         // 電流が太いほど太い
      const onMain = c.main;
      if (pass === 0) {
        // グロー
        const g = 1 + flowW * 1.2;
        ctx.strokeStyle = `rgba(150,175,255,${(0.10 + bright * 0.35) * (onMain ? 1 : 0.7)})`;
        ctx.lineWidth = (g + 5) * (onMain ? 1.3 : 0.8);
      } else {
        // 芯
        ctx.strokeStyle = `rgba(${225},${236},${255},${0.55 + bright * 0.45})`;
        ctx.lineWidth = Math.max(0.7, (0.7 + flowW * 0.9) * (onMain ? 1.25 : 0.85));
      }
      ctx.beginPath();
      ctx.moveTo(sx(p.x), sy(p.y));
      ctx.lineTo(sx(c.x), sy(c.y));
      ctx.stroke();
    }
  }

  // 降下中の先端の燈
  if (el < LEAD) {
    for (const c of bolt.cells) {
      if (c.depth <= front && c.depth > front - 1.2 && c.children.length === 0) {
        const x = sx(c.x), y = sy(c.y);
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 10);
        glow.addColorStop(0, 'rgba(235,242,255,0.9)');
        glow.addColorStop(1, 'rgba(150,175,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // 落雷点の閃光（接地した瞬間からの光輪）
  if (el >= LEAD) {
    const s = bolt.strike, x = sx(s.x), y = sy(s.y);
    const rr = 8 + (1 - after) * 46;
    const halo = ctx.createRadialGradient(x, y, 0, x, y, rr);
    halo.addColorStop(0, `rgba(230,240,255,${bright * 0.9})`);
    halo.addColorStop(1, 'rgba(170,190,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
  }
}
