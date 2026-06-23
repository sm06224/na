/* ============================================================
   計 — 量（quantity）。ただの数ではなく、次元（単位の正体）を背負う。

   値は「基準単位での大きさ n」と、次元 dim（length/mass/time/data/通貨…の
   指数）と、表示単位 du（km・h… の指数）を持つ。だから 100 km / 2 h は
   おのずと 50 km/h になり、USD と JPY は足し合わせを拒む。

   依存ゼロ。基準：length=m, mass=kg, time=s, data=B, 角度=rad, 通貨=各々。
   ============================================================ */

// 単位表：name → { dim:{基準次元:指数}, factor: 基準単位での大きさ }
const U = {};
const def = (names, dimName, factor) => {
  for (const nm of names) U[nm] = { dim: { [dimName]: 1 }, factor };
};
def(['m', 'meter', 'metre'], 'length', 1);
def(['km'], 'length', 1000); def(['cm'], 'length', 0.01); def(['mm'], 'length', 0.001);
def(['inch'], 'length', 0.0254); def(['ft', 'foot', 'feet'], 'length', 0.3048);
def(['yd', 'yard'], 'length', 0.9144); def(['mi', 'mile'], 'length', 1609.344);
def(['kg'], 'mass', 1); def(['g', 'gram'], 'mass', 0.001); def(['mg'], 'mass', 1e-6);
def(['t', 'ton', 'tonne'], 'mass', 1000); def(['lb', 'lbs', 'pound'], 'mass', 0.45359237);
def(['oz', 'ounce'], 'mass', 0.0283495231);
def(['s', 'sec', 'second'], 'time', 1); def(['ms'], 'time', 0.001);
def(['min', 'minute'], 'time', 60); def(['h', 'hr', 'hour'], 'time', 3600);
def(['day', 'days'], 'time', 86400); def(['week', 'wk'], 'time', 604800);
def(['B', 'byte', 'bytes'], 'data', 1); def(['bit'], 'data', 0.125);
def(['KB', 'kB'], 'data', 1e3); def(['MB'], 'data', 1e6); def(['GB'], 'data', 1e9); def(['TB'], 'data', 1e12);
def(['KiB'], 'data', 1024); def(['MiB'], 'data', 1024 ** 2); def(['GiB'], 'data', 1024 ** 3); def(['TiB'], 'data', 1024 ** 4);
def(['rad', 'radian'], 'angle', 1); def(['deg', 'degree'], 'angle', Math.PI / 180);

// 通貨：それぞれ独立した次元（だから混ぜると拒む）。記号も別名で。
const CUR = { JPY: ['¥', '円', 'yen'], USD: ['$', 'dollar', 'usd'], EUR: ['€', 'euro'], GBP: ['£', 'gbp'], KRW: ['₩', 'won'] };
for (const [code, syms] of Object.entries(CUR)) {
  for (const nm of [code, ...syms]) U[nm] = { dim: { ['cur:' + code]: 1 }, factor: 1 };
}

export function isUnit(name) { return Object.prototype.hasOwnProperty.call(U, name); }
export function isCurrency(name) { return U[name] && Object.keys(U[name].dim).some((d) => d.startsWith('cur:')); }

// マップの足し引き（指数）。0 は消す。
function combine(a, b, sign) {
  const r = { ...a };
  for (const k in b) { r[k] = (r[k] || 0) + sign * b[k]; if (r[k] === 0) delete r[k]; }
  return r;
}
function scaleMap(a, k) {
  const r = {};
  for (const key in a) { const v = a[key] * k; if (v !== 0) r[key] = v; }
  return r;
}
function dimEqual(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) if ((a[k] || 0) !== (b[k] || 0)) return false;
  return true;
}

// 値の作り方
export const scalar = (n) => ({ n, dim: {}, du: {}, percent: false });
export const percent = (n) => ({ n, dim: {}, du: {}, percent: true });
export function quantity(n, unitName) {
  const u = U[unitName];
  if (!u) throw new CalcError(`知らない単位: ${unitName}`);
  // 通貨は記号でも漢字でも、表示はコードに揃える（¥・円 → JPY）
  const key = isCurrency(unitName) ? Object.keys(u.dim)[0].slice(4) : unitName;
  return { n: n * u.factor, dim: { ...u.dim }, du: { [key]: 1 }, percent: false };
}
export function unitValue(unitName) { return quantity(1, unitName); } // 単位そのもの（1 単位）

