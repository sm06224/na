/* ============================================================
   配線層 — 入力を読み、コア（model.js）で計算し、チャート（charts.js）と
   数値タイルに流し込む。DOM を触るのはこのファイルだけ。
   計算はすべて純粋関数なので、ここは「読んで・呼んで・描く」以外をしない。
   ============================================================ */
import { envelope, poolPlan, triggers, ruleOfThree, totalUnitYears,
  mixtureFlattening, sensitivity, etaFromAnchor, parseCohorts,
  poolTrajectory, reorderPoint, ltbPlan, poolReview, evalObservations } from '../core/model.js';
import { cumChart, annChart, poolChart } from './charts.js';

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
  // 残置プール・調達断絶・退役。退役 = 最終納入 + T_design（需要はそこで止まる）。
  const retireYear = Math.max(...cohorts.map((c) => c.year)) + p.Tdesign;
  const stock = $('in-stock').value === '' ? plan.P : Math.max(0, +$('in-stock').value);
  const eolYear = $('in-eol').value === '' ? null : Math.round(+$('in-eol').value);
  const review = poolReview(env, { stock, nowYear: p.nowYear, L: params.L, ks: params.ks, retireYear });
  const traj = poolTrajectory(env, { stock, fromYear: p.nowYear, toYear: retireYear });
  const ltb = eolYear != null ? ltbPlan(env, { eolYear, retireYear }) : null;
  const obs = evalObservations(env, { actuals, stock, cohorts, ...params, retireYear });
  return { cohorts, params, env, plan, trg, N, r3, T1curve, actuals,
    retireYear, stock, eolYear, review, traj, ltb, obs };
}

const BADGE = {
  ok: '<span class="badge ok">監視継続</span>', review: '<span class="badge warn">見直し着手</span>',
  order: '<span class="badge crit">直ちに調達</span>',
};
const fire = (fired, okText = '境界内', firedText = '発火') =>
  fired ? `<span class="badge crit">${firedText}</span>` : `<span class="badge ok">${okText}</span>`;

// 残置プール：ミニ統計＋軌跡チャート
function poolSection(m) {
  const { review, traj, ltb, stock, retireYear, eolYear, params } = m;
  const d = review.depletion;
  const range = d.earliest
    ? `${d.earliest}年 〜 ${d.latest ? d.latest + '年' : '退役まで持つ'}`
    : '退役（' + retireYear + '年）まで持つ';
  const t = [
    [review.status === 'order' ? 'crit' : review.status === 'review' ? 'warn' : 'lo',
      '見直し判定', BADGE[review.status],
      `在庫 ${num(stock)} vs 発注点 ${num(review.rp)}／見直し水位 ${num(review.warnLevel)}（§5補）`],
    ['warn', '発注点', `${num(review.rp)}<small> 台</small>`,
      `今後 L=${params.L} 年で消費され得る最大量 — これを割る前に発注（在庫版の先読み §6.1）`],
    ['band', '枯渇レンジ（無補充）', `<small style="font-size:15px;font-weight:700">${range}</small>`,
      `早い側=最悪β経路・遅い側=最良β経路。レンジで意思決定し点で誤魔化さない`],
    ltb ? ['crit', `LTB 最終発注量（${eolYear}断絶）`, `${ltb.need.toLocaleString()}<small> 台</small>`,
      `断絶〜退役(${retireYear})の最大消費。下限 ${ltb.lower.toLocaleString()} 台とのレンジで交渉する`] : null,
  ].filter(Boolean);
  $('pool-stats').innerHTML = t.map(([cls, k, v, f]) =>
    `<div class="tile ${cls}"><div class="k">${k}</div><div class="v">${v}</div><div class="f">${f}</div></div>`).join('');
  $('chart-pool').innerHTML = poolChart(traj, { rp: review.rp, eolYear, retireYear, depletion: d });
}

