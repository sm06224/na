/* ============================================================
   計 — 電卓ノートのランタイム。一行ずつ、式を読んで答えを返す。

   字句 → 構文（Pratt） → 評価。値は value.js の「量（次元つき）」。
   単位・変数・%・前行参照（prev / sum / total / line N）を解釈する。
   DOM を知らない。run(notebook文字列) が、行ごとの結果を返す。
   ============================================================ */

import * as V from './value.js';
const { CalcError } = V;

/* ---------------- 字句 ---------------- */
const OPS = { '+': '+', '-': '-', '*': '*', '/': '/', '^': '^', '×': '*', '÷': '/', '−': '-', '–': '-', '·': '*', '•': '*', '％': '%', '%': '%' };
const isLetter = (c) => /\p{L}/u.test(c);

function tokenize(line) {
  const toks = [];
  let i = 0;
  const n = line.length;
  while (i < n) {
    const c = line[i];
    if (c === ' ' || c === '\t') { i++; continue; }
    if (c === '(') { toks.push({ t: 'lp' }); i++; continue; }
    if (c === ')') { toks.push({ t: 'rp' }); i++; continue; }
    if (c === ',') { toks.push({ t: 'comma' }); i++; continue; }
    if (c === '=') { toks.push({ t: 'eq' }); i++; continue; }
    // 数（桁区切りカンマは「,＋3桁」のときだけ・小数・倍率接尾辞・%）
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(line[i + 1] || ''))) {
      let j = i, s = '';
      while (j < n) {
        if (/[0-9]/.test(line[j])) { s += line[j]; j++; }
        else if (line[j] === ',' && /^\d{3}(?!\d)/.test(line.slice(j + 1, j + 5))) { j++; }  // 桁区切り
        else break;
      }
      if (line[j] === '.') { s += '.'; j++; while (j < n && /[0-9]/.test(line[j])) { s += line[j]; j++; } }
      let val = parseFloat(s);
      const rest = line.slice(j);
      const m = rest.match(/^(bn|k|M)(?!\p{L})/u);
      if (m) { val *= { k: 1e3, M: 1e6, bn: 1e9 }[m[1]]; j += m[1].length; }
      let pct = false;
      if (line[j] === '%' || line[j] === '％') { pct = true; j++; }
      toks.push({ t: 'num', v: val, pct });
      i = j; continue;
    }
    if (OPS[c]) { toks.push({ t: 'op', v: OPS[c] }); i++; continue; }
    // 識別子（数字を含まない。日本語・記号通貨も可）
    if (isLetter(c) || /[¥$€£₩_"]/.test(c)) {
      let j = i, s = '';
      while (j < n) {
        const d = line[j];
        if (d === ' ' || d === '\t' || d === '(' || d === ')' || d === ',' || d === '=' || OPS[d] || /[0-9]/.test(d)) break;
        s += d; j++;
      }
      toks.push({ t: 'id', v: s });
      i = j; continue;
    }
    // 知らない記号（: 。 、 ! など）は飛ばす → 散文／ラベルに寛容に
    i++;
  }
  return toks;
}

/* ---------------- 構文＋評価（Pratt） ---------------- */
const FUNCS = {
  sqrt: (a) => { req0(a[0]); return V.scalar(Math.sqrt(a[0].n)); },
  abs: (a) => ({ ...a[0], n: Math.abs(a[0].n) }),
  ln: (a) => { req0(a[0]); return V.scalar(Math.log(a[0].n)); },
  log: (a) => { req0(a[0]); return V.scalar(Math.log10(a[0].n)); },
  round: (a) => roundFn(a, Math.round),
  floor: (a) => roundFn(a, Math.floor),
  ceil: (a) => roundFn(a, Math.ceil),
  min: (a) => a.reduce((p, q) => (q.n < p.n ? q : p)),
  max: (a) => a.reduce((p, q) => (q.n > p.n ? q : p)),
  avg: (a) => scaleDiv(a),
};
function req0(v) { if (!V.isDimensionless(v)) throw new CalcError('単位つきの値には使えません'); }
function scaleDiv(a) { let s = a[0]; for (let k = 1; k < a.length; k++) s = V.add(s, a[k]); return V.div(s, V.scalar(a.length)); }
function roundFn(a, f) {
  const v = a[0]; const nd = a[1] ? a[1].n : 0; const p = 10 ** nd;
  if (V.isDimensionless(v) && !v.percent) return V.scalar(f(v.n * p) / p);
  // 単位つきは「表示の値」を丸める
  const disp = v.n / dispf(v.du); const r = f(disp * p) / p;
  return { ...v, n: r * dispf(v.du) };
}
function dispf(du) { let f = 1; for (const nm in du) f *= unitFactor(nm) ** du[nm]; return f; }
function unitFactor(nm) { return V.quantity(1, nm).n; }   // 1 nm の基準値 = factor

const KW_CONV = new Set(['in', 'to', 'as']);

