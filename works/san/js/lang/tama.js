/* ============================================================
   珠 — そろばんの珠から名を取った、算の高級言語。

   日本語の予約語で書かれた文を、字句（lexer）→ 構文（parser）→
   写し（codegen）の順に下ろし、core/asm.js のアセンブラで語に
   する。仕様のすべては LANGUAGE.md にある。ここはその入口。

   compile(src) -> {
     ok, errors: [{ line, msg }],   誤りは日本語・行番号つき
     asm,                           吐いたアセンブリ
     words, origin,                 機械に据える語の列
     lineOf: (addr) => line,        機械語の番地 → 珠の行（デバッガの灯り）
   }
   ============================================================ */

import { tokenize } from './lexer.js';
import { parse } from './parser.js';
import { generate } from './codegen.js';
import { assemble } from '../core/asm.js';
import { ENTRY } from '../core/vm.js';

const NO_LINE = () => undefined;

function fail(errors) {
  return {
    ok: false,
    errors,
    asm: '',
    words: new Uint16Array(0),
    origin: ENTRY,
    lineOf: NO_LINE,
  };
}

export function compile(src) {
  /* 字句と構文。粒に割れなければ先へは行かない */
  const lex = tokenize(String(src ?? ''));
  const tree = parse(lex.tokens);
  const early = [...lex.errors, ...tree.errors];
  if (early.length) return fail(early.sort((a, b) => a.line - b.line));

  /* 写し。名前や数の誤りはここで全部拾う */
  const gen = generate(tree);
  if (gen.errors.length) return fail(gen.errors.sort((a, b) => a.line - b.line));

  /* 語にする。ここで転ぶのは写し手（コンパイラ）の落ち度 */
  const out = assemble(gen.asm);
  if (!out.ok) {
    return fail(out.errors.map(e =>
      ({ line: 0, msg: `写しの内部の誤り（アセンブリ ${e.line} 行目）: ${e.msg}` })));
  }

  /* 目印から、番地 → 珠の行 の対応を引けるように */
  const marks = gen.markers;                       // addr 昇順
  const end = out.origin + out.words.length;
  const lineOf = (addr) => {
    if (!marks.length || addr < out.origin || addr >= end) return undefined;
    let lo = 0, hi = marks.length - 1, best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (marks[mid].addr <= addr) { best = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    while (best + 1 < marks.length && marks[best + 1].addr === marks[best].addr) best++;
    return marks[best].line;
  };

  return { ok: true, errors: [], asm: gen.asm, words: out.words, origin: out.origin, lineOf };
}
