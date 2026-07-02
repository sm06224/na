/* ============================================================
   信頼性包絡線コントローラ — 数理コア（仕様書 v2.0 の実装 兼 検証）
   ------------------------------------------------------------
   このファイルは仕様の各節と 1:1 に対応し、コメントで「なぜ」を答える。
   すべて純粋関数・決定的・DOM/ネット非依存。tests/ が数値まで裏取りする。

   仕様の立場（§2-P3・§3.1）:
     故障ゼロのデータからはいかなる分布のパラメータも推定できない。
     だからパラメータは「推定」せず「宣言」し、ワイブル分布族を
     曲線形状の生成器として使う。点予測ではなく、保守側の境界
     （包絡線）の内側に実績を抑え込む「制御」を設計する。
   ============================================================ */

// ---- §付録A ワイブルCDF -----------------------------------------------------
// F(t) = 1 − exp(−(t/η)^β)。β>1 が摩耗（時間とともに壊れやすくなる）、
// β=1 が偶発（指数分布）。本件は摩耗バーストが主敵なので β>1 の族を使う。
export function weibullCDF(t, beta, eta) {
  if (t <= 0) return 0;                       // 納入前（t−t_c<0）は F=0（§4.2）
  return 1 - Math.exp(-Math.pow(t / eta, beta));
}

// ---- §3.2 アンカー逆算 ------------------------------------------------------
// 「設計寿命 T_design 時点の累積故障確率 = F_a」という計画仮定（宣言）から、
// 各 β に対する尺度 η を一意に決める。導出：F(T)=F_a を η について解くだけ。
//   1 − exp(−(T/η)^β) = F_a  →  η = T / (−ln(1−F_a))^(1/β)
// これで βバンド内のどの曲線も必ず (T_design, F_a) を通る＝「アンカー」。
export function etaFromAnchor(beta, Tdesign, Fa) {
  return Tdesign / Math.pow(-Math.log(1 - Fa), 1 / beta);
}

// ---- §4.2 コホート畳み込み ---------------------------------------------------
// なぜ平行移動ではだめか（§4.1）：納入年のばらつきは、位相のずれた同じ形の
// カーブの「重ね合わせ」を生む。重ね合わせはピークを均す（平坦化）。
// カーブごと横にずらす操作は物理に対応する事象がなく、しかも計算はこちらの方が単純。
//   D(t) = Σ_c n_c · F(t − t_c)   … 暦年 t までの累積期待故障数
//   d(y) = D(y) − D(y−1)          … 暦年 y の単年度期待消費数
// cohorts: [{year, count}] / horizon: 評価する最終暦年
export function cohortSeries(cohorts, beta, eta, horizon) {
  const y0 = Math.min(...cohorts.map((c) => c.year));
  const years = [], D = [], d = [];
  let prev = 0;
  for (let y = y0; y <= horizon; y++) {
    let cum = 0;
    for (const c of cohorts) cum += c.count * weibullCDF(y - c.year, beta, eta);
    years.push(y); D.push(cum); d.push(cum - prev); prev = cum;
  }
  return { years, D, d };
}

// ---- §3.2 包絡線＝βバンドの最悪値 --------------------------------------------
// 「どの β が最悪か」は評価量で違う（仕様の注意書きどおり）：
//   ・累積 D(t) … アンカー(40年)より手前では低βが上（早く立ち上がる）
//   ・単年度 d(y) … 高βほどピークが鋭い（束になって壊れる）
// だから単一の β を選ばず、バンド全体をスイープして各年の min/max を取る。
// betaGrid はバンドを等分割（端点を必ず含む）。粗すぎると最悪値を取り逃がすので既定 13 点。
export function betaGrid(betaMin, betaMax, steps = 13) {
  const g = [];
  for (let i = 0; i < steps; i++) g.push(betaMin + (betaMax - betaMin) * i / (steps - 1));
  return g;
}

export function envelope(cohorts, params) {
  const { Fa, Tdesign, betaMin, betaMax, horizon } = params;
  const betas = betaGrid(betaMin, betaMax);
  const all = betas.map((b) => ({ beta: b, ...cohortSeries(cohorts, b, etaFromAnchor(b, Tdesign, Fa), horizon) }));
  const years = all[0].years;
  const n = years.length;
  const cumMax = new Array(n).fill(0), cumMin = new Array(n).fill(Infinity);
  const annMax = new Array(n).fill(0), annMin = new Array(n).fill(Infinity);
  let peak = { year: years[0], value: 0, beta: betas[0] };
  for (const s of all) {
    for (let i = 0; i < n; i++) {
      if (s.D[i] > cumMax[i]) cumMax[i] = s.D[i];
      if (s.D[i] < cumMin[i]) cumMin[i] = s.D[i];
      if (s.d[i] > annMax[i]) annMax[i] = s.d[i];
      if (s.d[i] < annMin[i]) annMin[i] = s.d[i];
      if (s.d[i] > peak.value) peak = { year: years[i], value: s.d[i], beta: s.beta };
    }
  }
  return { years, cumMax, cumMin, annMax, annMin, peak, betas, all };
}

