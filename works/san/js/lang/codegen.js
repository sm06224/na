/* ============================================================
   写し — 珠の木を、算のアセンブリに写す。

   式の値はいつも R0。二項演算は左を弾いて積み、右を弾いて
   下ろし、合わせる。深い式も同じ手つきで正しく重なる。

   呼び出しの作法（この写しの取り決め）：
   - 戻り番地は機械のスタック（SP、0x8000 から下へ）に積まれる。
     式の途中の退避（PUSH/POP）もここ。出入りが釣り合うので
     呼び出しをまたいでも崩れない。
   - 引数と局所は R7 が指す「珠の段」（0x7C00 から下へ）に置く。
     SP は読めない機械なので、読める段をもうひとつ持つ。
     呼ぶ側が引数を左から積み、呼ばれた側が局所のぶん R7 を
     下げる。番地は R7 相対で、写しの時点で深さが決まっている。
   - 引数と返り値の運びは R0–R3。返り値は R0。R7 は段の主なので
     誰も壊さない。
   - 大域と配列はラベルつきの .word / .space としてコードの後ろに。
   ============================================================ */

import { ENTRY } from '../core/vm.js';

const DSP_INIT = 0x7C00;      // 珠の段のはじまり（戻り番地の段と分けて住む）

/* 組み込み（LANGUAGE.md §5）。名前 → 引数の数 */
export const BUILTINS = new Map([
  ['点', 3], ['色', 2], ['塗る', 1], ['見せる', 0],
  ['ボタン', 0], ['押した', 0], ['乱数', 1], ['種', 1],
  ['フレーム', 0], ['鍵', 0], ['文字', 1], ['表示', 1],
  ['音', 4], ['おく', 2], ['みる', 1], ['止まる', 0],
]);

/* デバイスの番地（HARDWARE.md §3） */
const DEV = {
  FLIP: '0xF000', FRAME: '0xF001', BTN: '0xF002', BTNP: '0xF003',
  RAND: '0xF004', KEY: '0xF005', OUT: '0xF006',
};

const ARITH = {
  '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV', '%': 'MOD',
  '&': 'AND', '|': 'OR', '^': 'XOR', '<<': 'SHL', '>>': 'SHR',
};
const COMPARE = {
  '==': 'JZ', '!=': 'JNZ', '<': 'JLT', '<=': 'JLE', '>': 'JGT', '>=': 'JGE',
};

/* 関数本体が要する局所の枠の数（変数 1、かぞえ 2） */
function countSlots(stmts) {
  let n = 0;
  for (const s of stmts ?? []) {
    if (s.t === 'var') n += 1;
    else if (s.t === 'for') n += 2 + countSlots(s.body);
    else if (s.t === 'if') n += countSlots(s.then) + countSlots(s.else_);
    else if (s.t === 'while' || s.t === 'loop') n += countSlots(s.body);
  }
  return n;
}

class Gen {
  constructor() {
    this.lines = [];          // 吐いたアセンブリの行
    this.dataLines = [];      // 末尾に置くデータ
    this.errors = [];
    this.markers = [];        // { addr, line } 文の始まりの目印
    this.addr = ENTRY;        // いま置こうとしている番地（全命令 2 ワード）
    this.uid = 0;
    this.globals = new Map(); // 名前 → 結び（大域・配列・関数）
    this.scopes = [];         // 名前の鎖。先頭が globals
    this.fn = null;           // いま写している関数 { nlocals, nparams, next }
    this.dsp = 0;             // R7 の段に途中で積んだ語数（写しの時点で決まる）
    this.loops = [];          // { brk, cont }
    this.usedRt = new Set();  // 使われた走り屋（実行時サブルーチン）
  }

  err(line, msg) { this.errors.push({ line, msg }); }
  label(stem) { return `${stem}${this.uid++}`; }

  ins(s) { this.lines.push('  ' + s); this.addr += 2; }
  lab(l) { this.lines.push(l + ':'); }
  cmt(s) { this.lines.push('; ' + s); }
  mark(line) { this.markers.push({ addr: this.addr, line }); }

  /* ----- 名前の解決 ----- */

