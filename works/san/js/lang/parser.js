/* ============================================================
   構文 — 珠の粒を、枝のある木に組む。

   下りの再帰でひとつずつ。文は改行で切れ、塊は { } で括る。
   優先順位は LANGUAGE.md §1 の表のとおり、低い段から高い段へ
   降りていく。誤りを見つけたら行番号を添えて記し、次の改行か
   } まで読み飛ばして続きを読む——一度の誤りで全部を諦めない。
   ============================================================ */

/* parse(tokens) -> { body, errors }
   文のかたち：
     { t:'var',    name, init }            変数 x = 式
     { t:'arr',    name, size }            配列 a[n]（大域のみ）
     { t:'func',   name, params, body }    関数 f(a, b) { … }
     { t:'assign', name, expr }            x = 式
     { t:'astore', name, idx, expr }       a[式] = 式
     { t:'if',     cond, then, else_ }     もし〜なら〜ちがえば
     { t:'while',  cond, body }            あいだ
     { t:'for',    name, from, to, body }  かぞえ（両端を含む）
     { t:'loop',   body }                  くりかえし
     { t:'break' } { t:'cont' }            ぬける・つづける
     { t:'ret',    expr }                  かえす（expr は null 可）
     { t:'expr',   expr }                  呼び出しの文
   式のかたち：
     { t:'num', v } { t:'var', name } { t:'index', name, idx }
     { t:'call', name, args } { t:'un', op, e } { t:'bin', op, l, r }
   すべての節に line がつく。 */

const BIN_LEVELS = [
  ['||'], ['&&'], ['|'], ['^'], ['&'],
  ['==', '!='], ['<', '<=', '>', '>='],
  ['<<', '>>'], ['+', '-'], ['*', '/', '%'],
];