// ---- §5 リソース確定（意思決定変数） -----------------------------------------
// P = max d(y) × k_s + R_L
//   max d(y) … 包絡線上の最悪単年度消費。修繕キャパの基準値としてロック（P2）
//   k_s      … 安全係数。期待値まわりのポアソン変動と修繕滞留（送り返し中の在庫拘束）を吸収
//   R_L      … 「調達リードタイム L 年の間に消費される想定数」。仕様の文言
//              「ピーク近傍 L 年分の合計」は窓の置き方が曖昧なので、本実装は
//              保守側に倒して「annMax の L 年転がし和の最大値（最悪の L 年窓）」と定義する。
//              → この解決は README の検証ノートにも明記（曖昧さは解消して宣言する）。
export function poolPlan(env, { ks, L }) {
  const { annMax, years } = env;
  const maxD = Math.max(...annMax);
  let RL = 0;
  for (let i = 0; i <= annMax.length - L; i++) {
    let s = 0;
    for (let j = 0; j < L; j++) s += annMax[i + j];
    if (s > RL) RL = s;
  }
  const P = maxD * ks + RL;
  return { maxD, RL, P: Math.ceil(P), peakYear: years[annMax.indexOf(maxD)] };
}

// ---- §3.3 rule of three ------------------------------------------------------
// ゼロ故障で言える唯一の統計的事実：偶発故障率の 95% 信頼上限 λ ≤ 3/N。
// 由来：ポアソン過程で N 台年ゼロ件の尤度 e^{−λN} ≥ 0.05 ⇔ λ ≤ −ln(0.05)/N ≈ 3/N。
// 有効なのは偶発域だけ。摩耗域（30年目以降のカーブ）には一切の情報を与えない——
// この限定を明記することが査読防御の要点（§3.3）。副次効果として
// 「η が現経過年に近く β が高い早期摩耗シナリオ」だけは棄却できる。
export function ruleOfThree(unitYears) {
  if (unitYears <= 0) return { lambdaUpper: Infinity, annualUpper: Infinity };
  return { lambdaUpper: 3 / unitYears };
}

// 延べ運用台年 N = Σ_c n_c × (現在年 − 納入年)。
export function totalUnitYears(cohorts, nowYear) {
  let s = 0;
  for (const c of cohorts) s += c.count * Math.max(0, nowYear - c.year);
  return s;
}

// ---- §6 トリガー体系 ---------------------------------------------------------
// 原則（§6.1）：摩耗バーストは急峻なので「超えてから」では L 年遅れる。
// 全トリガーを調達リードタイム L 年ぶん手前（先読み）に置く。
//   T1: 累積実績 ≥ α × 包絡線累積(now + L) → 追加調達の検討開始
//   T2: 直近3年移動平均の年間故障数 > 包絡線 d(y) のバンド下限 → パラメータ更新
//   T3: 摩耗域到達前（運用20年未満）に λ_upper を有意超過 → 共通原因故障の疑い（適用範囲外へ）
// 注意（検証で見つけた仕様の穴）：運用初期は annMin ≈ 0 なので T2 が 1 件で発火し得る。
// 本実装は T2 のしきい値に「rule of three の年間期待上限」を床として敷き、
// 偶発域のノイズで発火しないようにする（保守性は損なわない——床はT3が受け持つ域）。
export function triggers(env, { nowYear, L, alpha, cohorts }) {
  const { years, cumMax, annMin } = env;
  const idxAhead = years.indexOf(nowYear + L);
  const T1_level = idxAhead >= 0 ? alpha * cumMax[idxAhead] : null;
  const idxNow = years.indexOf(nowYear);
  const N = totalUnitYears(cohorts, nowYear);
  const fleet = cohorts.reduce((s, c) => s + c.count, 0);
  const lambdaFloor = (3 / Math.max(N, 1)) * fleet;          // 偶発域の年間期待上限（床）
  const T2_level = idxNow >= 0 ? Math.max(annMin[idxNow], lambdaFloor) : null;
  return { T1_level, T2_level, lambdaFloor };
}