class Parser {
  constructor(toks, env) { this.toks = toks; this.i = 0; this.env = env; }
  peek() { return this.toks[this.i]; }
  next() { return this.toks[this.i++]; }
  expect(t) { const k = this.next(); if (!k || k.t !== t) throw new CalcError('書き方が違います'); return k; }

  parse() {
    const v = this.conversion();
    if (this.i < this.toks.length) throw new CalcError('余分なものがあります');
    return v;
  }
  conversion() {
    let left = this.addsub();
    while (this.peek() && this.peek().t === 'id' && KW_CONV.has(this.peek().v)) {
      this.next();
      const target = this.addsub();
      left = V.convertTo(left, target);
    }
    return left;
  }
  addsub() {
    let left = this.muldiv();
    while (this.peek() && this.peek().t === 'op' && (this.peek().v === '+' || this.peek().v === '-')) {
      const op = this.next().v;
      const right = this.muldiv();
      left = op === '+' ? V.add(left, right) : V.sub(left, right);
    }
    return left;
  }
  muldiv() {
    let left = this.unary();
    for (;;) {
      const p = this.peek();
      if (p && p.t === 'op' && (p.v === '*' || p.v === '/')) {
        this.next(); const r = this.unary();
        left = p.v === '*' ? V.mul(left, r) : V.div(left, r);
      } else if (p && p.t === 'id' && (p.v === 'per')) {
        this.next(); left = V.div(left, this.unary());
      } else if (p && p.t === 'id' && p.v === 'of') {
        this.next(); left = V.applyOf(left, this.unary());
      } else break;
    }
    return left;
  }
  unary() {
    const p = this.peek();
    if (p && p.t === 'op' && (p.v === '-' || p.v === '+')) {
      this.next(); const v = this.unary();
      return p.v === '-' ? V.neg(v) : v;
    }
    return this.power();
  }
  power() {
    const base = this.postfix();
    if (this.peek() && this.peek().t === 'op' && this.peek().v === '^') {
      this.next(); const exp = this.unary();
      return V.pow(base, exp);
    }
    return base;
  }
  // 単位の語か？ 既知の単位、または「数え単位」になれる未知語（変数・予約語・関数を除く）。
  isUnitTok(t) {
    if (!t || t.t !== 'id') return false;
    if (V.isUnit(t.v)) return true;
    return !RESERVED.has(t.v) && !FUNCS[t.v] && !this.env.hasVar(t.v);
  }
  postfix() {
    let v = this.primary();
    if (v._rawNumber) {
      if (this.isUnitTok(this.peek())) {
        v = V.mul(V.scalar(v.n), this.unitExpr());   // 数 × 単位式（5 m²・9.8 m/s²・100 km/h）
      } else {
        v = v.pct ? V.percent(v.n / 100) : V.scalar(v.n);
      }
    } else if (v._bareUnit) {
      v = this.unitExprFrom(v);                       // 裸の単位（m/s 等）も続けて畳む
    }
    return v;
  }
  // 単位式：単位の原子を * / でつないだもの（数は挟まない）。MB/s・時間/日・kg·m/s²…
  unitExpr() { return this.unitExprFrom(this.unitAtom()); }
  unitExprFrom(v) {
    for (;;) {
      const p = this.peek(), q = this.toks[this.i + 1];
      if (p && p.t === 'op' && (p.v === '*' || p.v === '/') && this.isUnitTok(q)) {
        this.next(); const a = this.unitAtom();
        v = p.v === '/' ? V.div(v, a) : V.mul(v, a);
      } else break;
    }
    return v;
  }
  // 単位の原子：単位ひとつ＋（あれば）整数の指数。^ は単位ひとつだけに掛かる。
  unitAtom() {
    let a = V.unitValue(this.next().v);
    const p = this.peek(), q = this.toks[this.i + 1];
    if (p && p.t === 'op' && p.v === '^' && q && q.t === 'num' && Number.isInteger(q.v)) {
      this.next(); this.next(); a = V.pow(a, V.scalar(q.v));
    }
    return a;
  }
  primary() {
    const k = this.next();
    if (!k) throw new CalcError('式が足りません');
    if (k.t === 'num') return { ...V.scalar(k.v), _rawNumber: true, pct: k.pct };
    if (k.t === 'lp') { const v = this.conversion(); this.expect('rp'); return v; }
    if (k.t === 'id') {
      const name = k.v;
      // 通貨記号の前置（$100, ¥500）
      if (V.isCurrency(name) && this.peek() && this.peek().t === 'num') {
        const num = this.next();
        return V.quantity(num.v, name);
      }
      // 関数
      if (FUNCS[name] && this.peek() && this.peek().t === 'lp') {
        this.next(); const args = [];
        if (this.peek() && this.peek().t !== 'rp') {
          args.push(this.conversion());
          while (this.peek() && this.peek().t === 'comma') { this.next(); args.push(this.conversion()); }
        }
        this.expect('rp');
        if (name === 'min' || true) { /* min はここでは関数 */ }
        return FUNCS[name](args);
      }
      // 前行参照
      if (name === 'prev' || name === 'ans') return this.env.prev();
      if (name === 'sum' || name === 'total') return this.env.sumAbove();
      if (name === 'line') { const num = this.expect('num'); return this.env.line(num.v); }
      // 単位そのもの（km, h …）。後続の /s などを畳めるよう印をつける。
      if (V.isUnit(name)) return { ...V.unitValue(name), _bareUnit: true };
      // 変数
      return this.env.getVar(name);
    }
    throw new CalcError('読めない記号です');
  }
}

