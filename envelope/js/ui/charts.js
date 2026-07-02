/* ============================================================
   チャート描画 — 包絡線を SVG 文字列に。純粋（DOM を触らない）。
   設計方針（dataviz の手順に従う）:
     ・軸は各図 1 本。二重軸は作らない
     ・帯（バンド）＝βスイープの min–max、縁は 2px 線＋直接ラベル
     ・状態色は予約語として使う：警戒=琥珀(T1/T2)、深刻=赤(ピーク・キャパ・先行窓)
     ・グリッドは退く（白 6%）。文字は文字色（系列色で塗らない）
     ・ホバー層は main.js が data-idx を拾って共通ツールチップを出す
   ============================================================ */

const C = {
  band: '#3987e5', bandLo: '#199e70', warn: '#c98500', crit: '#e66767',
  ink: '#e7ebf4', ink2: '#8a93a6', grid: 'rgba(255,255,255,0.06)', actual: '#f2f4f8',
};
const fmt = (v) => v >= 100 ? Math.round(v).toLocaleString() : v >= 10 ? v.toFixed(1) : v.toFixed(2);

function frame(W, H, padL, padB, yMax, years, unit) {
  const padT = 30, padR = 16;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const x = (year) => padL + (year - years[0]) / (years[years.length - 1] - years[0]) * plotW;
  const y = (v) => padT + plotH - (v / yMax) * plotH;
  let g = '';
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {                          // 横グリッド＋y目盛り（退く色）
    const v = yMax * i / ticks, yy = y(v);
    g += `<line x1="${padL}" y1="${yy}" x2="${W - padR}" y2="${yy}" stroke="${C.grid}"/>`
      + `<text x="${padL - 6}" y="${yy + 4}" fill="${C.ink2}" font-size="10" text-anchor="end">${fmt(v)}</text>`;
  }
  const step = Math.max(5, Math.round((years.length / 8) / 5) * 5);
  for (const yr of years) if ((yr - years[0]) % step === 0)
    g += `<text x="${x(yr)}" y="${H - padB + 16}" fill="${C.ink2}" font-size="10" text-anchor="middle">${yr}</text>`;
  g += `<text x="${padL - 34}" y="${padT - 12}" fill="${C.ink2}" font-size="10">${unit}</text>`;
  return { x, y, g, padT, plotH, padL, padR };
}

const poly = (pts) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');

// ---- 累積 D(t)：帯＋実績＋T1 検討開始線 --------------------------------------
export function cumChart(env, { W = 720, H = 300, actuals = [], T1curve = null, nowYear }) {
  const { years, cumMax, cumMin } = env;
  const yMax = Math.max(...cumMax) * 1.08;
  const f = frame(W, H, 52, 26, yMax, years, '累積期待故障数（台）');
  const up = years.map((yr, i) => [f.x(yr), f.y(cumMax[i])]);
  const lo = years.map((yr, i) => [f.x(yr), f.y(cumMin[i])]).reverse();
  let s = f.g;
  s += `<path d="${poly(up)} ${poly(lo).replace('M', 'L')} Z" fill="${C.band}" fill-opacity="0.16"/>`;
  s += `<path d="${poly(up)}" fill="none" stroke="${C.band}" stroke-width="2"/>`;
  s += `<path d="${poly(years.map((yr, i) => [f.x(yr), f.y(cumMin[i])]))}" fill="none" stroke="${C.band}" stroke-width="1.4" stroke-dasharray="4 4" stroke-opacity="0.7"/>`;
  // T1 検討開始線：α × 包絡線(t+L)。これより実績が上に来たら調達検討を「始める」線（§6.2）。
  if (T1curve) {
    s += `<path d="${poly(years.map((yr, i) => [f.x(yr), f.y(T1curve[i])]).filter((_, i) => T1curve[i] != null))}" fill="none" stroke="${C.warn}" stroke-width="1.6" stroke-dasharray="6 4"/>`;
    const li = Math.min(years.length - 1, Math.floor(years.length * 0.72));
    s += `<text x="${f.x(years[li])}" y="${f.y(T1curve[li]) - 6}" fill="${C.warn}" font-size="11">T1 検討開始線（α×L年先読み）</text>`;
  }
  if (nowYear >= years[0] && nowYear <= years[years.length - 1]) {
    s += `<line x1="${f.x(nowYear)}" y1="${f.padT}" x2="${f.x(nowYear)}" y2="${f.padT + f.plotH}" stroke="${C.ink2}" stroke-dasharray="2 4"/>`
      + `<text x="${f.x(nowYear) + 4}" y="${f.padT + 10}" fill="${C.ink2}" font-size="10">現在</text>`;
  }
  for (const a of actuals)                                     // 実績（白点・2pxリング）
    s += `<circle cx="${f.x(a.year)}" cy="${f.y(a.cum)}" r="4" fill="${C.actual}" stroke="#0e131d" stroke-width="2"/>`;
  const mid = Math.floor(years.length * 0.45);
  s += `<text x="${up[mid][0]}" y="${up[mid][1] - 8}" fill="${C.band}" font-size="11">包絡線上縁（βバンド最悪）</text>`;
  s += hoverRects(f, years, W, H);
  return svgWrap(W, H, s);
}