// ---- §9.4 混合（frailty）の参考計算 -------------------------------------------
// 主張の検証：環境不均一（η のばらつき）は母集団カーブを「平坦化」する。
// η を ±spread に散らした 2 成分 50:50 混合の単年度ピークを、単一 η のピークと比べる。
// ratio < 1 なら「単一ワイブルはピークを高めに見積もる＝保守側」の裏付けになる。
export function mixtureFlattening(cohorts, beta, eta, horizon, spread = 0.2) {
  const single = cohortSeries(cohorts, beta, eta, horizon);
  const lo = cohortSeries(cohorts, beta, eta * (1 - spread), horizon);
  const hi = cohortSeries(cohorts, beta, eta * (1 + spread), horizon);
  const mixed = single.years.map((_, i) => 0.5 * lo.d[i] + 0.5 * hi.d[i]);
  const peakSingle = Math.max(...single.d);
  const peakMixed = Math.max(...mixed);
  return { peakSingle, peakMixed, ratio: peakMixed / peakSingle };
}

// ---- §9 感度分析の標準セット --------------------------------------------------
// 「宣言した仮定が結論をどれだけ動かすか」を常に添付する（P3 の実務形）。
export function sensitivity(cohorts, base) {
  const out = { Fa: [], L: [] };
  for (const Fa of [0.20, 0.30, 0.50]) {
    const env = envelope(cohorts, { ...base, Fa });
    const plan = poolPlan(env, base);
    out.Fa.push({ Fa, P: plan.P, maxD: plan.maxD, peakYear: plan.peakYear });
  }
  const env0 = envelope(cohorts, base);
  for (const L of [1, 2, 3]) {
    const t = triggers(env0, { ...base, L, cohorts });
    const plan = poolPlan(env0, { ...base, L });
    out.L.push({ L, T1: t.T1_level, P: plan.P, RL: plan.RL });
  }
  return out;
}

// ---- §5補 残置プールの見直し ---------------------------------------------------
// P（§5）は「補充が回っている前提の水位」。補充が止まったら別の問いになる：
// 「いまの残置在庫 S₀ は、無補充でいつまで持つか」。
//   S_β(y) = S₀ − ( D_β(y) − D_β(y₀) )
// 落とし穴（実装時にテストが検出）：「差分の包絡 ≠ 包絡の差分」。
// 点ごとの包絡線 cumMax の差 cumMax(y)−cumMax(y₀) は、窓の途中で支配 β が
// 入れ替わると増分の大小関係が壊れる。正しくは β ごとに増分を取ってから
// 包絡を取る——1 本の真の β が経路全体を生成する、という物理にも一致する。
// toYear は既定で退役年：退役後の需要は存在しないので、そこで軌跡を打ち切る。
export function poolTrajectory(env, { stock, fromYear, toYear = Infinity }) {
  const { years, all } = env;
  const i0 = years.indexOf(fromYear);
  if (i0 < 0) return null;
  const out = { years: [], fast: [], slow: [] };
  for (let i = i0; i < years.length && years[i] <= toYear; i++) {
    let incMax = 0, incMin = Infinity;
    for (const s of all) {
      const inc = s.D[i] - s.D[i0];
      if (inc > incMax) incMax = inc;
      if (inc < incMin) incMin = inc;
    }
    out.years.push(years[i]);
    out.fast.push(stock - incMax);
    out.slow.push(stock - incMin);
  }
  return out;
}

// 枯渇レンジ：在庫が 1 台を切る最初の年。早い側（上縁消費）と遅い側（下縁消費）。
// 期間内に尽きなければ null ＝「退役まで持つ」。
export function depletionRange(env, opts) {
  const tr = poolTrajectory(env, opts);
  if (!tr) return null;
  const firstBelow = (arr) => { for (let i = 0; i < arr.length; i++) if (arr[i] < 1) return tr.years[i]; return null; };
  return { earliest: firstBelow(tr.fast), latest: firstBelow(tr.slow) };
}

// 窓 [y_i, y_j] の消費増分の包絡（β ごとに増分 → min/max）。上の落とし穴の共通解。
function windowConsumption(env, i, j) {
  let max = 0, min = Infinity;
  for (const s of env.all) {
    const inc = s.D[j] - s.D[i];
    if (inc > max) max = inc;
    if (inc < min) min = inc;
  }
  return { max, min };
}

// 発注点（§6.1 の在庫版）：今後 L 年で消費され得る最大量。
// 在庫がこれを割ってから発注しても、届く前に尽きるリスクがある——だから
// 「割ったら発注」ではなく「割る前に発注」。残置プール見直しの一次基準。
export function reorderPoint(env, { year, L }) {
  const i = env.years.indexOf(year), j = env.years.indexOf(year + L);
  if (i < 0 || j < 0) return null;
  return windowConsumption(env, i, j).max;
}

