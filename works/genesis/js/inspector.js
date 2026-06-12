import { BRAIN } from './genome.js';
import { CFG } from './world.js';

/* ============================================================
   検眼鏡 — 選んだ一匹の中身を覗く。
   遺伝子のバー、そして「いま脳で何が起きているか」のライブ描画。
   ノードの明るさ = 活性、エッジの色 = 重みの符号。
   ============================================================ */

export function drawBrain(ctx, creature, w, h) {
  ctx.clearRect(0, 0, w, h);
  if (!creature || !creature.alive) return;
  const b = creature.brain;
  const { INPUTS: I, HIDDEN: H, OUTPUTS: O, RAYS } = BRAIN;

  const colX = [26, w / 2, w - 30];
  const yOf = (n, i) => 14 + (h - 28) * (n <= 1 ? 0.5 : i / (n - 1));

  // エッジ：W1（入力→隠れ層）
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < I; i++) {
      const wgt = b.W1[j * I + i];
      const a = Math.min(0.5, Math.abs(wgt) * 0.18) * Math.abs(b.lastIn[i]);
      if (a < 0.02) continue;
      ctx.strokeStyle = wgt > 0 ? `rgba(120,235,190,${a})` : `rgba(255,110,130,${a})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(colX[0], yOf(I, i));
      ctx.lineTo(colX[1], yOf(H, j));
      ctx.stroke();
    }
  }
  // エッジ：W2（隠れ層→出力）
  for (let o = 0; o < O; o++) {
    for (let j = 0; j < H; j++) {
      const wgt = b.W2[o * H + j];
      const a = Math.min(0.6, Math.abs(wgt) * 0.22) * Math.abs(b.lastHidden[j]);
      if (a < 0.02) continue;
      ctx.strokeStyle = wgt > 0 ? `rgba(120,235,190,${a})` : `rgba(255,110,130,${a})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(colX[1], yOf(H, j));
      ctx.lineTo(colX[2], yOf(O, o));
      ctx.stroke();
    }
  }

  // 入力ノード（グループで色分け：植物/獲物/脅威/内部感覚）
  const groupColor = i =>
    i < RAYS ? '140,220,160' :
    i < RAYS * 2 ? '255,200,120' :
    i < RAYS * 3 ? '255,120,140' : '160,180,255';
  for (let i = 0; i < I; i++) {
    const v = Math.abs(b.lastIn[i]);
    ctx.fillStyle = `rgba(${groupColor(i)},${0.18 + v * 0.82})`;
    ctx.beginPath();
    ctx.arc(colX[0], yOf(I, i), 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let j = 0; j < H; j++) {
    const v = b.lastHidden[j];
    ctx.fillStyle = v >= 0
      ? `rgba(170,240,210,${0.15 + Math.abs(v) * 0.85})`
      : `rgba(255,140,160,${0.15 + Math.abs(v) * 0.85})`;
    ctx.beginPath();
    ctx.arc(colX[1], yOf(H, j), 4.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const outLabel = ['旋回', '推進'];
  for (let o = 0; o < O; o++) {
    const v = b.lastOut[o];
    ctx.fillStyle = v >= 0
      ? `rgba(170,240,210,${0.2 + Math.abs(v) * 0.8})`
      : `rgba(255,140,160,${0.2 + Math.abs(v) * 0.8})`;
    ctx.beginPath();
    ctx.arc(colX[2], yOf(O, o), 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(220,226,245,0.7)';
    ctx.font = '9px sans-serif';
    ctx.fillText(outLabel[o], colX[2] - 12, yOf(O, o) - 9);
  }
  // 凡例
  ctx.font = '8px sans-serif';
  ctx.fillStyle = 'rgba(140,220,160,.8)'; ctx.fillText('植物', 4, 10);
  ctx.fillStyle = 'rgba(255,200,120,.8)'; ctx.fillText('獲物', 28, 10);
  ctx.fillStyle = 'rgba(255,120,140,.8)'; ctx.fillText('脅威', 52, 10);
  ctx.fillStyle = 'rgba(160,180,255,.8)'; ctx.fillText('内部', 76, 10);
}

/* 遺伝子と身の上のテキストパネルを更新 */
export function renderInfo(el, creature, world) {
  if (!creature || !creature.alive) {
    el.innerHTML = '<div class="dim">個体をクリックすると、その一生と脳の中が見えます</div>';
    return;
  }
  const g = creature.genome;
  const sp = world.species.get(creature.speciesId);
  const bar = (v, lo, hi, hue) => {
    const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
    return `<div class="gbar"><i style="width:${(t * 100).toFixed(0)}%;background:hsl(${hue},70%,60%)"></i></div>`;
  };
  el.innerHTML = `
    <div class="sp-head">
      <span class="swatch" style="background:hsl(${g.hue},75%,60%)"></span>
      <b>${sp ? sp.name : '?'}</b>
      <span class="dim">第 ${creature.generation} 世代 · 種 #${creature.speciesId}</span>
    </div>
    <div class="grow">
      <span>エネルギー</span>${bar(creature.energy, 0, CFG.MAX_ENERGY, 150)}
      <span>年齢</span>${bar(creature.age, 0, creature.maxAge, 220)}
      <span>体格</span>${bar(g.size, 0.65, 1.9, 35)}
      <span>速さ</span>${bar(g.speed, 0.5, 1.7, 200)}
      <span>視程</span>${bar(g.vision, 60, 260, 260)}
      <span>食性</span>${bar(g.diet, 0, 1, 0)}
      <span>変異率</span>${bar(g.mutRate, 0.02, 0.25, 290)}
    </div>`;
}
