/* ============================================================
   配線層 — 入力を読み、コア（model.js）で計算し、チャート（charts.js）と
   数値タイルに流し込む。DOM を触るのはこのファイルだけ。
   計算はすべて純粋関数なので、ここは「読んで・呼んで・描く」以外をしない。
   ============================================================ */
import { envelope, poolPlan, triggers, ruleOfThree, totalUnitYears,
  mixtureFlattening, sensitivity, etaFromAnchor, parseCohorts } from '../core/model.js';
import { cumChart, annChart } from './charts.js';

const $ = (id) => document.getElementById(id);
const num = (v, d = 1) => v == null ? '—' : (v >= 1000 ? Math.round(v).toLocaleString() : Number(v.toFixed(d)).toLocaleString());

function readParams() {
  return {
    Fa: +$('in-fa').value, Tdesign: +$('in-td').value,
    betaMin: +$('in-bmin').value, betaMax: +$('in-bmax').value,
    L: Math.max(1, Math.round(+$('in-l').value)), ks: +$('in-ks').value,
    alpha: +$('in-alpha').value, nowYear: Math.round(+$('in-now').value),
  };
}

// 評価の最終年は入力にしない：βバンド下限（裾が長い）のピークまで必ず含む年
// （最終納入年 + T_design + 40）を自動で取る。knob を減らすのも手数の削減。
const horizonOf = (cohorts, Tdesign) => Math.max(...cohorts.map((c) => c.year)) + Tdesign + 40;

function compute() {
  const { cohorts, errors } = parseCohorts($('in-cohorts').value);
  $('err-cohorts').textContent = errors.join('\n');
  if (!cohorts.length) return null;
  const p = readParams();
  if (!(p.betaMin > 0) || !(p.betaMax >= p.betaMin) || !(p.Fa > 0 && p.Fa < 1)) return null;
  const params = { ...p, horizon: horizonOf(cohorts, p.Tdesign) };
  const env = envelope(cohorts, params);
  const plan = poolPlan(env, params);
  const trg = triggers(env, { ...params, cohorts });
  const N = totalUnitYears(cohorts, p.nowYear);
  const r3 = ruleOfThree(N);
  // T1 を「線」として引く：各年 t に対し α × 上縁(t+L)。t+L が地平線を越えたら打ち切り。
  const T1curve = env.years.map((y) => {
    const j = env.years.indexOf(y + params.L);
    return j >= 0 ? params.alpha * env.cumMax[j] : null;
  });
  const a = parseCohorts($('in-actuals').value);
  $('err-actuals').textContent = a.errors.join('\n');
  const actuals = a.cohorts.map((c) => ({ year: c.year, cum: c.count }));
  return { cohorts, params, env, plan, trg, N, r3, T1curve, actuals };
}

function tiles(m) {
  const { env, plan, trg, r3, N, params } = m;
  const t = [
    ['crit', 'ピーク単年度 max d(y)', `${num(plan.maxD)}<small> 台/年</small>`,
      `${plan.peakYear}年・β=${env.peak.beta.toFixed(1)} が最悪 — 修繕キャパはこの高さでロック（§5・P2）`],
    ['band', 'プール予備 P', `${plan.P.toLocaleString()}<small> 台</small>`,
      `= max d×k_s(${params.ks}) + R_L(${num(plan.RL)}) — R_L は最悪の L=${params.L} 年窓（§5）`],
    ['warn', `T1 検討開始線（${params.nowYear}年）`, `${num(trg.T1_level)}<small> 台</small>`,
      `= α(${params.alpha}) × 包絡線累積(${params.nowYear + params.L}) — 累積実績がここに達したら調達検討（§6.2）`],
    ['lo', `T2 更新しきい値（${params.nowYear}年）`, `${num(trg.T2_level, 2)}<small> 台/年</small>`,
      `β下限の d(y) と偶発床 ${num(trg.lambdaFloor, 2)} の大きい方 — 3年移動平均で判定（§6.2）`],
    ['', '偶発故障率の上限 λ', `${r3.lambdaUpper < 1 ? r3.lambdaUpper.toExponential(1) : '∞'}<small> /台年</small>`,
      `rule of three：${N.toLocaleString()} 台年ゼロ故障 → λ≤3/N（95%CL・偶発域のみ §3.3）`],
  ];
  $('tiles').innerHTML = t.map(([cls, k, v, f]) =>
    `<div class="tile ${cls}"><div class="k">${k}</div><div class="v">${v}</div><div class="f">${f}</div></div>`).join('');
}

