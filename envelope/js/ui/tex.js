/* ============================================================
   tex.js — TeX サブセットの自前レンダラ（純粋・依存ゼロ）
   ------------------------------------------------------------
   なぜ自前か：このツールは「単一 HTML・オフライン・外部依存なし」（§8）。
   KaTeX/MathJax を積めば要件が破れる。必要なのは本ページの式が組める
   だけの小さな部分集合——分数・上下付き・Σ/max/min の下限・ギリシャ文字・
   天井括弧・ハット/バー。それだけを丁寧に組む。
   出力は HTML 文字列（DOM は触らない）。tests/tex.test.js が構造を検証する。
   ============================================================ */

// 1 文字置換で済む記号。コマンド名 → 文字。
const SYM = {
  alpha: 'α', beta: 'β', eta: 'η', lambda: 'λ', Sigma: 'Σ', pi: 'π', infty: '∞',
  le: '≤', ge: '≥', ne: '≠', approx: '≈', times: '×', cdot: '·', pm: '±',
  Rightarrow: '⇒', Longrightarrow: '⟹', to: '→', in: '∈', mid: '∣',
  lceil: '⌈', rceil: '⌉', lfloor: '⌊', rfloor: '⌋', ldots: '…', cdots: '⋯',
};
// 立体（ローマン）で組む演算子名。
const FN = ['exp', 'ln', 'log', 'sin', 'cos'];
// 下限を真下に積む大型演算子。\max_{...} → max の下に小さく添える。
const BIGOP = { sum: 'Σ', max: 'max', min: 'min' };

const esc = (c) => c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c;

// グループ {…} または 1 トークンを読む。[html, 次位置] を返す。
function group(s, i) {
  if (s[i] === '{') {
    const [h, j] = parse(s, i + 1, '}');
    return [h, j];
  }
  if (s[i] === '\\') return command(s, i);
  if (/[A-Za-z]/.test(s[i])) return [`<i>${s[i]}</i>`, i + 1];   // 裸の 1 文字も数学イタリック
  return [esc(s[i]), i + 1];
}

// 合成記号（ハット・バー）は最後の文字「の中」に差し込む——タグの外に置くと
// ブラウザによっては前の字と合成されない。
const accent = (h, mark) => /<\/i>$/.test(h) ? h.replace(/<\/i>$/, mark + '</i>') : h + mark;

function command(s, i) {
  let j = i + 1, name = '';
  while (j < s.length && /[A-Za-z]/.test(s[j])) name += s[j++];
  if (!name) {                                     // \, \; \! などの空白調整
    const c = s[i + 1];
    return [c === ',' ? '<span class="sp"></span>' : c === '!' ? '' : ' ', i + 2];
  }
  if (name === 'quad') return ['<span class="q"></span>', j];
  if (name === 'qquad') return ['<span class="qq"></span>', j];
  if (SYM[name]) return [`<i>${SYM[name]}</i>`, j];
  if (FN.includes(name)) return [`<span class="fn">${name}</span>`, j];
  if (BIGOP[name]) {
    // 直後の _{…} を下限として真下に積む
    if (s[j] === '_') {
      const [lim, k] = group(s, j + 1);
      return [`<span class="mop"><span class="mo">${BIGOP[name]}</span><span class="ml">${lim}</span></span>`, k];
    }
    return [`<span class="fn">${BIGOP[name]}</span>`, j];
  }
  switch (name) {
    case 'frac': {
      const [nu, k1] = group(s, j);
      const [de, k2] = group(s, k1);
      return [`<span class="fr"><span class="nu">${nu}</span><span class="de">${de}</span></span>`, k2];
    }
    case 'mathrm': case 'text': {
      const [h, k] = group(s, j);
      return [`<span class="rm">${h}</span>`, k];
    }
    case 'boxed': {
      const [h, k] = group(s, j);
      return [`<span class="bx">${h}</span>`, k];
    }
    case 'hat': { const [h, k] = group(s, j); return [accent(h, '̂'), k]; }
    case 'bar': { const [h, k] = group(s, j); return [accent(h, '̄'), k]; }
    case 'left': case 'right': case 'bigl': case 'bigr': case 'Bigl': case 'Bigr':
      return ['', j];                              // 括弧そのものは次の文字が担う
    default:
      return [`<span class="rm">${name}</span>`, j]; // 未知コマンドは名前を立体で出す（沈黙より正直）
  }
}

// メインループ。stop 文字（'}'）に当たったら抜ける。
function parse(s, i = 0, stop = null) {
  let out = '';
  while (i < s.length) {
    const c = s[i];
    if (c === stop) return [out, i + 1];
    if (c === '\\') { const [h, j] = command(s, i); out += h; i = j; }
    else if (c === '^') { const [h, j] = group(s, i + 1); out += `<sup>${h}</sup>`; i = j; }
    else if (c === '_') { const [h, j] = group(s, i + 1); out += `<sub>${h}</sub>`; i = j; }
    else if (c === '{') { const [h, j] = parse(s, i + 1, '}'); out += h; i = j; }
    else if (/[A-Za-z]/.test(c)) { out += `<i>${c}</i>`; i++; }   // 変数は数学イタリック
    else if (c === '-') { out += '−'; i++; }                       // ハイフンではなくマイナス記号
    else if (c === "'") { out += '′'; i++; }
    else { out += esc(c); i++; }
  }
  return [out, i];
}