/* ---------------- ノート全体を走らせる ---------------- */
function stripComment(line) {
  // 末尾コメント // … と、行頭 # / //
  const t = line.replace(/\s*\/\/.*$/, '').replace(/\s+#.*$/, '');
  return t;
}

export function run(notebook) {
  const lines = String(notebook).replace(/\r\n?/g, '\n').split('\n');
  const vars = new Map();
  const results = [];       // 各行 { value|null, kind }
  const out = [];

  const env = {
    hasVar(name) { return vars.has(name); },
    getVar(name) { if (!vars.has(name)) throw new CalcError(`知らない名前: ${name}`); return vars.get(name); },
    prev() { for (let i = results.length - 1; i >= 0; i--) if (results[i].value) return results[i].value; throw new CalcError('前の答えがありません'); },
    line(n) { const r = results[n - 1]; if (!r || !r.value) throw new CalcError(`${n} 行目に答えがありません`); return r.value; },
    sumAbove() {
      let s = null;
      for (let i = results.length - 1; i >= 0; i--) {
        const r = results[i];
        if (r.kind === 'blank' || r.kind === 'label') break;     // かたまりの切れ目で止まる
        if (!r.value) continue;
        s = s === null ? r.value : V.add(r.value, s);
      }
      if (s === null) throw new CalcError('合算する数が上にありません');
      return s;
    },
  };

  for (const raw of lines) {
    const lineNo = results.length;
    const trimmedRaw = raw.trim();
    if (trimmedRaw === '' || trimmedRaw === '#') { results.push({ value: null, kind: 'blank' }); out.push({ input: raw, result: null, error: null, kind: 'blank' }); continue; }
    if (/^(#|\/\/)/.test(trimmedRaw)) { results.push({ value: null, kind: 'label' }); out.push({ input: raw, result: null, error: null, kind: 'comment' }); continue; }

    const body = stripComment(raw).trim();
    if (body === '') { results.push({ value: null, kind: 'label' }); out.push({ input: raw, result: null, error: null, kind: 'comment' }); continue; }

    // 代入？  名前 = 式
    let name = null, exprToks;
    const toks = tokenize(body);
    if (toks.length >= 2 && toks[0].t === 'id' && toks[1].t === 'eq' && !V.isUnit(toks[0].v) && !RESERVED.has(toks[0].v)) {
      name = toks[0].v; exprToks = toks.slice(2);
    } else { exprToks = toks; }

    if (exprToks.length === 0) { results.push({ value: null, kind: 'label' }); out.push({ input: raw, result: null, error: null, kind: 'comment' }); continue; }

    try {
      const value = new Parser(exprToks, env).parse();
      if (name) vars.set(name, value);
      results.push({ value, kind: 'value' });
      out.push({ input: raw, result: V.format(value), error: null, kind: name ? 'assign' : 'value', name });
    } catch (e) {
      if (!(e instanceof CalcError)) throw e;
      // 「計算らしさ」がなければ、ただの散文／見出しとみなして黙る。
      // 計算らしさ＝代入・演算子・既知の変数や参照語を含むこと。
      const hasNum = exprToks.some((tk) => tk.t === 'num');
      const hasOp = exprToks.some((tk) => tk.t === 'op');
      const hasUnitOrConv = exprToks.some((tk) => tk.t === 'id' &&
        (V.isUnit(tk.v) || ['in', 'to', 'as', 'per', 'of'].includes(tk.v)));
      const hasRefOrVar = exprToks.some((tk) => tk.t === 'id' && !V.isUnit(tk.v) &&
        (vars.has(tk.v) || ['prev', 'sum', 'total', 'ans', 'line'].includes(tk.v)));
      const looksCalc = name !== null || hasOp || hasRefOrVar || (hasNum && hasUnitOrConv);
      if (looksCalc) { results.push({ value: null, kind: 'error' }); out.push({ input: raw, result: null, error: e.message, kind: 'error' }); }
      else { results.push({ value: null, kind: 'label' }); out.push({ input: raw, result: null, error: null, kind: 'label' }); }
    }
  }
  return out;
}

const RESERVED = new Set(['prev', 'ans', 'sum', 'total', 'line', 'per', 'of', 'in', 'to', 'as', ...Object.keys(FUNCS)]);

export { tokenize };