function sensTables(m) {
  const s = sensitivity(m.cohorts, m.params);
  const fa = s.Fa.map((r) => `<tr><td>F_a = ${r.Fa.toFixed(2)}${r.Fa === m.params.Fa ? '（現在）' : ''}</td><td>${num(r.maxD)}</td><td>${r.peakYear}</td><td>${r.P.toLocaleString()}</td></tr>`).join('');
  const ll = s.L.map((r) => `<tr><td>L = ${r.L} 年${r.L === m.params.L ? '（現在）' : ''}</td><td>${num(r.T1)}</td><td>${num(r.RL)}</td><td>${r.P.toLocaleString()}</td></tr>`).join('');
  $('sens').innerHTML =
    `<table><thead><tr><th>アンカー確率</th><th>max d(y) 台/年</th><th>ピーク年</th><th>P 台</th></tr></thead><tbody>${fa}</tbody></table>
     <p class="note">F_a はピーク高さと P をほぼ比例で動かす（ピーク年はほとんど動かない）——「どれだけ壊れるか」の仮定であり「いつ」ではないから。</p>
     <table style="margin-top:10px"><thead><tr><th>リードタイム</th><th>T1 レベル 台</th><th>R_L 台</th><th>P 台</th></tr></thead><tbody>${ll}</tbody></table>
     <p class="note">L が延びるほど T1 は上がり（早めに動く）、R_L と P も増える——先読み距離の代価。</p>`;
  const beta = (m.params.betaMin + m.params.betaMax) / 2;
  const mix = mixtureFlattening(m.cohorts, beta, etaFromAnchor(beta, m.params.Tdesign, m.params.Fa), m.params.horizon);
  $('mix-note').innerHTML =
    `混合チェック（§9.4）：η を ±20% に散らした 50:50 混合のピークは単一ワイブルの <b>${(mix.ratio * 100).toFixed(1)}%</b>` +
    `（${num(mix.peakMixed)} vs ${num(mix.peakSingle)} 台/年）。環境不均一はピークを均すので、単一ワイブルの計画は保守側に立つ。`;
}

function yearTable(m) {
  const { env, T1curve } = m;
  const rows = env.years.map((y, i) =>
    `<tr><td>${y}</td><td>${num(env.cumMin[i])}</td><td>${num(env.cumMax[i])}</td><td>${num(env.annMin[i], 2)}</td><td>${num(env.annMax[i])}</td><td>${T1curve[i] == null ? '—' : num(T1curve[i])}</td></tr>`).join('');
  $('year-table').innerHTML =
    `<table><thead><tr><th>年</th><th>累積 下縁</th><th>累積 上縁</th><th>単年度 下縁</th><th>単年度 上縁</th><th>T1 線</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// 共通ツールチップ：charts.js が置いた透明帯（.hov[data-idx]）を拾う。
// リスナは boot で一度だけ張り、モデルは module 変数から読む（再描画で増殖させない）。
let MODEL = null;
function bindTooltip(container) {
  const tip = $('tip');
  container.addEventListener('pointermove', (e) => {
    const r = e.target.closest('.hov');
    if (!r || !MODEL) { tip.hidden = true; return; }
    const i = +r.dataset.idx, { env, T1curve } = MODEL;
    tip.innerHTML = `<b>${env.years[i]}年</b><br>累積: ${num(env.cumMin[i])} 〜 ${num(env.cumMax[i])} 台<br>` +
      `単年度: ${num(env.annMin[i], 2)} 〜 ${num(env.annMax[i])} 台/年` +
      (T1curve[i] != null ? `<br>T1 線: ${num(T1curve[i])} 台` : '');
    tip.hidden = false;
    const x = Math.min(e.clientX + 14, innerWidth - 280), y = Math.min(e.clientY + 14, innerHeight - 90);
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  });
  container.addEventListener('pointerleave', () => { tip.hidden = true; });
}

function render() {
  const m = compute();
  if (!m) return;
  MODEL = m;
  tiles(m);
  $('chart-cum').innerHTML = cumChart(m.env, { actuals: m.actuals, T1curve: m.T1curve, nowYear: m.params.nowYear });
  $('chart-ann').innerHTML = annChart(m.env, m.plan, { L: m.params.L, T2floor: m.trg.lambdaFloor });
  sensTables(m);
  yearTable(m);
}

export function boot() {
  let t = null;
  const onInput = () => { clearTimeout(t); t = setTimeout(render, 200); };  // 打鍵中は待つ
  for (const el of document.querySelectorAll('input,textarea')) el.addEventListener('input', onInput);
  bindTooltip($('chart-cum'));
  bindTooltip($('chart-ann'));
  render();
}