// LTB（Last Time Buy・最終発注量）：調達断絶年 eol から退役年 retire までに
// 消費され得る最大量 ＝「これを最後に買えなくなるなら、いま幾つ買うか」。
// 下限も返す：意思決定は「最低 lower・最悪 need」のレンジで行う（点で誤魔化さない）。
export function ltbPlan(env, { eolYear, retireYear }) {
  const { years } = env;
  const i = years.indexOf(eolYear);
  const j = years.indexOf(Math.min(retireYear, years[years.length - 1]));
  if (i < 0 || j < 0 || j < i) return null;
  const w = windowConsumption(env, i, j);
  return { need: Math.ceil(w.max), lower: Math.ceil(w.min) };
}

// 残置プール総合判定：見直しの基準を 3 段の水位で宣言する。
//   order  … 在庫 < 発注点 RP        → 直ちに調達着手（先読み代がもう無い）
//   review … 在庫 < RP + maxD×k_s   → 見直し着手（最悪1年分の余裕しか無い）
//   ok     … それ以上                → 年次監視の継続
export function poolReview(env, { stock, nowYear, L, ks, retireYear = Infinity }) {
  const rp = reorderPoint(env, { year: nowYear, L });
  if (rp == null) return null;
  const maxD = Math.max(...env.annMax);
  const warnLevel = rp + maxD * ks;
  const status = stock < rp ? 'order' : stock < warnLevel ? 'review' : 'ok';
  return { rp, warnLevel, status, depletion: depletionRange(env, { stock, fromYear: nowYear, toYear: retireYear }) };
}

// ---- §6補 観測の突き合わせ ------------------------------------------------------
// 「観測方法」を文章でなく実行可能な形で定義する：観測量ごとに
// 比較対象（トリガー水位）と現在の判定を返す。UI の観測表はこの結果をそのまま写す。
//   T1: 累積実績 vs α×上縁(now+L)
//   T2: 直近レート（実績2点の差分＝移動平均の代用）vs バンド下限＋偶発床
//   T3: λ̂ = 累積/延べ台年 vs 3/N ——平均機齢が摩耗開始前（既定20年）のときだけ意味を持つ
//   プール: 在庫 vs 発注点
export function evalObservations(env, { actuals, stock, cohorts, nowYear, L, alpha, ks, retireYear, wearOnsetAge = 20 }) {
  const trg = triggers(env, { nowYear, L, alpha, cohorts });
  const N = totalUnitYears(cohorts, nowYear);
  const lambdaUpper = ruleOfThree(N).lambdaUpper;
  const last = actuals.length ? actuals[actuals.length - 1] : null;
  const obsCum = last ? last.cum : 0;
  let rate = null;
  if (actuals.length >= 2) {
    const prev = actuals[actuals.length - 2];
    if (last.year > prev.year) rate = (last.cum - prev.cum) / (last.year - prev.year);
  }
  const fleet = cohorts.reduce((s, c) => s + c.count, 0);
  const meanAge = fleet ? cohorts.reduce((s, c) => s + c.count * Math.max(0, nowYear - c.year), 0) / fleet : 0;
  const lambdaHat = N > 0 ? obsCum / N : null;
  const pool = stock != null ? poolReview(env, { stock, nowYear, L, ks, retireYear }) : null;
  return {
    t1: { level: trg.T1_level, obs: obsCum, fired: trg.T1_level != null && obsCum >= trg.T1_level },
    t2: { level: trg.T2_level, rate, fired: rate != null && trg.T2_level != null && rate > trg.T2_level },
    t3: { lambdaHat, lambdaUpper, inRandomRegime: meanAge < wearOnsetAge,
      fired: lambdaHat != null && meanAge < wearOnsetAge && lambdaHat > lambdaUpper },
    pool, meanAge, N,
  };
}

// ---- 入力（CSV: 納入年,台数）---------------------------------------------------
export function parseCohorts(text) {
  const cohorts = [], errors = [];
  String(text).replace(/\r\n?/g, '\n').split('\n').forEach((line, i) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const m = /^(\d{4})\s*[,\t]\s*(\d+)$/.exec(t);
    if (m) cohorts.push({ year: +m[1], count: +m[2] });
    else if (!/納入|year|delivery/i.test(t)) errors.push(`L${i + 1}: 読めない行「${t}」（例: 2010,100）`);
  });
  return { cohorts, errors };
}