export function parse(tokens) {
  let p = 0;
  const errors = [];

  const peek = (k = 0) => tokens[Math.min(p + k, tokens.length - 1)];
  const at = (type, value) => {
    const t = peek();
    return t.type === type && (value === undefined || t.value === value);
  };
  const next = () => tokens[p++];
  const err = (line, msg) => errors.push({ line, msg });

  /* 改行か } か終端まで読み飛ばす（誤りからの立ち直り） */
  const sync = () => {
    while (!at('nl') && !at('op', '}') && !at('eof')) p++;
  };
  const skipNl = () => { while (at('nl')) p++; };

  const expectOp = (v, what) => {
    if (at('op', v)) { next(); return true; }
    err(peek().line, `構文が崩れています: ${what}（「${v}」が要ります）`);
    return false;
  };

  const expectName = (what) => {
    if (at('id')) return next().value;
    if (at('kw')) {
      err(peek().line, `予約語はここでは使えません: 「${peek().value}」`);
      next();
      return null;
    }
    err(peek().line, `構文が崩れています: ${what}の名前が要ります`);
    return null;
  };

  /* ----- 式 ----- */

  function parsePrimary() {
    const t = peek();
    if (t.type === 'num') { next(); return { t: 'num', v: t.value, line: t.line }; }
    if (t.type === 'op' && t.value === '(') {
      next();
      const e = parseExpr();
      expectOp(')', '括弧');
      return e;
    }
    if (t.type === 'id') {
      next();
      if (at('op', '(')) {
        next();
        const args = [];
        if (!at('op', ')')) {
          for (;;) {
            args.push(parseExpr());
            if (at('op', ',')) { next(); continue; }
            break;
          }
        }
        expectOp(')', '呼び出し');
        return { t: 'call', name: t.value, args, line: t.line };
      }
      if (at('op', '[')) {
        next();
        const idx = parseExpr();
        expectOp(']', '添字');
        return { t: 'index', name: t.value, idx, line: t.line };
      }
      return { t: 'var', name: t.value, line: t.line };
    }
    if (t.type === 'kw') {
      err(t.line, `予約語はここでは使えません: 「${t.value}」`);
    } else {
      err(t.line, `構文が崩れています: 式が読めません（${t.type === 'eof' ? '文の途中で終わっている' : `「${t.value}」`}）`);
    }
    if (!at('nl') && !at('eof')) next();
    return { t: 'num', v: 0, line: t.line };
  }

  function parseUnary() {
    const t = peek();
    if (t.type === 'op' && (t.value === '!' || t.value === '-')) {
      next();
      return { t: 'un', op: t.value, e: parseUnary(), line: t.line };
    }
    return parsePrimary();
  }

  function parseBin(level) {
    if (level >= BIN_LEVELS.length) return parseUnary();
    let l = parseBin(level + 1);
    while (at('op') && BIN_LEVELS[level].includes(peek().value)) {
      const op = next();
      const r = parseBin(level + 1);
      l = { t: 'bin', op: op.value, l, r, line: op.line };
    }
    return l;
  }

  const parseExpr = () => parseBin(0);

  /* ----- 塊と文 ----- */

  function parseBlock(inFunc) {
    skipNl();
    const body = [];
    if (!expectOp('{', '塊のはじめ')) return body;
    for (;;) {
      skipNl();
      if (at('op', '}')) { next(); return body; }
      if (at('eof')) {
        err(peek().line, '構文が崩れています: 閉じる「}」がありません');
        return body;
      }
      const s = parseStatement(inFunc);
      if (s) body.push(s);
      if (!at('nl') && !at('op', '}') && !at('eof')) {
        err(peek().line, `構文が崩れています: 文の後に余計なものがあります（「${peek().value}」）`);
        sync();
      }
    }
  }

  function parseIf(inFunc) {
    const line = next().line;                  // もし
    const cond = parseExpr();
    if (at('kw', 'なら')) next();
    else err(peek().line, '構文が崩れています: 「なら」が要ります');
    const then = parseBlock(inFunc);
    const save = p;
    skipNl();
    let else_ = null;
    if (at('kw', 'ちがえば')) {
      next();
      skipNl();
      else_ = at('kw', 'もし') ? [parseIf(inFunc)] : parseBlock(inFunc);
    } else {
      p = save;                                // 改行は文の切れ目として返す
    }
    return { t: 'if', cond, then, else_, line };
  }

  function parseFunc() {
    const line = next().line;                  // 関数
    const name = expectName('関数');
    expectOp('(', '引数の列');
    const params = [];
    if (!at('op', ')')) {
      for (;;) {
        const pn = expectName('引数');
        if (pn !== null) params.push({ name: pn, line: peek(-1)?.line ?? line });
        if (at('op', ',')) { next(); continue; }
        break;
      }
    }
    expectOp(')', '引数の列');
    const body = parseBlock(true);
    return { t: 'func', name, params, body, line };
  }

  function parseStatement(inFunc) {
    const t = peek();
    const line = t.line;

    if (t.type === 'kw') {
      switch (t.value) {
        case '変数': {
          next();
          const name = expectName('変数');
          expectOp('=', '変数の宣言（初期値は必須）');
          const init = parseExpr();
          return name === null ? null : { t: 'var', name, init, line };
        }
        case '配列': {
          next();
          if (inFunc === true) err(line, '配列は関数の中では作れません（大域のみ）');
          const name = expectName('配列');
          expectOp('[', '配列の大きさ');
          let size = null;
          if (at('num')) size = next().value;
          else err(peek().line, '構文が崩れています: 配列の大きさは数で');
          expectOp(']', '配列の大きさ');
          if (name === null || size === null || inFunc === true) return null;
          return { t: 'arr', name, size, line };
        }
        case '関数': {
          const f = parseFunc();
          if (inFunc !== 'top') {
            err(line, '関数の中で関数は作れません');
            return null;
          }
          return f;
        }
        case 'もし': return parseIf(inFunc === 'top' ? false : inFunc);
        case 'あいだ': {
          next();
          const cond = parseExpr();
          const body = parseBlock(inFunc === 'top' ? false : inFunc);
          return { t: 'while', cond, body, line };
        }
        case 'かぞえ': {
          next();
          const name = expectName('かぞえの変数');
          expectOp('=', 'かぞえ');
          const from = parseExpr();
          if (at('kw', 'から')) next();
          else err(peek().line, '構文が崩れています: 「から」が要ります');
          const to = parseExpr();
          const body = parseBlock(inFunc === 'top' ? false : inFunc);
          return name === null ? null : { t: 'for', name, from, to, body, line };
        }
        case 'くりかえし': {
          next();
          const body = parseBlock(inFunc === 'top' ? false : inFunc);
          return { t: 'loop', body, line };
        }
        case 'ぬける': next(); return { t: 'break', line };
        case 'つづける': next(); return { t: 'cont', line };
        case 'かえす': {
          next();
          const expr = (at('nl') || at('op', '}') || at('eof')) ? null : parseExpr();
          return { t: 'ret', expr, line };
        }
        default:
          err(line, `予約語はここでは使えません: 「${t.value}」`);
          sync();
          return null;
      }
    }

    if (t.type === 'id' && peek(1).type === 'op' && peek(1).value === '=') {
      next(); next();
      const expr = parseExpr();
      return { t: 'assign', name: t.value, expr, line };
    }
    if (t.type === 'id' && peek(1).type === 'op' && peek(1).value === '[') {
      next(); next();
      const idx = parseExpr();
      expectOp(']', '添字');
      if (!expectOp('=', '配列への代入')) { sync(); return null; }
      const expr = parseExpr();
      return { t: 'astore', name: t.value, idx, expr, line };
    }

    const e = parseExpr();
    if (e.t !== 'call') {
      err(line, '構文が崩れています: 文になっていません（代入か呼び出しを）');
      sync();
      return null;
    }
    return { t: 'expr', expr: e, line };
  }

  /* ----- 全体 ----- */

  const body = [];
  skipNl();
  while (!at('eof')) {
    const s = parseStatement('top');
    if (s) body.push(s);
    if (!at('nl') && !at('eof')) {
      err(peek().line, `構文が崩れています: 文の後に余計なものがあります（「${peek().value}」）`);
      sync();
    }
    skipNl();
  }

  return { body, errors };
}
