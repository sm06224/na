/* ============================================================
   アセンブラ — 人の書いた紙を、機械の言葉に写す。

   2 パス。1 周目でラベルの住所を決め、2 周目で語を置く。
   書き方は HARDWARE.md の §5。誤りは行番号つきの日本語で返す。
   逆アセンブラ（デバッガの目）も、ここに同居している。
   ============================================================ */

import { OP, ENTRY } from './vm.js';

/* ニーモニック → { op, sig }
   sig: '' なし / 'a' レジスタ / 'ab' レジスタ2つ / 'ai' レジスタ+即値
        'i' 即値 / 'ld' a,[b+imm] / 'st' [a+imm],b               */
export const MNEMONICS = {
  NOP: { op: OP.NOP, sig: '' }, HLT: { op: OP.HLT, sig: '' },
  MOV: { op: OP.MOV, sig: 'ab' }, LDI: { op: OP.LDI, sig: 'ai' },
  LD: { op: OP.LD, sig: 'ld' }, ST: { op: OP.ST, sig: 'st' },
  PUSH: { op: OP.PUSH, sig: 'a' }, POP: { op: OP.POP, sig: 'a' },
  ADD: { op: OP.ADD, sig: 'ab' }, SUB: { op: OP.SUB, sig: 'ab' },
  MUL: { op: OP.MUL, sig: 'ab' }, DIV: { op: OP.DIV, sig: 'ab' },
  MOD: { op: OP.MOD, sig: 'ab' }, AND: { op: OP.AND, sig: 'ab' },
  OR: { op: OP.OR, sig: 'ab' }, XOR: { op: OP.XOR, sig: 'ab' },
  NOT: { op: OP.NOT, sig: 'a' }, SHL: { op: OP.SHL, sig: 'ab' },
  SHR: { op: OP.SHR, sig: 'ab' },
  ADDI: { op: OP.ADDI, sig: 'ai' }, SUBI: { op: OP.SUBI, sig: 'ai' },
  CMP: { op: OP.CMP, sig: 'ab' }, CMPI: { op: OP.CMPI, sig: 'ai' },
  JMP: { op: OP.JMP, sig: 'i' }, JZ: { op: OP.JZ, sig: 'i' },
  JNZ: { op: OP.JNZ, sig: 'i' }, JLT: { op: OP.JLT, sig: 'i' },
  JLE: { op: OP.JLE, sig: 'i' }, JGT: { op: OP.JGT, sig: 'i' },
  JGE: { op: OP.JGE, sig: 'i' }, CALL: { op: OP.CALL, sig: 'i' },
  RET: { op: OP.RET, sig: '' },
  JMPR: { op: OP.JMPR, sig: 'a' }, CALLR: { op: OP.CALLR, sig: 'a' },
};

const OP_TO_NAME = Object.fromEntries(
  Object.entries(MNEMONICS).map(([name, m]) => [m.op, name]));

/* ----- 字句のこまごま ----- */

/* 引用符の中を尊重しつつコメントを落とす */
function stripComment(line) {
  let inStr = false, inChar = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (inChar) {
      if (c === '\\') i++;
      else if (c === "'") inChar = false;
    } else if (c === '"') inStr = true;
    else if (c === "'") inChar = true;
    else if (c === ';') return line.slice(0, i);
  }
  return line;
}

const REG_RE = /^[rR]([0-7])$/;
const NAME_RE = /^[^\s\d"'[\],;+\-:.][^\s"'[\],;+\-:]*$/u;

function parseNumber(t) {
  let neg = false, s = t;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  let v = null;
  if (/^0x[0-9a-fA-F]+$/.test(s)) v = parseInt(s, 16);
  else if (/^0b[01]+$/.test(s)) v = parseInt(s.slice(2), 2);
  else if (/^\d+$/.test(s)) v = parseInt(s, 10);
  else if (/^'(\\.|[^\\'])'$/u.test(s)) {
    const body = s.slice(1, -1);
    const ch = body[0] === '\\'
      ? ({ n: '\n', t: '\t', '0': '\0', '\\': '\\', "'": "'" }[body[1]] ?? body[1])
      : body;
    v = ch.charCodeAt(0);
  }
  if (v === null) return null;
  if (neg) v = -v;
  if (v < -32768 || v > 0xFFFF) return { err: `16bit に入らない数です: ${t}` };
  return { value: v & 0xFFFF };
}

function parseString(t) {
  if (!/^".*"$/s.test(t)) return null;
  const out = [];
  const body = t.slice(1, -1);
  for (let i = 0; i < body.length; i++) {
    let c = body[i];
    if (c === '\\') {
      i++;
      c = { n: '\n', t: '\t', '0': '\0', '\\': '\\', '"': '"' }[body[i]] ?? body[i];
    }
    out.push(c.charCodeAt(0));
  }
  return out;
}

