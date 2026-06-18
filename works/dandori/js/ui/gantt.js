/* 段取り — 帯グラフ。計画を一枚の絵に。横が時間、縦が料理。
   工程の帯は、要る資源で色分け（手・こんろ・オーブン・放置）。
   live のとき、いまの時刻に縦線を引く。ここに段取りの判断はない。 */

import { hhmm } from '../core/schedule.js';

const COL = {
  idle: '#33414f',     // 放っておける
  hands: '#5aa9e6',    // 手
  heat: '#e8923c',     // こんろ
  oven: '#d8645a',     // オーブン
};
/* 工程の代表色：オーブン＞こんろ＞手＞放置。 */
function colorOf(res) {
  if (res.includes('oven')) return COL.oven;
  if (res.includes('heat')) return COL.heat;
  if (res.includes('hands')) return COL.hands;
  return COL.idle;
}

export function drawGantt(ctx, W, H, plan, now = null) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0e141b'; ctx.fillRect(0, 0, W, H);
  const dishes = plan.dishes;
  if (!dishes.length) return;

  const padL = Math.min(120, W * 0.26), padR = 14, padT = 26, padB = 10;
  const t0 = plan.startAt, t1 = plan.serve;
  const span = Math.max(1, t1 - t0);
  const x = m => padL + (m - t0) / span * (W - padL - padR);
  const rowH = Math.min(46, (H - padT - padB) / dishes.length);
  const barH = Math.min(22, rowH * 0.56);

  // 時刻の目盛り（15分ごと、混むなら30分）。
  const stepMin = span > 180 ? 60 : span > 90 ? 30 : 15;
  const first = Math.ceil(t0 / stepMin) * stepMin;
  ctx.font = '11px ui-monospace, monospace'; ctx.textBaseline = 'middle';
  for (let m = first; m <= t1; m += stepMin) {
    const px = x(m);
    ctx.strokeStyle = 'rgba(160,190,220,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, padT - 6); ctx.lineTo(px, H - padB); ctx.stroke();
    ctx.fillStyle = '#6f8298'; ctx.textAlign = 'center';
    ctx.fillText(hhmm(m), px, 12);
  }
  // 配膳の線。
  const sx = x(t1);
  ctx.strokeStyle = 'rgba(120,220,170,0.55)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(sx, padT - 6); ctx.lineTo(sx, H - padB); ctx.stroke();
  ctx.fillStyle = '#79d6aa'; ctx.textAlign = 'right'; ctx.fillText('配膳', sx - 4, 12);

  // 各料理の行。
  for (let i = 0; i < dishes.length; i++) {
    const d = dishes[i];
    const cy = padT + rowH * i + rowH / 2;
    ctx.fillStyle = '#c7d4e2'; ctx.font = '13px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${d.emoji} ${d.name}`, 6, cy, padL - 10);
    for (const st of d.steps) {
      const bx = x(st.start), bw = Math.max(2, x(st.end) - x(st.start));
      ctx.fillStyle = colorOf(st.res);
      const r = 4;
      roundRect(ctx, bx, cy - barH / 2, bw, barH, r);
      ctx.fill();
      if (st.res.includes('hands')) {                 // 手が要る帯は縁を立てる
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.2;
        roundRect(ctx, bx, cy - barH / 2, bw, barH, r); ctx.stroke();
      }
    }
  }

  // いまの時刻。
  if (now != null && now >= t0 && now <= t1) {
    const nx = x(now);
    ctx.strokeStyle = '#ffd479'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(nx, padT - 6); ctx.lineTo(nx, H - padB); ctx.stroke();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
