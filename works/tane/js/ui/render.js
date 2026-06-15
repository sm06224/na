/* 草木を描く — 種から芽が伸び、枝を分け、葉をひらき、季なら花が咲く。
   節の座標は数学座標（y は上）。view が画面へ写す（y を反転）。
   ゆらぎはすべて節番号から決める（決定的）——同じ種は、にじみまで同じ。 */

const PALETTE = {
  spring: { bg0: '#0b0a12', bg1: '#1a0f1c', glow: 'rgba(255,180,220,.10)', soil: '#2a1c2e',
            stemTip: '#7fd07a', flower: ['#ffd9ec', '#ffc0dd', '#ffe7f4'] },
  summer: { bg0: '#070d0b', bg1: '#0d1a14', glow: 'rgba(120,245,200,.10)', soil: '#142019',
            stemTip: '#56b36a', flower: ['#fff6cf', '#ffe9a8', '#fdfff0'] },
  autumn: { bg0: '#0e0a07', bg1: '#1c130b', glow: 'rgba(255,180,90,.10)', soil: '#241a10',
            stemTip: '#e0913f', flower: ['#ff8a5b', '#ffb347', '#e8633a'] },
  winter: { bg0: '#070a0d', bg1: '#101820', glow: 'rgba(170,200,230,.09)', soil: '#161d24',
            stemTip: '#9fb6bf', flower: ['#eef4f8', '#cfe0ea', '#ffffff'] },
};
const BARK = [54, 38, 28];   // 根もとの色（樹皮）

/* 草木を画面に合わせる（中央に立て、上下に余白を残す） */
export function fitView(view, w, h, plant) {
  view.w = w; view.h = h;
  if (!plant) return;
  const b = plant.bounds;
  const m = 0.16;
  const availW = w * (1 - m), availH = h * (1 - m);
  const s = Math.min(availW / Math.max(b.w, 1), availH / Math.max(b.h, 1));
  view.scale = s;
  view.offX = w / 2 - ((b.minx + b.maxx) / 2) * s;
  view.offY = h / 2 + ((b.miny + b.maxy) / 2) * s;   // y 反転ぶん符号は + で中央へ
}

/* 節番号から決まる、ちいさなゆらぎ（0..1） */
function jitter(i, salt) {
  let h = (i ^ salt) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function mix(c1, c2, t) {
  return `rgb(${Math.round(lerp(c1[0], c2[0], t))},${Math.round(lerp(c1[1], c2[1], t))},${Math.round(lerp(c1[2], c2[2], t))})`;
}

const GROW_MS = 2600;   // 種から立ち上がるまで

export function drawPlant(ctx, plant, view, now, sproutAt) {
  const { w, h } = view;
  const pal = PALETTE[plant ? plant.seasonEn : 'summer'];

  // ---- 空気（季ごとの底色） ----
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, pal.bg0);
  bg.addColorStop(1, pal.bg1);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);

  if (!plant) return;
  const { scale: s, offX, offY } = view;
  const sx = px => px * s + offX;
  const sy = py => -py * s + offY;

  // 育ちの前線（世代で前へ）
  const el = now - sproutAt;
  const t = Math.min(1, el / GROW_MS);
  const ease = 1 - Math.pow(1 - t, 3);
  const front = ease * (plant.maxGen + 1.5);

  // ---- 根もとの土と光 ----
  const rootX = sx(0), rootY = sy(0);
  const soil = ctx.createRadialGradient(rootX, rootY, 0, rootX, rootY, Math.max(w, h) * 0.45);
  soil.addColorStop(0, pal.glow);
  soil.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = soil;
  ctx.fillRect(0, 0, w, h);

  // ---- 茎と枝 ----
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 1; i < plant.nodes.length; i++) {
    const n = plant.nodes[i];
    if (n.gen > front) continue;
    const p = plant.nodes[n.parent];
    const tipFrac = n.gen / Math.max(1, plant.maxGen);          // 0 根もと → 1 先
    const stemTip = [parseInt(pal.stemTip.slice(1, 3), 16),
                     parseInt(pal.stemTip.slice(3, 5), 16),
                     parseInt(pal.stemTip.slice(5, 7), 16)];
    ctx.strokeStyle = mix(BARK, stemTip, Math.min(1, tipFrac * 1.1));
    ctx.lineWidth = Math.max(0.7, Math.log2(n.flow + 1) * 1.05 + (n.main ? 0.6 : 0));
    ctx.beginPath();
    ctx.moveTo(sx(p.x), sy(p.y));
    // 先端の枝はにゅっと伸びる途中を見せる
    if (n.gen > front - 1) {
      const f = front - (n.gen - 1);
      ctx.lineTo(sx(lerp(p.x, n.x, f)), sy(lerp(p.y, n.y, f)));
    } else {
      ctx.lineTo(sx(n.x), sy(n.y));
    }
    ctx.stroke();
  }

  // ---- 葉 ----
  for (let k = 0; k < plant.leaves.length; k++) {
    const lf = plant.leaves[k];
    const n = plant.nodes[lf.node];
    const appear = front - n.gen;
    if (appear <= 0) continue;
    const grow = Math.min(1, appear / 1.4);
    const x = sx(n.x), y = sy(n.y);
    const len = (5 + jitter(lf.node, 11) * 5) * grow;
    const wid = len * 0.5;
    const a = -lf.ang;                                         // 画面は y 反転
    ctx.save();
    ctx.translate(x, y); ctx.rotate(a);
    ctx.globalAlpha = 0.55 + jitter(lf.node, 7) * 0.35;
    ctx.fillStyle = plant.seasonLeaf;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -wid, len, 0);
    ctx.quadraticCurveTo(len * 0.5, wid, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ---- 花 ----
  for (let k = 0; k < plant.flowers.length; k++) {
    const fl = plant.flowers[k];
    const n = plant.nodes[fl.node];
    const appear = front - n.gen;
    if (appear <= 0) continue;
    const grow = Math.min(1, appear / 2.0);
    const x = sx(n.x), y = sy(n.y);
    const col = pal.flower[(fl.node) % pal.flower.length];
    const r = (3.4 + jitter(fl.node, 19) * 2.4) * grow;
    const petals = 5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(jitter(fl.node, 23) * Math.PI * 2);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.92;
    for (let pI = 0; pI < petals; pI++) {
      const a = (pI / petals) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7, r * 0.62, r * 0.42, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = plant.seasonEn === 'summer' ? '#e8b23a' : '#ffe08a';
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // ---- 種（根もとの一粒） ----
  const sg = ctx.createRadialGradient(rootX, rootY, 0, rootX, rootY, 9);
  sg.addColorStop(0, 'rgba(255,240,210,.9)');
  sg.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(rootX, rootY, 9, 0, Math.PI * 2); ctx.fill();
}