// 方策はしご：各段の発動条件を計算値で判定して表示する。
function ladder(m) {
  const { review, ltb, eolYear, retireYear, params } = m;
  const d = review.depletion;
  const yearsLeft = d.earliest ? d.earliest - params.nowYear : null;
  const rows = [
    ['1. 通常調達', '在庫 < 発注点', review.status === 'order' ? BADGE.order : '<span class="badge mute">未発動</span>',
      '通常リードタイム L 年で補充。T1/発注点の先読みが効いていればここで済む'],
    ['2. LTB（最終発注）', '製造中止・EOL の通告', eolYear != null
      ? `<span class="badge crit">断絶 ${eolYear} 年</span> → ${ltb.need.toLocaleString()} 台`
      : '<span class="badge mute">通告なし</span>',
      '退役までの最大消費を一括確保。数量は上のタイル（下限〜最悪のレンジで交渉）'],
    ['3. 代替品認定', `枯渇最早 − 現在 < 認定リードタイム（目安 ${params.L + 1} 年）`,
      yearsLeft != null && yearsLeft < params.L + 1
        ? `<span class="badge warn">残 ${yearsLeft} 年 — 着手</span>` : '<span class="badge mute">余裕あり</span>',
      '同等品・後継品の認定試験を開始。認定にもリードタイムがあるので枯渇レンジから逆算して着手'],
    ['4. 共食い（ドナー機）', '枯渇レンジが退役より手前 かつ LTB 不可',
      d.earliest && d.earliest < retireYear && eolYear == null
        ? '<span class="badge warn">候補</span>' : '<span class="badge mute">—</span>',
      '退役機・低稼働機から部品回収してプールに加算。回収数を在庫に足して本ページで再計算'],
    ['5. 延命・優先度運用', '上の全段で不足が残る',
      '<span class="badge mute">最後の手段</span>',
      '負荷低減（derating）で η を伸ばす／重要系統に優先割当。効果は感度分析で事前に定量化'],
  ];
  $('ladder').innerHTML =
    `<table><thead><tr><th class="l">方策</th><th class="l">発動条件</th><th class="l">現在の判定</th><th class="l">内容</th></tr></thead><tbody>${
      rows.map((r) => `<tr>${r.map((c) => `<td class="l">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

// 観測表：evalObservations の結果をそのまま写す＝観測方法の実行可能な定義。
function obsTable(m) {
  const { obs, params, plan } = m;
  const e = (v, d = 2) => v == null ? '—' : v < 0.01 ? v.toExponential(1) : num(v, d);
  const rows = [
    ['累積故障数 D_obs', '年次', `T1 = ${num(obs.t1.level)} 台（α×上縁 ${params.nowYear + params.L} 年）`,
      `${num(obs.t1.obs)} 台 ` + fire(obs.t1.fired, '境界内', 'T1 発火'),
      '追加調達の検討を開始（§6.2）'],
    ['年間故障数（3年移動平均）', '年次', `T2 = ${e(obs.t2.level)} 台/年（β下限＋偶発床）`,
      obs.t2.rate == null ? '<span class="badge mute">実績2点以上で判定</span>'
        : `${e(obs.t2.rate)} 台/年 ` + fire(obs.t2.fired, '境界内', 'T2 発火'),
      'WeiBayes（β固定・η最尤）で宣言値を点検し包絡線を更新（§6.3）'],
    ['偶発率 λ̂ = D_obs / N', '故障の都度', `λ_upper = ${obs.t3.lambdaUpper.toExponential(1)} /台年（3/N）`,
      !obs.t3.inRandomRegime ? `<span class="badge mute">平均機齢 ${num(obs.meanAge)} 年 — 摩耗域は対象外</span>`
        : (obs.t3.lambdaHat ? obs.t3.lambdaHat.toExponential(1) + ' ' : 'ゼロ故障 ') + fire(obs.t3.fired, '境界内', 'T3 発火'),
      '共通原因故障を疑い調査。本モデルの適用範囲外へ（§7）'],
    ['残置プール在庫 S', '年次棚卸', `発注点 ${num(obs.pool.rp)} 台／見直し水位 ${num(obs.pool.warnLevel)} 台`,
      `${num(m.stock)} 台 ` + BADGE[obs.pool.status],
      '発注点割れ→調達着手。調達不可なら方策はしごを降りる'],
    ['修繕滞留数', '四半期', `目安 (k_s−1)×max d = ${num((params.ks - 1) * plan.maxD)} 台`,
      '<span class="badge mute">入力外 — 現場で記録</span>',
      '恒常的に超えるなら k_s を見直す（滞留は在庫拘束 §5）'],
    ['故障の記録項目', '故障の都度', '納入年・故障日・機齢・故障モード',
      '<span class="badge mute">—</span>',
      '機齢はワイブルの t。モード別に分ければ将来モード別包絡線に分解できる'],
  ];
  $('obs-table').innerHTML =
    `<table><thead><tr><th class="l">観測量</th><th class="l">頻度</th><th class="l">比較対象（水位）</th><th class="l">現在の判定</th><th class="l">超えたら</th></tr></thead><tbody>${
      rows.map((r) => `<tr>${r.map((c) => `<td class="l">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
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
  poolSection(m);
  ladder(m);
  obsTable(m);
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