  lookup(name) {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const b = this.scopes[i].get(name);
      if (b) return b;
    }
    return null;
  }

  /* 宣言できる名前か。だめなら理由を記して false */
  declarable(name, line) {
    if (BUILTINS.has(name)) {
      this.err(line, `組み込みと同じ名前は作れません: 「${name}」`);
      return false;
    }
    const top = this.scopes[this.scopes.length - 1];
    if (top.has(name)) {
      this.err(line, `名前が重なっています: 「${name}」`);
      return false;
    }
    return true;
  }

  /* 局所・引数の R7 相対の番地 */
  offOf(b) {
    if (b.kind === 'local') return this.dsp + (this.fn.nlocals - 1 - b.slot);
    return this.dsp + this.fn.nlocals + (this.fn.nparams - 1 - b.idx);
  }

  loadVar(b, line, name) {
    if (b.kind === 'global') {
      this.ins(`LDI r1, ${b.label}`);
      this.ins('LD r0, [r1]');
    } else if (b.kind === 'local' || b.kind === 'param') {
      this.ins(`LD r0, [r7+${this.offOf(b)}]`);
    } else if (b.kind === 'arr') {
      this.ins(`LDI r0, ${b.label}`);          // 裸の配列名は先頭番地
    } else {
      this.err(line, `関数は値としては使えません: 「${name}」`);
    }
  }

  storeVar(b, line, name) {                    // 値は R0 に
    if (b.kind === 'global') {
      this.ins(`LDI r1, ${b.label}`);
      this.ins('ST [r1], r0');
    } else if (b.kind === 'local' || b.kind === 'param') {
      this.ins(`ST [r7+${this.offOf(b)}], r0`);
    } else {
      this.err(line, `「${name}」には代入できません`);
    }
  }

  /* レジスタ r の値を 0/1 にならす（0 以外 → 1） */
  normalize(r) {
    const L = this.label('真');
    this.ins(`CMPI r${r}, 0`);
    this.ins(`LDI r${r}, 1`);
    this.ins(`JNZ ${L}`);
    this.ins(`LDI r${r}, 0`);
    this.lab(L);
  }

  /* ----- 式。値は R0 に残る ----- */

  genExpr(e) {
    switch (e.t) {
      case 'num':
        this.ins(`LDI r0, ${e.v & 0xFFFF}`);
        return;
      case 'var': {
        const b = this.lookup(e.name);
        if (!b) {
          this.err(e.line, BUILTINS.has(e.name)
            ? `組み込み「${e.name}」は呼んでください（値ではありません）`
            : `未宣言の変数です: 「${e.name}」`);
          return;
        }
        this.loadVar(b, e.line, e.name);
        return;
      }
      case 'index': {
        const b = this.lookup(e.name);
        if (!b) { this.err(e.line, `未宣言の変数です: 「${e.name}」`); return; }
        if (b.kind !== 'arr') { this.err(e.line, `配列ではありません: 「${e.name}」`); return; }
        this.genExpr(e.idx);
        this.ins(`LD r0, [r0+${b.label}]`);
        return;
      }
      case 'un':
        this.genExpr(e.e);
        if (e.op === '-') {
          this.ins('MOV r1, r0');
          this.ins('LDI r0, 0');
          this.ins('SUB r0, r1');
        } else {                               // !：0 なら 1、他は 0
          const L = this.label('偽');
          this.ins('CMPI r0, 0');
          this.ins('LDI r0, 1');
          this.ins(`JZ ${L}`);
          this.ins('LDI r0, 0');
          this.lab(L);
        }
        return;
      case 'bin': {
        this.genExpr(e.l);
        this.ins('PUSH r0');                   // 左を機械の段に退避
        this.genExpr(e.r);
        this.ins('MOV r1, r0');
        this.ins('POP r0');
        if (ARITH[e.op]) {
          this.ins(`${ARITH[e.op]} r0, r1`);
        } else if (COMPARE[e.op]) {            // 符号つき比較で 0/1 を作る
          const L = this.label('比');
          this.ins('CMP r0, r1');
          this.ins('LDI r0, 1');
          this.ins(`${COMPARE[e.op]} ${L}`);
          this.ins('LDI r0, 0');
          this.lab(L);
        } else if (e.op === '&&') {            // 短絡しない。両辺を 0/1 に
          this.normalize(0);
          this.normalize(1);
          this.ins('AND r0, r1');
        } else {                               // ||
          this.ins('OR r0, r1');
          this.normalize(0);
        }
        return;
      }
      case 'call':
        this.genCall(e);
        return;
    }
  }

  /* 引数を弾いて r0..r(n-1) に並べる（最後のひとつ以外は退避を経る） */
  argsToRegs(args) {
    const n = args.length;
    for (let i = 0; i < n - 1; i++) {
      this.genExpr(args[i]);
      this.ins('PUSH r0');
    }
    if (n > 0) this.genExpr(args[n - 1]);
    if (n > 1) this.ins(`MOV r${n - 1}, r0`);
    for (let i = n - 2; i >= 0; i--) this.ins(`POP r${i}`);
  }

  genCall(e) {
    const { name, args, line } = e;

    if (BUILTINS.has(name)) {
      const need = BUILTINS.get(name);
      if (args.length !== need) {
        this.err(line, `引数の数が違います: 「${name}」は ${need} 個（${args.length} 個ある）`);
        return;
      }
      this.genBuiltin(name, args);
      return;
    }

    const b = this.lookup(name);
    if (!b) { this.err(line, `未宣言の関数です: 「${name}」`); return; }
    if (b.kind !== 'func') { this.err(line, `「${name}」は関数ではありません`); return; }
    if (args.length !== b.params.length) {
      this.err(line, `引数の数が違います: 「${name}」は ${b.params.length} 個（${args.length} 個ある）`);
      return;
    }
    for (const a of args) {                    // 左から珠の段に積む
      this.genExpr(a);
      this.ins('SUBI r7, 1');
      this.ins('ST [r7], r0');
      this.dsp++;
    }
    this.ins(`CALL ${b.label}`);
    if (args.length) {
      this.ins(`ADDI r7, ${args.length}`);
      this.dsp -= args.length;
    }
  }

  genBuiltin(name, args) {
    const rt = (label) => { this.usedRt.add(name); this.ins(`CALL ${label}`); };
    const readDev = (addr) => { this.ins(`LDI r1, ${addr}`); this.ins('LD r0, [r1]'); };
    const writeDev = (addr) => {               // R0 の値を addr へ
      this.genExpr(args[0]);
      this.ins(`LDI r1, ${addr}`);
      this.ins('ST [r1], r0');
    };

    switch (name) {
      case '点': this.argsToRegs(args); rt('組_点'); return;
      case '色': this.argsToRegs(args); rt('組_色'); return;
      case '塗る': this.genExpr(args[0]); rt('組_塗る'); return;
      case '乱数': this.genExpr(args[0]); rt('組_乱数'); return;
      case '表示': this.genExpr(args[0]); rt('組_表示'); return;
      case '音': this.argsToRegs(args); rt('組_音'); return;
      case '見せる': {                          // FLIP に書き、下りるまで待つ
        const L = this.label('幕');
        this.ins(`LDI r1, ${DEV.FLIP}`);
        this.ins('ST [r1], r1');
        this.lab(L);
        this.ins('LD r0, [r1]');
        this.ins('CMPI r0, 0');
        this.ins(`JNZ ${L}`);
        return;
      }
      case 'ボタン': readDev(DEV.BTN); return;
      case '押した': readDev(DEV.BTNP); return;
      case 'フレーム': readDev(DEV.FRAME); return;
      case '鍵': readDev(DEV.KEY); return;
      case '種': writeDev(DEV.RAND); return;
      case '文字': writeDev(DEV.OUT); return;
      case 'おく':
        this.genExpr(args[0]);
        this.ins('PUSH r0');
        this.genExpr(args[1]);
        this.ins('MOV r1, r0');
        this.ins('POP r0');
        this.ins('ST [r0], r1');
        return;
      case 'みる':
        this.genExpr(args[0]);
        this.ins('LD r0, [r0]');
        return;
      case '止まる':
        this.ins('HLT');
        return;
    }
  }

  /* ----- 文 ----- */

  genBlock(stmts) {
    this.scopes.push(new Map());
    for (const s of stmts) this.genStmt(s);
    this.scopes.pop();
  }

  /* 宣言の置き場をひとつ作る（関数の中なら枠、外なら大域の語） */
  newSlot(name, kindLabelStem) {
    if (this.fn) {
      const slot = this.fn.next++;
      return { kind: 'local', slot };
    }
    const label = `${kindLabelStem}${this.uid++}_${name}`;
    this.dataLines.push(`${label}: .word 0`);
    return { kind: 'global', label };
  }

  genStmt(s) {
    if (s.t !== 'arr' && s.t !== 'func') this.mark(s.line);
    switch (s.t) {
      case 'var': {
        this.genExpr(s.init);                  // 先に弾く。新しい名はまだ見えない
        let b;
        if (this.scopes.length === 1) {
          b = this.globals.get(s.name);        // 先回りで作ってある（誤りも記録済み）
          if (!b || b.kind !== 'global') return;
        } else {
          if (!this.declarable(s.name, s.line)) return;
          b = this.newSlot(s.name, '大_');
          this.scopes[this.scopes.length - 1].set(s.name, b);
        }
        this.storeVar(b, s.line, s.name);
        return;
      }
      case 'arr':
        if (this.scopes.length > 1) {          // 塊の中の配列も大域に置く
          if (!this.declarable(s.name, s.line)) return;
          const label = `配_${this.uid++}_${s.name}`;
          this.dataLines.push(`${label}: .space ${s.size}`);
          this.scopes[this.scopes.length - 1].set(s.name, { kind: 'arr', label, size: s.size });
        }
        return;                                // 置き場だけ。命令は出ない
      case 'func':
        return;                                // 本体は後でまとめて写す
      case 'assign': {
        const b = this.lookup(s.name);
        if (!b) {
          this.err(s.line, BUILTINS.has(s.name)
            ? `組み込みには代入できません: 「${s.name}」`
            : `未宣言の変数です: 「${s.name}」`);
          return;
        }
        this.genExpr(s.expr);
        this.storeVar(b, s.line, s.name);
        return;
      }
      case 'astore': {
        const b = this.lookup(s.name);
        if (!b) { this.err(s.line, `未宣言の変数です: 「${s.name}」`); return; }
        if (b.kind !== 'arr') { this.err(s.line, `配列ではありません: 「${s.name}」`); return; }
        this.genExpr(s.idx);
        this.ins('PUSH r0');
        this.genExpr(s.expr);
        this.ins('MOV r1, r0');
        this.ins('POP r0');
        this.ins(`ST [r0+${b.label}], r1`);
        return;
      }
      case 'if': {
        const Lelse = this.label('違');
        this.genExpr(s.cond);
        this.ins('CMPI r0, 0');
        this.ins(`JZ ${Lelse}`);
        this.genBlock(s.then);
        if (s.else_) {
          const Lend = this.label('了');
          this.ins(`JMP ${Lend}`);
          this.lab(Lelse);
          this.genBlock(s.else_);
          this.lab(Lend);
        } else {
          this.lab(Lelse);
        }
        return;
      }
      case 'while': {
        const Ls = this.label('間'), Le = this.label('了');
        this.lab(Ls);
        this.genExpr(s.cond);
        this.ins('CMPI r0, 0');
        this.ins(`JZ ${Le}`);
        this.loops.push({ brk: Le, cont: Ls });
        this.genBlock(s.body);
        this.loops.pop();
        this.ins(`JMP ${Ls}`);
        this.lab(Le);
        return;
      }
      case 'loop': {
        const Ls = this.label('環'), Le = this.label('了');
        this.lab(Ls);
        this.loops.push({ brk: Le, cont: Ls });
        this.genBlock(s.body);
        this.loops.pop();
        this.ins(`JMP ${Ls}`);
        this.lab(Le);
        return;
      }
      case 'for': {
        const Ls = this.label('数'), Lc = this.label('次'), Le = this.label('了');
        this.scopes.push(new Map());
        this.genExpr(s.from);
        let vi = null, vl;
        if (this.declarable(s.name, s.line)) {
          vi = this.newSlot(s.name, '回_');
          this.scopes[this.scopes.length - 1].set(s.name, vi);
        }
        vl = this.newSlot('限り', '限_');
        if (!vi) { this.scopes.pop(); return; }
        this.storeVar(vi, s.line, s.name);
        this.genExpr(s.to);
        this.storeVar(vl, s.line, s.name);
        this.lab(Ls);
        this.loadVar(vi, s.line, s.name);
        this.ins('PUSH r0');
        this.loadVar(vl, s.line, s.name);
        this.ins('MOV r1, r0');
        this.ins('POP r0');
        this.ins('CMP r0, r1');
        this.ins(`JGT ${Le}`);                 // 上りのみ。両端を含む
        this.loops.push({ brk: Le, cont: Lc });
        this.genBlock(s.body);
        this.loops.pop();
        this.lab(Lc);
        this.loadVar(vi, s.line, s.name);
        this.ins('ADDI r0, 1');
        this.storeVar(vi, s.line, s.name);
        this.ins(`JMP ${Ls}`);
        this.lab(Le);
        this.scopes.pop();
        return;
      }
      case 'break':
        if (!this.loops.length) { this.err(s.line, 'ループの外では「ぬける」は使えません'); return; }
        this.ins(`JMP ${this.loops[this.loops.length - 1].brk}`);
        return;
      case 'cont':
        if (!this.loops.length) { this.err(s.line, 'ループの外では「つづける」は使えません'); return; }
        this.ins(`JMP ${this.loops[this.loops.length - 1].cont}`);
        return;
      case 'ret':
        if (!this.fn) { this.err(s.line, '関数の外では「かえす」は使えません'); return; }
        if (s.expr) this.genExpr(s.expr);
        else this.ins('LDI r0, 0');
        if (this.fn.nlocals) this.ins(`ADDI r7, ${this.fn.nlocals}`);
        this.ins('RET');
        return;
      case 'expr':
        this.genExpr(s.expr);
        return;
    }
  }

  /* ----- 関数 ----- */

  genFunc(node) {
    const b = this.globals.get(node.name);
    if (!b || b.kind !== 'func') return;       // 宣言時の誤りは記録済み
    this.fn = { nlocals: countSlots(node.body), nparams: node.params.length, next: 0 };
    this.dsp = 0;
    this.cmt(`関数 ${node.name}`);
    this.lab(b.label);
    if (this.fn.nlocals) this.ins(`SUBI r7, ${this.fn.nlocals}`);
    const pscope = new Map();
    node.params.forEach((p, i) => {
      if (BUILTINS.has(p.name)) this.err(p.line, `組み込みと同じ名前は作れません: 「${p.name}」`);
      else if (pscope.has(p.name)) this.err(p.line, `名前が重なっています: 「${p.name}」`);
      else pscope.set(p.name, { kind: 'param', idx: i });
    });
    this.scopes.push(pscope);
    this.genBlock(node.body);
    this.scopes.pop();
    this.ins('LDI r0, 0');                     // かえす がなければ 0 を返す
    if (this.fn.nlocals) this.ins(`ADDI r7, ${this.fn.nlocals}`);
    this.ins('RET');
    this.fn = null;
  }

  /* ----- 走り屋（実行時サブルーチン）。使われたものだけ末尾に ----- */

  emitRuntime() {
    if (this.usedRt.has('点')) {               // r0=x r1=y r2=色
      this.cmt('組_点: 画素をひとつ置く');
      this.lab('組_点');
      for (const s of [
        'PUSH r2',
        'LDI r2, 32', 'MUL r1, r2',            // y*32
        'MOV r2, r0', 'LDI r3, 2', 'SHR r2, r3',
        'ADD r1, r2', 'ADDI r1, 0x8000',       // r1 = 語の番地
        'LDI r2, 3', 'AND r0, r2', 'LDI r2, 4', 'MUL r0, r2',  // r0 = ずらし
        'LDI r2, 15', 'SHL r2, r0', 'NOT r2',
        'LD r3, [r1]', 'AND r3, r2',
        'POP r2', 'SHL r2, r0', 'OR r3, r2',
        'ST [r1], r3', 'RET',
      ]) this.ins(s);
    }
    if (this.usedRt.has('色')) {               // r0=x r1=y → r0=色
      this.cmt('組_色: 画素を読む');
      this.lab('組_色');
      for (const s of [
        'LDI r2, 32', 'MUL r1, r2',
        'MOV r2, r0', 'LDI r3, 2', 'SHR r2, r3',
        'ADD r1, r2', 'ADDI r1, 0x8000',
        'LDI r2, 3', 'AND r0, r2', 'LDI r2, 4', 'MUL r0, r2',
        'LD r3, [r1]', 'SHR r3, r0',
        'LDI r0, 15', 'AND r0, r3', 'RET',
      ]) this.ins(s);
    }
    if (this.usedRt.has('塗る')) {             // r0=色
      this.cmt('組_塗る: 画面全部をひと色で');
      this.lab('組_塗る');
      const L = '塗_環';
      this.ins('LDI r1, 0x1111');
      this.ins('MUL r0, r1');                  // 4 画素ぶん同じ色の語
      this.ins('LDI r1, 0x8000');
      this.ins('LDI r2, 0x8C00');
      this.lab(L);
      this.ins('ST [r1], r0');
      this.ins('ADDI r1, 1');
      this.ins('CMP r1, r2');
      this.ins(`JNZ ${L}`);
      this.ins('RET');
    }
    if (this.usedRt.has('乱数')) {             // r0=n → r0
      this.cmt('組_乱数: 0〜n-1。n=0 は 0');
      this.lab('組_乱数');
      this.ins('CMPI r0, 0');
      this.ins('JZ 乱_零');
      this.ins('MOV r1, r0');
      this.ins(`LDI r2, ${DEV.RAND}`);
      this.ins('LD r0, [r2]');
      this.ins('MOD r0, r1');
      this.lab('乱_零');
      this.ins('RET');
    }
    if (this.usedRt.has('表示')) {             // r0=値。十進で書き、改行
      this.cmt('組_表示: 数を十進で。0 も「0」');
      this.lab('組_表示');
      this.ins('LDI r3, 0');                   // 桁数
      this.ins('LDI r2, 10');
      this.lab('表_桁');
      this.ins('MOV r1, r0');
      this.ins('MOD r1, r2');
      this.ins('ADDI r1, 48');                 // '0'
      this.ins('PUSH r1');
      this.ins('ADDI r3, 1');
      this.ins('DIV r0, r2');
      this.ins('CMPI r0, 0');
      this.ins('JNZ 表_桁');
      this.lab('表_出');
      this.ins('POP r1');
      this.ins(`LDI r0, ${DEV.OUT}`);
      this.ins('ST [r0], r1');
      this.ins('SUBI r3, 1');
      this.ins('CMPI r3, 0');
      this.ins('JNZ 表_出');
      this.ins('LDI r1, 10');                  // 改行
      this.ins('ST [r0], r1');
      this.ins('RET');
    }
    if (this.usedRt.has('音')) {               // r0=ch r1=周波数 r2=音量 r3=波形
      this.cmt('組_音: 音源レジスタへまとめて');
      this.lab('組_音');
      this.ins('PUSH r3');
      this.ins('LDI r3, 4');
      this.ins('MUL r0, r3');
      this.ins('ADDI r0, 0xF010');
      this.ins('ST [r0], r1');                 // FREQ
      this.ins('ST [r0+1], r2');               // VOL
      this.ins('POP r3');
      this.ins('ST [r0+2], r3');               // WAVE
      this.ins('RET');
    }
  }

  /* ----- 全体 ----- */

  generate(ast) {
    /* 先回り：いちばん外の宣言を先に名簿へ（関数は前方からも呼べる） */
    for (const s of ast.body) {
      if (s.t !== 'func' && s.t !== 'arr' && s.t !== 'var') continue;
      if (BUILTINS.has(s.name)) {
        this.err(s.line, `組み込みと同じ名前は作れません: 「${s.name}」`);
        continue;
      }
      if (this.globals.has(s.name)) {
        this.err(s.line, `名前が重なっています: 「${s.name}」`);
        continue;
      }
      if (s.t === 'func') {
        this.globals.set(s.name, { kind: 'func', label: `関_${s.name}`, params: s.params });
      } else if (s.t === 'arr') {
        if (s.size < 1 || s.size > 0x7000) {
          this.err(s.line, `配列の大きさが収まりません: ${s.size}`);
          continue;
        }
        this.globals.set(s.name, { kind: 'arr', label: `大_${s.name}`, size: s.size });
        this.dataLines.push(`大_${s.name}: .space ${s.size}`);
      } else {
        this.globals.set(s.name, { kind: 'global', label: `大_${s.name}` });
        this.dataLines.push(`大_${s.name}: .word 0`);
      }
    }

    this.scopes.push(this.globals);

    this.cmt('珠の写し（自動生成）');
    this.lines.push(`.org 0x${ENTRY.toString(16).padStart(4, '0')}`);
    this.ins(`LDI r7, 0x${DSP_INIT.toString(16)}`);   // 珠の段を据える

    for (const s of ast.body) {
      if (s.t === 'func') continue;            // 流れからは外す
      this.genStmt(s);
    }
    this.ins('HLT');                           // 流れの果て。隣に落ちない

    for (const s of ast.body) if (s.t === 'func') this.genFunc(s);

    this.emitRuntime();

    if (this.dataLines.length) {
      this.cmt('大域と配列の置き場');
      this.lines.push(...this.dataLines);
    }

    return {
      asm: this.lines.join('\n') + '\n',
      errors: this.errors,
      markers: this.markers,
    };
  }
}

export function generate(ast) {
  return new Gen().generate(ast);
}