// ---- 単年度 d(y)：棒＋T2 しきい線＋ピーク＋キャパ＋先行 L 年窓 -----------------
export function annChart(env, plan, { W = 720, H = 300, L = 2, T2floor = 0 }) {
  const { years, annMax, annMin, peak } = env;
  const yMax = Math.max(...annMax) * 1.15;
  const f = frame(W, H, 52, 26, yMax, years, '単年度消費（台/年）');
  let s = f.g;
  const bw = Math.max(2, Math.min(8, (W - 80) / years.length - 2));
  years.forEach((yr, i) => {                                   // 細い棒・角丸・面は帯色
    const h = f.y(0) - f.y(annMax[i]);
    if (h < 0.5) return;
    s += `<rect data-idx="${i}" x="${f.x(yr) - bw / 2}" y="${f.y(annMax[i])}" width="${bw}" height="${h}" rx="2" fill="${C.band}" fill-opacity="0.8"/>`;
  });
  // T2 しきい線：βバンド下限の d(y)（＋偶発域の床）。実測3年平均がこれを超えたら更新（§6.2）。
  const t2 = years.map((yr, i) => [f.x(yr), f.y(Math.max(annMin[i], T2floor))]);
  s += `<path d="${poly(t2)}" fill="none" stroke="${C.bandLo}" stroke-width="2" stroke-dasharray="5 4"/>`;
  s += `<text x="${t2[Math.floor(t2.length * 0.65)][0]}" y="${t2[Math.floor(t2.length * 0.65)][1] - 7}" fill="${C.bandLo}" font-size="11">T2 しきい線（β下限＋偶発床）</text>`;
  // 修繕キャパ基準線 = max d(y)（§5：この高さを要員・予算でロックする）。
  s += `<line x1="${f.padL}" y1="${f.y(plan.maxD)}" x2="${W - 16}" y2="${f.y(plan.maxD)}" stroke="${C.crit}" stroke-width="1.6" stroke-dasharray="6 4"/>`
    + `<text x="${f.padL + 4}" y="${f.y(plan.maxD) - 6}" fill="${C.crit}" font-size="11">単年度キャパ基準 = ${fmt(plan.maxD)} 台/年</text>`;
  // 調達先行窓：ピークの L 年手前。ここまでに発注を終えていないと間に合わない（§6.1）。
  const winX0 = f.x(peak.year - L), winX1 = f.x(peak.year);
  s += `<rect x="${winX0}" y="${f.padT}" width="${winX1 - winX0}" height="${f.plotH}" fill="${C.crit}" fill-opacity="0.07"/>`
    + `<text x="${winX0 + 4}" y="${f.padT + 12}" fill="${C.crit}" font-size="10">調達先行窓 L=${L}年</text>`;
  // ピーク（最も過酷な単年度）
  s += `<circle cx="${f.x(peak.year)}" cy="${f.y(peak.value)}" r="4.5" fill="${C.crit}"/>`
    + `<text x="${f.x(peak.year) + 8}" y="${f.y(peak.value) - 4}" fill="${C.crit}" font-size="11">ピーク ${peak.year}年・${fmt(peak.value)}台（β=${peak.beta.toFixed(2)}）</text>`;
  s += hoverRects(f, years, W, H);
  return svgWrap(W, H, s);
}

