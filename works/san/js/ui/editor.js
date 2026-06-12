/* ============================================================
   紙 — 依存ゼロの小さなエディタ。

   透明な textarea の後ろに、色を塗った pre を敷く。
   左の樋（ガター）は行番号と、誤りの赤と、中断点の点と、
   いま機械が立っている行の灯り。
   ============================================================ */

import { MNEMONICS } from '../core/asm.js';

const LH = 19;    // 1 行の高さ（px）。style.css の --ed-lh と揃える
const PAD = 8;    // 上の余白（px）。.ed-hl / .ed-ta の padding-top と揃える

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ----- アセンブリの色 -----
   コメント / 文字列 / 数 / レジスタ / 指示 / ラベル / ニーモニック */
const ASM_RE = /(;.*)|("(?:\\.|[^"\\])*"?)|('(?:\\.|[^'\\])'?)|(-?(?:0x[0-9a-fA-F]+|0b[01]+|\d+)\b)|([rR][0-7]\b)|(\.[a-zA-Z]+)|([^\s:,;[\]"']+(?=:))|([a-zA-Z]+)|([\s\S])/y;

function paintAsm(line) {
  ASM_RE.lastIndex = 0;
  let out = '', m;
  while (ASM_RE.lastIndex < line.length && (m = ASM_RE.exec(line))) {
    const t = m[0];
    let cls = null;
    if (m[1]) cls = 'com';
    else if (m[2] || m[3]) cls = 'str';
    else if (m[4]) cls = 'num';
    else if (m[5]) cls = 'reg';
    else if (m[6]) cls = 'dir';
    else if (m[7]) cls = 'lab';
    else if (m[8] && MNEMONICS[t.toUpperCase()]) cls = 'mn';
    out += cls ? `<span class="tk-${cls}">${esc(t)}</span>` : esc(t);
  }
  return out;
}

/* ----- 珠の色 ----- */
const TAMA_KW = new Set([
  '変数', '配列', '関数', 'もし', 'なら', 'ちがえば', 'あいだ',
  'かぞえ', 'から', 'くりかえし', 'ぬける', 'つづける', 'かえす',
]);
const TAMA_FN = new Set([
  '点', '色', '塗る', '見せる', 'ボタン', '押した', '乱数', '種',
  'フレーム', '鍵', '文字', '表示', '音', 'おく', 'みる', '止まる',
]);
const IDENT = 'A-Za-z_\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uFF66-\\uFF9F';
const TAMA_RE = new RegExp(
  `((?:※|#).*)|('(?:\\\\.|[^'\\\\])'?)|(0x[0-9a-fA-F]+|0b[01]+|\\d+)|([${IDENT}][${IDENT}0-9]*)|([\\s\\S])`,
  'y');

function paintTama(line) {
  TAMA_RE.lastIndex = 0;
  let out = '', m;
  while (TAMA_RE.lastIndex < line.length && (m = TAMA_RE.exec(line))) {
    const t = m[0];
    let cls = null;
    if (m[1]) cls = 'com';
    else if (m[2]) cls = 'str';
    else if (m[3]) cls = 'num';
    else if (m[4]) cls = TAMA_KW.has(t) ? 'kw' : TAMA_FN.has(t) ? 'fn' : null;
    out += cls ? `<span class="tk-${cls}">${esc(t)}</span>` : esc(t);
  }
  return out;
}

/* ============================================================
   createEditor(root, hooks)
   hooks: { onChange(), onBreakToggle(line) }
   ============================================================ */
export function createEditor(root, hooks = {}) {
  root.classList.add('ed');
  root.innerHTML =
    '<div class="ed-gutter"></div>' +
    '<div class="ed-body">' +
    '<pre class="ed-hl" aria-hidden="true"><div class="ed-cur" hidden></div><code class="ed-code"></code></pre>' +
    '<textarea class="ed-ta" wrap="off" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="ソース"></textarea>' +
    '</div>';
  const gutter = root.querySelector('.ed-gutter');
  const hl = root.querySelector('.ed-hl');
  const code = root.querySelector('.ed-code');
  const cur = root.querySelector('.ed-cur');
  const ta = root.querySelector('.ed-ta');

  let lang = 'asm';
  let errs = new Map();   // 行 → 文言
  let bps = new Set();    // 中断点の行
  let curLine = 0;        // 機械が立っている行。0 = 消灯
  let lineCount = 1;

  function paint() {
    const lines = ta.value.split('\n');
    lineCount = lines.length;
    const f = lang === 'tama' ? paintTama : paintAsm;
    code.innerHTML = lines.map(l => f(l) + '\n').join('');
    paintGutter();
  }

  function paintGutter() {
    let out = '';
    for (let i = 1; i <= lineCount; i++) {
      let cls = 'ed-ln';
      if (bps.has(i)) cls += ' bp';
      if (errs.has(i)) cls += ' err';
      if (i === curLine) cls += ' cur';
      const msg = errs.get(i);
      out += `<div class="${cls}" data-line="${i}"${msg ? ` title="${esc(msg)}"` : ''}>${i}</div>`;
    }
    gutter.innerHTML = out;
    gutter.scrollTop = ta.scrollTop;
  }

  function placeCur() {
    if (!curLine) { cur.hidden = true; return; }
    cur.hidden = false;
    cur.style.top = PAD + (curLine - 1) * LH + 'px';
  }

  function syncScroll() {
    hl.scrollTop = ta.scrollTop;
    hl.scrollLeft = ta.scrollLeft;
    gutter.scrollTop = ta.scrollTop;
  }

  function reveal(line) {
    const y = PAD + (line - 1) * LH;
    if (y < ta.scrollTop + LH || y > ta.scrollTop + ta.clientHeight - LH * 2) {
      ta.scrollTop = Math.max(0, y - ta.clientHeight / 2);
    }
    syncScroll();
  }

  ta.addEventListener('input', () => { paint(); hooks.onChange?.(); });
  ta.addEventListener('scroll', syncScroll);
  ta.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    let done = false;
    try { done = document.execCommand('insertText', false, '  '); } catch { /* 古い紙 */ }
    if (!done) {
      ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
      paint();
      hooks.onChange?.();
    }
  });
  gutter.addEventListener('click', e => {
    const ln = e.target.closest('.ed-ln');
    if (ln) hooks.onBreakToggle?.(Number(ln.dataset.line));
  });

  paint();

  return {
    getValue: () => ta.value,
    setValue(v) {
      ta.value = v;
      ta.scrollTop = 0; ta.scrollLeft = 0;
      paint(); placeCur(); syncScroll();
    },
    setLang(l) { lang = l === 'tama' ? 'tama' : 'asm'; paint(); },
    /* errors: [{line, msg}] */
    setErrors(errors) {
      errs = new Map((errors ?? []).map(e => [e.line, e.msg]));
      paintGutter();
    },
    setBreakpoints(lines) { bps = new Set(lines); paintGutter(); },
    /* 機械の立っている行に灯りを。null で消灯 */
    setCurrentLine(line) {
      curLine = line || 0;
      paintGutter(); placeCur();
      if (curLine) reveal(curLine);
    },
    scrollToLine(line) { reveal(line); },
    focus() { ta.focus(); },
  };
}