export class CalcError extends Error {}

export const isDimensionless = (v) => Object.keys(v.dim).length === 0;

// 表示単位 du から、基準への換算係数（基準 = 表示値 × uf）
function dispFactor(du) {
  let f = 1;
  for (const nm in du) f *= U[nm].factor ** du[nm];
  return f;
}

// 演算
export function add(a, b) {
  if (a.percent && !b.percent) return add(b, scaleVal(b, a.n));   // 80 を基準に…は呼ばれない経路
  if (b.percent && !a.percent) return { ...a, n: a.n * (1 + b.n) };   // X + 15%
  if (a.percent && b.percent) return percent(a.n + b.n);
  if (!dimEqual(a.dim, b.dim)) throw new CalcError(`足せない単位どうし：${unitStr(a) || '数'} と ${unitStr(b) || '数'}`);
  return { n: a.n + b.n, dim: { ...a.dim }, du: pickDu(a, b), percent: false };
}
export function sub(a, b) {
  if (b.percent && !a.percent) return { ...a, n: a.n * (1 - b.n) };   // X − 15%
  if (a.percent && b.percent) return percent(a.n - b.n);
  if (!dimEqual(a.dim, b.dim)) throw new CalcError(`引けない単位どうし：${unitStr(a) || '数'} と ${unitStr(b) || '数'}`);
  return { n: a.n - b.n, dim: { ...a.dim }, du: pickDu(a, b), percent: false };
}
function pickDu(a, b) { return Object.keys(a.du).length ? a.du : b.du; }
function scaleVal(v, k) { return { ...v, n: v.n * k }; }

export function mul(a, b) {
  return { n: a.n * b.n, dim: combine(a.dim, b.dim, 1), du: combine(a.du, b.du, 1), percent: false };
}
export function div(a, b) {
  if (b.n === 0) throw new CalcError('0 で割れません');
  return { n: a.n / b.n, dim: combine(a.dim, b.dim, -1), du: combine(a.du, b.du, -1), percent: false };
}
export function pow(a, b) {
  if (!isDimensionless(b)) throw new CalcError('指数に単位は使えません');
  const k = b.n;
  if (!isDimensionless(a)) {
    if (!Number.isInteger(k)) throw new CalcError('単位つきの値は整数乗のみ');
    return { n: a.n ** k, dim: scaleMap(a.dim, k), du: scaleMap(a.du, k), percent: false };
  }
  return scalar(a.n ** k);
}
export function neg(a) { return { ...a, n: -a.n }; }

// 「a of b」：割合や倍率を b に掛ける（20% of 80 = 16）
export function applyOf(a, b) { return mul(scalar(a.n), b); }

// 変換：a を、target の単位すがたに着替える
export function convertTo(a, target) {
  if (!dimEqual(a.dim, target.dim)) throw new CalcError(`変換できません：${unitStr(a) || '数'} → ${unitStr(target) || '数'}`);
  return { n: a.n, dim: { ...a.dim }, du: { ...target.du }, percent: false };
}

// 表示
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sup = (n) => String(n).split('').map((c) => SUP[c] || c).join('');

export function unitStr(v) {
  const du = v.du;
  const pos = [], neg = [];
  for (const nm of Object.keys(du)) {
    const e = du[nm];
    if (e > 0) pos.push(e === 1 ? nm : nm + sup(e));
    else neg.push(Math.abs(e) === 1 ? nm : nm + sup(Math.abs(e)));
  }
  if (!pos.length && !neg.length) return '';
  let s = pos.join('·') || '1';
  if (neg.length) s += '/' + neg.join('·');
  return s;
}

export function formatNumber(x) {
  if (!isFinite(x)) return String(x);
  if (x === 0) return '0';
  const neg = x < 0; x = Math.abs(x);
  let s;
  if (x >= 1e15 || x < 1e-4) {
    s = x.toExponential(4).replace(/\.?0+e/, 'e');
  } else {
    let r = Number(x.toPrecision(10));
    s = r.toFixed(6).replace(/\.?0+$/, '');
    const [intp, frac] = s.split('.');
    s = intp.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac ? '.' + frac : '');
  }
  return (neg ? '-' : '') + s;
}

export function format(v) {
  if (v.percent) return formatNumber(v.n * 100) + '%';
  const us = unitStr(v);
  if (!us) return formatNumber(v.n);
  return formatNumber(v.n / dispFactor(v.du)) + ' ' + us;
}