// ---- 残置プール S(y)：無補充での枯渇帯＋発注点＋断絶・退役 ---------------------
// 帯の下側（早く減る側）が 0 を切る年が「枯渇最早」。見る人の問いは
// 「いまの在庫はいつまで持つか」——だから縦軸は在庫そのもの、水平線は発注点。
export function poolChart(traj, { W = 720, H = 280, rp, eolYear, retireYear, depletion }) {
  const { years, fast, slow } = traj;
  const yMax = Math.max(slow[0], rp || 0) * 1.12;
  const f = frame(W, H, 52, 26, yMax, years, '残置在庫（台）');
  const clamp = (v) => Math.max(0, v);
  const up = years.map((yr, i) => [f.x(yr), f.y(clamp(slow[i]))]);
  const lo = years.map((yr, i) => [f.x(yr), f.y(clamp(fast[i]))]).reverse();
  let s = f.g;
  s += `<path d="${poly(up)} ${poly(lo).replace('M', 'L')} Z" fill="${C.band}" fill-opacity="0.16"/>`;
  s += `<path d="${poly(years.map((yr, i) => [f.x(yr), f.y(clamp(fast[i]))]))}" fill="none" stroke="${C.band}" stroke-width="2"/>`;
  s += `<path d="${poly(up)}" fill="none" stroke="${C.band}" stroke-width="1.4" stroke-dasharray="4 4" stroke-opacity="0.7"/>`;
  const mid = Math.max(1, Math.floor(years.length * 0.3));
  s += `<text x="${f.x(years[mid])}" y="${f.y(clamp(fast[mid])) + 14}" fill="${C.band}" font-size="11">早く減る側（最悪β経路）</text>`;
  // 発注点：ここを割る前に発注しないと、届く前に尽きるリスク（在庫版の先読み）。
  if (rp != null && rp < yMax) {
    s += `<line x1="${f.padL}" y1="${f.y(rp)}" x2="${W - 16}" y2="${f.y(rp)}" stroke="${C.warn}" stroke-width="1.6" stroke-dasharray="6 4"/>`
      + `<text x="${f.padL + 4}" y="${f.y(rp) - 6}" fill="${C.warn}" font-size="11">発注点 = 今後L年の最大消費 ${fmt(rp)} 台</text>`;
  }
  // 調達断絶（あれば）と退役の縦線。
  if (eolYear != null && eolYear >= years[0] && eolYear <= years[years.length - 1]) {
    s += `<line x1="${f.x(eolYear)}" y1="${f.padT}" x2="${f.x(eolYear)}" y2="${f.padT + f.plotH}" stroke="${C.crit}" stroke-dasharray="2 4"/>`
      + `<text x="${f.x(eolYear) + 4}" y="${f.padT + 10}" fill="${C.crit}" font-size="10">調達断絶</text>`;
  }
  if (retireYear != null && retireYear <= years[years.length - 1]) {
    s += `<line x1="${f.x(retireYear)}" y1="${f.padT}" x2="${f.x(retireYear)}" y2="${f.padT + f.plotH}" stroke="${C.ink2}" stroke-dasharray="2 4"/>`
      + `<text x="${f.x(retireYear) - 4}" y="${f.padT + 10}" fill="${C.ink2}" font-size="10" text-anchor="end">退役</text>`;
  }
  // 枯渇マーカー：早い側は深刻色、遅い側は控えめに。
  if (depletion && depletion.earliest) {
    s += `<circle cx="${f.x(depletion.earliest)}" cy="${f.y(0)}" r="4.5" fill="${C.crit}"/>`
      + `<text x="${f.x(depletion.earliest) + 6}" y="${f.y(0) - 8}" fill="${C.crit}" font-size="11">枯渇最早 ${depletion.earliest}年</text>`;
  }
  if (depletion && depletion.latest && depletion.latest !== depletion.earliest) {
    // 最早ラベルと重ならないよう一段上に置く
    s += `<circle cx="${f.x(depletion.latest)}" cy="${f.y(0)}" r="3.5" fill="none" stroke="${C.ink2}" stroke-width="1.5"/>`
      + `<text x="${f.x(depletion.latest) + 6}" y="${f.y(0) - 22}" fill="${C.ink2}" font-size="10">最遅 ${depletion.latest}年</text>`;
  }
  return svgWrap(W, H, s);
}

// ホバー用の透明帯（年ごと）。main.js が data-idx を拾ってツールチップを出す。
function hoverRects(f, years, W, H) {
  let s = '';
  const w = (W - f.padL - f.padR) / years.length;
  years.forEach((yr, i) => {
    s += `<rect class="hov" data-idx="${i}" x="${f.x(yr) - w / 2}" y="${f.padT}" width="${w}" height="${f.plotH}" fill="transparent"/>`;
  });
  return s;
}

const svgWrap = (W, H, inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" font-family="ui-sans-serif,system-ui,sans-serif">${inner}</svg>`;