/* 即値：数 / 名前 / 名前+数 / 名前-数。名前の解決は 2 周目 */
function parseImm(t) {
  const num = parseNumber(t);
  if (num) return num.err ? { err: num.err } : { value: num.value };
  const m = t.match(/^(.+?)([+-])(\d+|0x[0-9a-fA-F]+)$/);
  if (m && NAME_RE.test(m[1])) {
    return { symbol: m[1], offset: (m[2] === '-' ? -1 : 1) * parseInt(m[3], m[3].startsWith('0x') ? 16 : 10) };
  }
  if (NAME_RE.test(t)) return { symbol: t, offset: 0 };
  return { err: `即値が読めません: ${t}` };
}

/* [reg]、[reg+imm]、[reg-imm] */
function parseMem(t) {
  const m = t.match(/^\[\s*([rR][0-7])\s*(?:([+-])\s*(.+?))?\s*\]$/);
  if (!m) return { err: `番地指定が読めません: ${t}（[r0+定数] の形）` };
  const reg = Number(m[1].slice(1));
  if (!m[2]) return { reg, imm: { value: 0 } };
  const imm = parseImm(m[3]);
  if (imm.err) return { err: imm.err };
  if (m[2] === '-') {
    if (imm.symbol !== undefined) return { err: 'ラベルの引き算は番地指定では使えません' };
    imm.value = (-imm.value) & 0xFFFF;
  }
  return { reg, imm };
}