// 公開 API：TeX 文字列 → <span class="tx">…</span>
export function tex(src) {
  return `<span class="tx">${parse(String(src))[0]}</span>`;
}

// ページに載せる式と意味（仕様の節つき）。UI はこの配列を写すだけ。
export const FORMULAS = [
  ['F(t)=1-\\exp\\left[-(t/\\eta)^{\\beta}\\right]',
    'ワイブル CDF。納入から t 年たった 1 台がそれまでに故障している確率。β<1 初期・β=1 偶発・β>1 摩耗', '§3.1'],
  ['\\eta(\\beta)=\\frac{T_{\\mathrm{design}}}{(-\\ln(1-F_a))^{1/\\beta}}',
    'アンカー逆算。「設計寿命で F_a が壊れている」という宣言を各 β の曲線に強制する。どの曲線も必ず (T, F_a) を通る', '§3.2'],
  ['D(t)=\\sum_{c} n_c\\, F(t-t_c) \\qquad d(y)=D(y)-D(y-1)',
    'コホート畳み込み。納入年ごとの重ね合わせが累積 D と単年度 d を作る。重ね合わせはピークを均す（平行移動では表せない）', '§4'],
  ['D^{\\max}(t)=\\max_{\\beta} D_{\\beta}(t) \\qquad d^{\\max}(y)=\\max_{\\beta} d_{\\beta}(y)',
    '包絡線。βバンド全体をスイープした各年の最悪値。累積の早期は低β・単年度ピークは高βが支配するから、単一βでは両方に保守的になれない', '§3.2'],
  ['t^{*}=\\eta\\left(\\frac{\\beta-1}{\\beta}\\right)^{1/\\beta}',
    '単年度ピークの位置（密度のモード）。β=5, η=49.2 なら約 47 年——ピークが設計寿命の後に来るのはアンカーが「40 年でまだ 3 割」だから', '§4'],
  ['P=\\left\\lceil\\, \\max_{y} d^{\\max}(y)\\cdot k_s + R_L \\,\\right\\rceil \\qquad R_L=\\max_{i}\\sum_{j=0}^{L-1} d^{\\max}(y_i+j)',
    'プール予備。最悪 1 年分 × 安全係数 ＋ 補充が届くまでの L 年間の最悪消費（最悪の L 年転がし窓）。「使い切っても次が届くまで尽きない」水位', '§5'],
  ['e^{-\\lambda N}\\ge 0.05 \\;\\Longrightarrow\\; \\lambda\\le\\frac{3}{N}',
    'rule of three。N 台年ゼロ故障と矛盾しない偶発故障率の 95% 上限。偶発域限定——摩耗域のカーブには何も言えない', '§3.3'],
  ['\\mathrm{T1}:\\; D_{\\mathrm{obs}}(y)\\ge\\alpha\\cdot D^{\\max}(y+L) \\qquad \\mathrm{T2}:\\; \\bar{d}_{3\\mathrm{yr}}>\\max(d^{\\min}(y),\\, \\frac{3}{N}\\sum_c n_c)',
    'トリガー。T1 は L 年先の包絡線の α に「今」達したら調達検討（先読み）。T2 はバンド下限すら超えたらパラメータ更新（床は偶発ノイズ対策）', '§6.2'],
  ['\\hat{\\eta}=\\left(\\frac{\\sum_i t_i^{\\beta}}{r}\\right)^{1/\\beta}',
    'WeiBayes。1 件目の故障が出たら β を宣言値に固定して η だけ最尤推定し、宣言 η(β) と突き合わせる', '§6.3'],
  ['S_{\\beta}(y)=S_0-\\left(D_{\\beta}(y)-D_{\\beta}(y_0)\\right)',
    '残置プール軌跡。無補充での在庫の減り方を β 経路ごとに引く。帯の下側が 1 を切る年が枯渇最早', '§5補'],
  ['\\mathrm{RP}(y)=\\max_{\\beta}\\left(D_{\\beta}(y+L)-D_{\\beta}(y)\\right)',
    '発注点。今後 L 年で消費され得る最大量。β ごとに増分を取ってから包絡（差分の包絡 ≠ 包絡の差分——点包絡の差では増分を取り違える）', '§5補'],
  ['Q_{\\mathrm{LTB}}=\\left\\lceil\\max_{\\beta}\\left(D_{\\beta}(y_R)-D_{\\beta}(y_E)\\right)\\right\\rceil',
    'LTB 最終発注量。調達断絶 y_E から退役 y_R までの最大消費。下限 min とのレンジで交渉し、点で誤魔化さない', '§5補'],
];
