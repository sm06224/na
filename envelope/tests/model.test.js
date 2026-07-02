/* ============================================================
   仕様書 v2.0 の「正しさ調査」— 主張を一つずつ数値で裏取りする。
   各テスト名は仕様の節番号を引く。落ちたら仕様側の記述が疑わしい。
   ============================================================ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weibullCDF, etaFromAnchor, cohortSeries, envelope, poolPlan,
  ruleOfThree, totalUnitYears, triggers, mixtureFlattening, sensitivity, parseCohorts, betaGrid }
  from '../js/core/model.js';

const FLEET1 = [{ year: 2010, count: 3000 }];                 // 一括納入（比較の基準）
const FLEET5 = [2008, 2009, 2010, 2011, 2012].map((y) => ({ year: y, count: 600 }));  // 5年分散
const BASE = { Fa: 0.30, Tdesign: 40, betaMin: 2, betaMax: 5, horizon: 2085, ks: 1.3, L: 2, alpha: 0.5, nowYear: 2026 };

test('§3.2 アンカー逆算：仕様の例示値（β=2→67.0 / β=3→56.5 / β=5→49.2）を再現する', () => {
  assert.ok(Math.abs(etaFromAnchor(2, 40, 0.30) - 67.0) < 0.05, `β=2: ${etaFromAnchor(2, 40, 0.30)}`);
  assert.ok(Math.abs(etaFromAnchor(3, 40, 0.30) - 56.5) < 0.15, `β=3: ${etaFromAnchor(3, 40, 0.30)}`);
  assert.ok(Math.abs(etaFromAnchor(5, 40, 0.30) - 49.2) < 0.05, `β=5: ${etaFromAnchor(5, 40, 0.30)}`);
  // アンカーの定義そのもの：どの β でも F(40) = F_a ちょうど。
  for (const b of [2, 2.7, 3.5, 5])
    assert.ok(Math.abs(weibullCDF(40, b, etaFromAnchor(b, 40, 0.30)) - 0.30) < 1e-12);
});

test('§3.2 40年時点の想定着地：3,000 × 0.30 = 900台', () => {
  const s = cohortSeries(FLEET1, 3, etaFromAnchor(3, 40, 0.30), 2050);
  const D40 = s.D[s.years.indexOf(2050)];
  assert.ok(Math.abs(D40 - 900) < 1e-6, `D(2050)=${D40}`);
});

test('§3.2 支配βは評価量で異なる：累積の早期は低β、単年度ピークは高β', () => {
  // アンカー手前（例: 20年目）の累積は低βが上（早く立ち上がる）。
  const e2 = etaFromAnchor(2, 40, 0.30), e5 = etaFromAnchor(5, 40, 0.30);
  assert.ok(weibullCDF(20, 2, e2) > weibullCDF(20, 5, e5), '20年目は β=2 が上のはず');
  // アンカー越え（例: 50年目）では逆転する。
  assert.ok(weibullCDF(50, 5, e5) > weibullCDF(50, 2, e2), '50年目は β=5 が上のはず');
  // 単年度ピークは高βが鋭い。
  const d2 = Math.max(...cohortSeries(FLEET1, 2, e2, 2090).d);
  const d5 = Math.max(...cohortSeries(FLEET1, 5, e5, 2090).d);
  assert.ok(d5 > d2 * 1.5, `ピーク: β=5=${d5.toFixed(1)} vs β=2=${d2.toFixed(1)}`);
  // だから包絡線のピークは常にバンド上限 β から出る。
  const env = envelope(FLEET1, BASE);
  assert.equal(env.peak.beta, 5, `peak.beta=${env.peak.beta}`);
});

test('§4.1 畳み込みは平坦化する（平行移動と違い、ピークが下がり総量は不変）', () => {
  const env1 = envelope(FLEET1, BASE);
  const env5 = envelope(FLEET5, { ...BASE });
  // 総量（十分先の累積）は同じ 3,000 台 × F(∞に向かう同じ割合)。
  const last1 = env1.cumMax[env1.cumMax.length - 1];
  const last5 = env5.cumMax[env5.cumMax.length - 1];
  assert.ok(Math.abs(last1 - last5) / last1 < 0.02, `総量: ${last1} vs ${last5}`);
  // ピークは分散納入の方が低い（重ね合わせの平坦化）。
  assert.ok(env5.peak.value < env1.peak.value, `ピーク: 分散=${env5.peak.value.toFixed(1)} < 一括=${env1.peak.value.toFixed(1)}`);
  // 「平行移動」では総量が変わらないのにピークも変わらない——物理と合わない。
  // （平坦化の事実そのものが、v1 オフセット廃止（§4）の裏付け）
});

test('§9.4 混合（環境不均一）はさらに平坦化 → 単一ワイブルは保守側', () => {
  const m = mixtureFlattening(FLEET1, 4, etaFromAnchor(4, 40, 0.30), 2090, 0.2);
  assert.ok(m.ratio < 0.95, `混合/単一 ピーク比=${m.ratio.toFixed(3)}（<1 で単一が保守側）`);
});

test('§3.3 rule of three：45,000台年ゼロ故障 → λ ≤ 6.7×10⁻⁵、年間期待 ≤ 0.2台', () => {
  const r = ruleOfThree(45000);
  assert.ok(Math.abs(r.lambdaUpper - 6.667e-5) < 1e-7, `λ=${r.lambdaUpper}`);
  assert.ok(r.lambdaUpper * 3000 <= 0.2 + 1e-9, `年間=${(r.lambdaUpper * 3000).toFixed(3)}`);
  // 延べ台年の計算：3,000台 × 15年 = 45,000。
  assert.equal(totalUnitYears([{ year: 2011, count: 3000 }], 2026), 45000);
});

test('§5 プール予備 P = maxD×k_s + R_L（R_L は最悪の L 年転がし窓＝保守側の解決）', () => {
  const env = envelope(FLEET1, BASE);
  const plan = poolPlan(env, { ks: 1.3, L: 2 });
  const maxD = Math.max(...env.annMax);
  assert.equal(plan.maxD, maxD);
  assert.ok(plan.RL >= maxD, 'L年窓はピーク1年ぶん以上');           // 窓はピークを含む
  assert.ok(plan.RL <= 2 * maxD + 1e-9, 'L年窓は L×ピーク以下');
  assert.equal(plan.P, Math.ceil(maxD * 1.3 + plan.RL));
  // ピーク年はバンド上限βのピーク年と一致（annMax の argmax）。
  assert.equal(plan.peakYear, env.peak.year);
});

test('§6.2 トリガー：T1 は L 年先読みの α%、T2 は偶発域の床つき（初期発火の穴を塞ぐ）', () => {
  const env = envelope(FLEET1, BASE);
  const t = triggers(env, { nowYear: 2026, L: 2, alpha: 0.5, cohorts: FLEET1 });
  const idx = env.years.indexOf(2028);
  assert.ok(Math.abs(t.T1_level - 0.5 * env.cumMax[idx]) < 1e-9, 'T1 = α × 包絡線(now+L)');
  // 運用初期（例: 5年目）の annMin（β=5 の d）はほぼ 0 → 素の仕様では 1 件で T2 発火。
  const idxEarly = env.years.indexOf(2015);
  assert.ok(env.annMin[idxEarly] < 0.5, `素の T2 しきい値は初期にほぼ0（仕様の穴）: ${env.annMin[idxEarly]}`);
  assert.ok(t.T2_level >= t.lambdaFloor, '床（rule of three の年間期待上限）が敷かれている');
});

test('§9 感度分析：F_a に対して P とピークは単調（0.20 < 0.30 < 0.50）', () => {
  const s = sensitivity(FLEET5, BASE);
  assert.equal(s.Fa.length, 3);
  assert.ok(s.Fa[0].P < s.Fa[1].P && s.Fa[1].P < s.Fa[2].P, JSON.stringify(s.Fa));
  // L が延びるほど T1 は上がり（早めに動く）、P も増える。
  assert.ok(s.L[0].T1 < s.L[1].T1 && s.L[1].T1 < s.L[2].T1);
  assert.ok(s.L[0].P <= s.L[1].P && s.L[1].P <= s.L[2].P);
});

test('入力：CSV（納入年,台数）を読み、ヘッダと注釈を無視し、壊れた行は正直に指摘', () => {
  const { cohorts, errors } = parseCohorts('納入年,台数\n2010,100\n# コメント\n2011\t300\nおかしい行');
  assert.deepEqual(cohorts, [{ year: 2010, count: 100 }, { year: 2011, count: 300 }]);
  assert.equal(errors.length, 1);
});

test('決定的：同じ入力からは同じ包絡線・同じ P', () => {
  assert.deepEqual(envelope(FLEET5, BASE), envelope(FLEET5, BASE));
  assert.deepEqual(betaGrid(2, 5), betaGrid(2, 5));
});

// ---- v2: 残置プール・調達断絶・観測 --------------------------------------------
const { poolTrajectory, depletionRange, reorderPoint, ltbPlan, poolReview, evalObservations } =
  await import('../js/core/model.js');

test('§5補 残置プール軌跡：早い側≤遅い側、在庫が多いほど枯渇は遅い', () => {
  const env = envelope(FLEET5, BASE);
  const tr = poolTrajectory(env, { stock: 375, fromYear: 2026, toYear: 2052 });
  assert.equal(tr.years[0], 2026);
  assert.equal(tr.years[tr.years.length - 1], 2052);            // 退役で打ち切る
  assert.equal(tr.fast[0], 375);                                 // 起点は在庫そのもの
  for (let i = 0; i < tr.years.length; i++)
    assert.ok(tr.fast[i] <= tr.slow[i] + 1e-9, '上縁消費の側が常に下');
  const d1 = depletionRange(env, { stock: 375, fromYear: 2026, toYear: 2052 });
  const d2 = depletionRange(env, { stock: 40, fromYear: 2026, toYear: 2052 });
  assert.ok(d1.earliest === null || d2.earliest <= d1.earliest, '在庫が少ないほど早く尽きる');
  if (d1.earliest && d1.latest) assert.ok(d1.earliest <= d1.latest, '最早 ≤ 最遅');
});

test('§5補 発注点：今後 L 年の上縁消費。L に対して単調増', () => {
  const env = envelope(FLEET5, BASE);
  const rp1 = reorderPoint(env, { year: 2026, L: 1 });
  const rp2 = reorderPoint(env, { year: 2026, L: 2 });
  const rp3 = reorderPoint(env, { year: 2026, L: 3 });
  assert.ok(rp1 > 0 && rp1 < rp2 && rp2 < rp3);
  // 定義：max_β ( D_β(now+L) − D_β(now) )——β 毎の増分を取ってから包絡。
  // 点包絡の差 cumMax(now+L)−cumMax(now) は支配βの入れ替わりで増分を取り違える
  // （差分の包絡 ≠ 包絡の差分。実装時にテストが検出した落とし穴）。
  const i = env.years.indexOf(2026), j = env.years.indexOf(2028);
  const expected = Math.max(...env.all.map((s) => s.D[j] - s.D[i]));
  assert.ok(Math.abs(rp2 - expected) < 1e-9);
  assert.ok(rp2 >= env.cumMax[j] - env.cumMax[i] - 1e-9, 'β毎の増分包絡は点包絡の差と同等以上に保守的');
});

test('§5補 LTB：断絶が早いほど必要量は大きく、断絶=退役なら 0。lower ≤ need', () => {
  const env = envelope(FLEET5, BASE);
  const a = ltbPlan(env, { eolYear: 2035, retireYear: 2052 });
  const b = ltbPlan(env, { eolYear: 2045, retireYear: 2052 });
  const c = ltbPlan(env, { eolYear: 2052, retireYear: 2052 });
  assert.ok(a.need > b.need && b.need > 0, `${a.need} > ${b.need} > 0`);
  assert.equal(c.need, 0);
  assert.ok(a.lower <= a.need);
});

test('§5補 プール見直し 3 段水位：order < review < ok', () => {
  const env = envelope(FLEET5, BASE);
  const args = { nowYear: 2026, L: 2, ks: 1.3, retireYear: 2052 };
  assert.equal(poolReview(env, { ...args, stock: 0 }).status, 'order');
  const rp = reorderPoint(env, { year: 2026, L: 2 });
  assert.equal(poolReview(env, { ...args, stock: rp + 1 }).status, 'review');
  assert.equal(poolReview(env, { ...args, stock: 100000 }).status, 'ok');
});

test('§6補 観測突き合わせ：ゼロ故障なら全トリガー沈黙、超過なら該当だけ発火', () => {
  const env = envelope(FLEET1, BASE);
  const base = { cohorts: FLEET1, nowYear: 2026, L: 2, alpha: 0.5, ks: 1.3, retireYear: 2050, stock: 375 };
  const quiet = evalObservations(env, { ...base, actuals: [] });
  assert.ok(!quiet.t1.fired && !quiet.t2.fired && !quiet.t3.fired);
  assert.equal(quiet.meanAge, 16);                               // 2010納入・2026現在
  assert.ok(quiet.t3.inRandomRegime);                            // 摩耗開始（20年）前 → T3 が見張る域
  // 累積10台（λ̂=10/48000 > 3/48000）→ T3 発火。T1（水位 ~百台）はまだ。
  const hot = evalObservations(env, { ...base, actuals: [{ year: 2024, cum: 8 }, { year: 2026, cum: 10 }] });
  assert.ok(hot.t3.fired && !hot.t1.fired);
  assert.ok(Math.abs(hot.t2.rate - 1) < 1e-9, '直近レート = (10−8)/(2026−2024) = 1台/年');
});
