/* ============================================================
   字句 — 珠の文を、粒に割る。

   そろばんを弾く前に、まず珠を盤に並べる。ここでは源泉の
   文字列を、数・名前・予約語・記号・改行の列にする。
   改行は文の切れ目なので、空白と違って捨てずに残す。
   誤りはすべて行番号つきの日本語で返す。
   ============================================================ */

/* 言語の予約語。これだけが文のかたちを決める */
export const KEYWORDS = new Set([
  '変数', '配列', '関数',
  'もし', 'なら', 'ちがえば',
  'あいだ', 'かぞえ', 'から', 'くりかえし',
  'ぬける', 'つづける', 'かえす',
]);

const ID_START = /[\p{L}_]/u;
const ID_CONT = /[\p{L}\p{N}_]/u;

/* 二文字の演算子は一文字より先に切り出す */
const OPS2 = ['<<', '>>', '<=', '>=', '==', '!=', '&&', '||'];
const OPS1 = new Set([...'+-*/%()<>=!&|^{}[],']);

const ESC = { n: '\n', t: '\t', '0': '\0', '\\': '\\', "'": "'" };

/* tokenize(src) -> { tokens, errors }
   token = { type: 'num'|'id'|'kw'|'op'|'nl'|'eof', value, line } */
export function tokenize(src) {
  const tokens = [];
  const errors = [];
  let line = 1, i = 0;
  const n = src.length;
  const push = (type, value) => tokens.push({ type, value, line });
  const err = (msg) => errors.push({ line, msg });

  while (i < n) {
    const c = src[i];

    if (c === '\n') { push('nl', '\n'); line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { i++; continue; }
    if (c === '※' || c === '#') {                     // コメントは行末まで
      while (i < n && src[i] !== '\n') i++;
      continue;
    }

    if (c === "'") {                                   // 文字 → 符号単位
      let j = i + 1, ch;
      if (src[j] === '\\') { ch = ESC[src[j + 1]] ?? src[j + 1]; j += 2; }
      else { ch = src[j]; j += 1; }
      if (ch === undefined || src[j] !== "'") {
        err("文字の書き方が崩れています（'あ' の形で）");
        i++;
        continue;
      }
      push('num', ch.charCodeAt(0));
      i = j + 1;
      continue;
    }

    if (/[0-9]/.test(c)) {                             // 数
      const m = /^(0x[0-9a-fA-F]+|0b[01]+|[0-9]+)/.exec(src.slice(i));
      const t = m[1];
      const after = src[i + t.length];
      if (after !== undefined && ID_CONT.test(after)) {
        err(`数が読めません: ${t}${after}…`);
        i += t.length + 1;
        continue;
      }
      const v = t.startsWith('0x') ? parseInt(t, 16)
        : t.startsWith('0b') ? parseInt(t.slice(2), 2)
        : parseInt(t, 10);
      if (v > 0xFFFF) {
        err(`16bit に入らない数です: ${t}`);
        i += t.length;
        continue;
      }
      push('num', v);
      i += t.length;
      continue;
    }

    const two = src.slice(i, i + 2);
    if (OPS2.includes(two)) { push('op', two); i += 2; continue; }
    if (OPS1.has(c)) { push('op', c); i++; continue; }

    if (ID_START.test(c)) {                            // 名前か予約語
      let j = i + 1;
      while (j < n && ID_CONT.test(src[j])) j++;
      const word = src.slice(i, j);
      push(KEYWORDS.has(word) ? 'kw' : 'id', word);
      i = j;
      continue;
    }

    err(`読めない文字です: ${c}`);
    i++;
  }

  push('eof', '');
  return { tokens, errors };
}