/* 行を「ラベルたち + 命令ひとつ」に割る */
function splitLine(raw) {
  let rest = stripComment(raw).trim();
  const labels = [];
  for (;;) {
    const m = rest.match(/^([^\s:"';,[\]]+):\s*/u);
    if (!m) break;
    labels.push(m[1]);
    rest = rest.slice(m[0].length);
  }
  return { labels, rest };
}

/* オペランド列をカンマで割る（引用符と [ ] を尊重） */
function splitOperands(s) {
  const out = [];
  let depth = 0, inStr = false, inChar = false, cur = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) { cur += c; if (c === '\\') { cur += s[++i] ?? ''; } else if (c === '"') inStr = false; continue; }
    if (inChar) { cur += c; if (c === '\\') { cur += s[++i] ?? ''; } else if (c === "'") inChar = false; continue; }
    if (c === '"') { inStr = true; cur += c; continue; }
    if (c === "'") { inChar = true; cur += c; continue; }
    if (c === '[') depth++;
    if (c === ']') depth--;
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim() !== '' || out.length) out.push(cur.trim());
  return out;
}

/* ============================================================
   本体。assemble(src) →
   { ok, errors:[{line,msg}], words:Uint16Array, origin, labels:Map,
     lineOf: (addr) => 行番号（デバッガがソースに灯りを点すため） }
   ============================================================ */
export function assemble(src) {
  const lines = src.split('\n');
  const errors = [];
  const symbols = new Map();
  const items = [];        // { line, kind, ... } 置くものの並び
  let origin = ENTRY, originSet = false, sawCode = false;

  const err = (line, msg) => errors.push({ line, msg });

  /* ----- 1 周目：寸法とラベル ----- */
  let addr = null;   // origin が決まってから数える
  const pending = [];
  for (let li = 0; li < lines.length; li++) {
    const no = li + 1;
    const { labels, rest } = splitLine(lines[li]);
    for (const l of labels) pending.push({ name: l, line: no });
    if (rest === '') continue;

    const sp = rest.search(/\s/);
    const head = (sp < 0 ? rest : rest.slice(0, sp));
    const tail = sp < 0 ? '' : rest.slice(sp + 1).trim();
    const headUp = head.toUpperCase();

    let size = 0, item = null;

    if (head.startsWith('.')) {
      const d = head.toLowerCase();
      if (d === '.org') {
        const v = parseNumber(tail);
        if (!v || v.err) { err(no, v?.err ?? `.org の番地が読めません: ${tail}`); continue; }
        if (sawCode) { err(no, '.org は何かを置く前に、一度だけ'); continue; }
        if (originSet) { err(no, '.org が二度あります'); continue; }
        origin = v.value; originSet = true;
        continue;
      }
      if (d === '.const') {
        const ops = splitOperands(tail);
        if (ops.length !== 2 || !NAME_RE.test(ops[0])) { err(no, '.const 名前, 値'); continue; }
        const v = parseNumber(ops[1]);
        if (!v || v.err) { err(no, v?.err ?? `定数の値が読めません: ${ops[1]}`); continue; }
        if (symbols.has(ops[0])) { err(no, `名前がぶつかりました: ${ops[0]}`); continue; }
        symbols.set(ops[0], v.value);
        continue;
      }
      if (d === '.word') {
        const ops = splitOperands(tail);
        if (!ops.length) { err(no, '.word には少なくともひとつの値を'); continue; }
        item = { line: no, kind: 'word', ops };
        size = ops.length;
      } else if (d === '.ascii') {
        const s = parseString(tail);
        if (!s) { err(no, '.ascii "文字列"'); continue; }
        item = { line: no, kind: 'data', data: s };
        size = s.length;
      } else if (d === '.space') {
        const v = parseNumber(tail);
        if (!v || v.err || v.value === 0) { err(no, '.space 個数'); continue; }
        item = { line: no, kind: 'data', data: new Array(v.value).fill(0) };
        size = v.value;
      } else {
        err(no, `知らない指示です: ${head}`);
        continue;
      }
    } else if (MNEMONICS[headUp]) {
      item = { line: no, kind: 'ins', name: headUp, ops: splitOperands(tail) };
      size = 2;
    } else {
      err(no, `知らない命令です: ${head}`);
      continue;
    }

    sawCode = true;
    if (addr === null) addr = origin;
    for (const p of pending.splice(0)) {
      if (symbols.has(p.name)) err(p.line, `名前がぶつかりました: ${p.name}`);
      else symbols.set(p.name, addr);
    }
    item.addr = addr;
    items.push(item);
    addr += size;
    if (addr > 0x10000) { err(no, 'メモリからはみ出しました'); break; }
  }
  for (const p of pending) {
    if (symbols.has(p.name)) err(p.line, `名前がぶつかりました: ${p.name}`);
    else symbols.set(p.name, addr ?? origin);
  }

  /* ----- 2 周目：語を置く ----- */
  const total = (addr ?? origin) - origin;
  const words = new Uint16Array(Math.max(0, total));
  const lineByAddr = new Map();

  const resolve = (no, imm) => {
    if (imm.err) { err(no, imm.err); return 0; }
    if (imm.symbol === undefined) return imm.value;
    if (!symbols.has(imm.symbol)) { err(no, `知らない名前です: ${imm.symbol}`); return 0; }
    return (symbols.get(imm.symbol) + imm.offset) & 0xFFFF;
  };
  const wantReg = (no, t) => {
    const m = (t ?? '').match(REG_RE);
    if (!m) { err(no, `レジスタが要ります（r0–r7）: ${t ?? '何もない'}`); return 0; }
    return Number(m[1]);
  };

  for (const it of items) {
    const at = it.addr - origin;
    lineByAddr.set(it.addr, it.line);
    if (it.kind === 'word') {
      it.ops.forEach((t, i) => { words[at + i] = resolve(it.line, parseImm(t)); });
      continue;
    }
    if (it.kind === 'data') {
      it.data.forEach((v, i) => { words[at + i] = v & 0xFFFF; });
      continue;
    }
    const { op, sig } = MNEMONICS[it.name];
    const need = { '': 0, a: 1, ab: 2, ai: 2, i: 1, ld: 2, st: 2 }[sig];
    if (it.ops.length !== need) {
      err(it.line, `${it.name} の引数は ${need} 個です（${it.ops.length} 個ある）`);
      continue;
    }
    let a = 0, b = 0, imm = 0;
    if (sig === 'a') a = wantReg(it.line, it.ops[0]);
    else if (sig === 'ab') { a = wantReg(it.line, it.ops[0]); b = wantReg(it.line, it.ops[1]); }
    else if (sig === 'ai') { a = wantReg(it.line, it.ops[0]); imm = resolve(it.line, parseImm(it.ops[1])); }
    else if (sig === 'i') imm = resolve(it.line, parseImm(it.ops[0]));
    else if (sig === 'ld') {
      a = wantReg(it.line, it.ops[0]);
      const mem = parseMem(it.ops[1]);
      if (mem.err) { err(it.line, mem.err); continue; }
      b = mem.reg; imm = resolve(it.line, mem.imm);
    } else if (sig === 'st') {
      const mem = parseMem(it.ops[0]);
      if (mem.err) { err(it.line, mem.err); continue; }
      a = mem.reg; b = wantReg(it.line, it.ops[1]);
      imm = resolve(it.line, mem.imm);
    }
    words[at] = (op << 8) | (a << 4) | b;
    words[at + 1] = imm;
  }

  return {
    ok: errors.length === 0,
    errors,
    words,
    origin,
    labels: symbols,
    lineOf: a => lineByAddr.get(a),
  };
}

/* ----- 逆アセンブル：デバッガの目 ----- */
export function disasm(w0, imm) {
  const op = w0 >> 8, a = (w0 >> 4) & 0xF, b = w0 & 0xF;
  const name = OP_TO_NAME[op];
  if (!name) return `??? 0x${w0.toString(16).padStart(4, '0')}`;
  const hex = v => `0x${v.toString(16).toUpperCase().padStart(4, '0')}`;
  switch (MNEMONICS[name].sig) {
    case '': return name;
    case 'a': return `${name} r${a}`;
    case 'ab': return `${name} r${a}, r${b}`;
    case 'ai': return `${name} r${a}, ${hex(imm)}`;
    case 'i': return `${name} ${hex(imm)}`;
    case 'ld': return `${name} r${a}, [r${b}${imm ? '+' + hex(imm) : ''}]`;
    case 'st': return `${name} [r${a}${imm ? '+' + hex(imm) : ''}], r${b}`;
  }
}
