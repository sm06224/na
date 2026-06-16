/* ============================================================
   陣 — 野営（章の合間のフェーズを RPG らしく）。
   拠点の頭に、夜の野営をドット絵で描く——星空・遠い丘・天幕・焚き火、
   そして仲間がドット絵の駒で焚き火を囲む。章ごとに小さなつぶやきも。
   画像なし・依存ゼロ。drawCamp は毎フレーム呼ばれてよい（焚き火が揺らぐ）。
   ============================================================ */

import { drawTokenPixel } from './pixelsprite.js';

const MURMURS = [
  '焚き火がはぜる。明日はどんな戦になるだろう。',
  '「研いだ刃は、夜のうちに整えておけ」——古参の声。',
  '星が低い。故郷でも同じ空を見ているだろうか。',
  '見張りの交代。火を絶やすな。',
  '誰かが小さく歌っている。戦の合間の、つかの間の安らぎ。',
  '傷の手当ては済んだ。あとは眠るだけだ。',
  '地図を広げ、明日の道筋を指でなぞる。',
  '鍋がことこと鳴る。腹が満ちれば、士気も上がる。',
  '「無理はするな。生きて帰ることが、いちばんの務めだ」',
  '遠くで狼が鳴いた。火を囲む輪が、少しだけ縮まる。',
  '研磨石を回す音。槍の穂先が月を映す。',
  '明日、また一歩。種は蒔かれ、戦記は続く。',
];

/* 章と種から決まる、その夜のつぶやき（純粋）。 */
export function campLine(seed, chapterIndex) {
  let h = ((seed >>> 0) ^ ((chapterIndex + 1) * 2654435761)) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0;
  return MURMURS[h % MURMURS.length];
}

function star(ctx, x, y, s, a) { ctx.globalAlpha = a; ctx.fillStyle = '#dfe7ff'; ctx.fillRect(x, y, s, s); ctx.globalAlpha = 1; }

/* 野営シーンを描く。party は livingParty。now はフリッカ用（任意）。 */
export function drawCamp(canvas, party, now = 0) {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const w = canvas.clientWidth || 520, h = 132;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.height = h + 'px';
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  // 夜空
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#10131f'); sky.addColorStop(0.7, '#1a2030'); sky.addColorStop(1, '#26241c');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  // 星（決定的）
  for (let i = 0; i < 40; i++) {
    const hx = (i * 73856093) >>> 0, hy = (i * 19349663) >>> 0;
    const x = hx % w, y = (hy % (h * 0.6)) | 0;
    const tw = 0.5 + 0.5 * Math.sin(now / 600 + i);
    star(ctx, x, y, 2, 0.4 + tw * 0.5);
  }
  // 遠い丘
  ctx.fillStyle = '#1c2a22';
  ctx.beginPath(); ctx.moveTo(0, h * 0.66);
  for (let x = 0; x <= w; x += 24) ctx.lineTo(x, h * 0.66 - (Math.sin(x * 0.03) * 8 + 8));
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
  // 地面
  ctx.fillStyle = '#2c2618'; ctx.fillRect(0, h * 0.72, w, h * 0.28);

  // 天幕（左右）
  drawTent(ctx, w * 0.12, h * 0.74, 46, '#7a6a4a', '#5a4d34');
  drawTent(ctx, w * 0.86, h * 0.74, 40, '#6a5a8a', '#4a3f63');

  // 焚き火（中央）
  const fx = w * 0.5, fy = h * 0.82;
  ctx.fillStyle = '#3a2c1a'; ctx.fillRect(fx - 16, fy + 4, 32, 5);   // 薪
  ctx.fillStyle = '#241a10'; ctx.fillRect(fx - 12, fy + 8, 24, 3);
  const flick = 0.6 + 0.4 * Math.sin(now / 90) + 0.2 * Math.sin(now / 37);
  // 炎（多層）
  const flame = (rx, ry, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(fx, fy - ry * flick); ctx.lineTo(fx - rx, fy + 4); ctx.lineTo(fx + rx, fy + 4); ctx.closePath(); ctx.fill(); };
  // 光輪
  const g = ctx.createRadialGradient(fx, fy, 2, fx, fy, 60 * flick);
  g.addColorStop(0, 'rgba(255,190,90,.35)'); g.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx, fy, 60, 0, Math.PI * 2); ctx.fill();
  flame(13, 30, '#e8521f'); flame(9, 24, '#ff9a32'); flame(5, 16, '#ffe07a');
  // 火の粉
  for (let i = 0; i < 5; i++) { const t = (now / 500 + i * 0.2) % 1; star(ctx, fx + Math.sin((now / 200) + i) * 10, fy - t * 40, 2, 1 - t); }

  // 仲間（焚き火を囲むドット絵）
  const roster = (party || []).slice(0, 7);
  const n = roster.length;
  roster.forEach((u, i) => {
    const side = i % 2 === 0 ? -1 : 1;
    const rank = Math.floor(i / 2);
    const cx = fx + side * (44 + rank * 40);
    const cy = h * 0.78 + (rank % 2) * 6;
    drawTokenPixel(ctx, u, cx, cy, 30, { hp: false });
  });
}

function drawTent(ctx, x, y, s, col, shade) {
  ctx.fillStyle = shade; ctx.beginPath(); ctx.moveTo(x, y - s * 0.7); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x - s * 0.6, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - s * 0.7); ctx.lineTo(x + s * 0.1, y - s * 0.7); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x + s * 0.2, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1a140c'; ctx.beginPath(); ctx.moveTo(x, y - s * 0.5); ctx.lineTo(x + s * 0.14, y); ctx.lineTo(x - s * 0.14, y); ctx.closePath(); ctx.fill();   // 入口
}
