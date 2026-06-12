/* ============================================================
   CPU — 算の心臓。

   16bit・ワードアドレス・全命令 2 ワード固定長。
   word0 = (op << 8) | (a << 4) | b、word1 = imm。
   仕様のすべては HARDWARE.md にある。ここはその写し。
   ============================================================ */

export const ENTRY = 0x0100;
export const SP_INIT = 0x8000;

export const OP = {
  NOP: 0x00, HLT: 0x01, MOV: 0x02, LDI: 0x03, LD: 0x04, ST: 0x05,
  PUSH: 0x06, POP: 0x07,
  ADD: 0x08, SUB: 0x09, MUL: 0x0A, DIV: 0x0B, MOD: 0x0C,
  AND: 0x0D, OR: 0x0E, XOR: 0x0F, NOT: 0x10, SHL: 0x11, SHR: 0x12,
  ADDI: 0x13, SUBI: 0x14, CMP: 0x15, CMPI: 0x16,
  JMP: 0x17, JZ: 0x18, JNZ: 0x19, JLT: 0x1A, JLE: 0x1B, JGT: 0x1C, JGE: 0x1D,
  CALL: 0x1E, RET: 0x1F, JMPR: 0x20, CALLR: 0x21,
};

const W = 0xFFFF;
const signed = v => (v >= 0x8000 ? v - 0x10000 : v);

export class VM {
  constructor(bus) {
    this.bus = bus;
    this.regs = new Uint16Array(8);
    this.reset();
  }

  reset() {
    this.regs.fill(0);
    this.pc = ENTRY;
    this.sp = SP_INIT;
    this.fZ = false; this.fLT = false; this.fB = false;
    this.halted = false;
    this.fault = null;
    this.steps = 0;
  }

  /* プログラム（ワード列）を据えて、入口に PC を合わせる */
  load(words, at = ENTRY) {
    for (let i = 0; i < words.length; i++) this.bus.write((at + i) & W, words[i]);
    this.pc = at;
    this.halted = false;
    this.fault = null;
  }

  trip(reason) {
    this.fault = reason;
    this.halted = true;
  }

  push(v) {
    this.sp = (this.sp - 1) & W;
    this.bus.write(this.sp, v);
  }
  pop() {
    const v = this.bus.read(this.sp);
    this.sp = (this.sp + 1) & W;
    return v;
  }

  /* 1 命令。走り続けるなら true */
  step() {
    if (this.halted) return false;
    const w0 = this.bus.read(this.pc);
    const imm = this.bus.read((this.pc + 1) & W);
    this.pc = (this.pc + 2) & W;
    const op = w0 >> 8, a = (w0 >> 4) & 0x0F, b = w0 & 0x0F;
    const R = this.regs;
    const setZ = v => { this.fZ = v === 0; return v; };
    this.steps++;

    switch (op) {
      case OP.NOP: break;
      case OP.HLT: this.halted = true; break;
      case OP.MOV: R[a] = R[b]; break;
      case OP.LDI: R[a] = imm; break;
      case OP.LD: R[a] = this.bus.read((R[b] + imm) & W); break;
      case OP.ST: this.bus.write((R[a] + imm) & W, R[b]); break;
      case OP.PUSH: this.push(R[a]); break;
      case OP.POP: R[a] = this.pop(); break;
      case OP.ADD: R[a] = setZ((R[a] + R[b]) & W); break;
      case OP.SUB: R[a] = setZ((R[a] - R[b]) & W); break;
      case OP.MUL: R[a] = setZ(Math.imul(R[a], R[b]) & W); break;
      case OP.DIV:
        if (R[b] === 0) { this.trip('零で割った'); break; }
        R[a] = setZ((R[a] / R[b]) | 0); break;
      case OP.MOD:
        if (R[b] === 0) { this.trip('零で割った'); break; }
        R[a] = setZ(R[a] % R[b]); break;
      case OP.AND: R[a] = setZ(R[a] & R[b]); break;
      case OP.OR: R[a] = setZ(R[a] | R[b]); break;
      case OP.XOR: R[a] = setZ(R[a] ^ R[b]); break;
      case OP.NOT: R[a] = setZ((~R[a]) & W); break;
      case OP.SHL: R[a] = setZ((R[a] << (R[b] & 15)) & W); break;
      case OP.SHR: R[a] = setZ(R[a] >>> (R[b] & 15)); break;
      case OP.ADDI: R[a] = setZ((R[a] + imm) & W); break;
      case OP.SUBI: R[a] = setZ((R[a] - imm) & W); break;
      case OP.CMP:
        this.fZ = R[a] === R[b];
        this.fLT = signed(R[a]) < signed(R[b]);
        this.fB = R[a] < R[b];
        break;
      case OP.CMPI:
        this.fZ = R[a] === imm;
        this.fLT = signed(R[a]) < signed(imm);
        this.fB = R[a] < imm;
        break;
      case OP.JMP: this.pc = imm; break;
      case OP.JZ: if (this.fZ) this.pc = imm; break;
      case OP.JNZ: if (!this.fZ) this.pc = imm; break;
      case OP.JLT: if (this.fLT) this.pc = imm; break;
      case OP.JLE: if (this.fLT || this.fZ) this.pc = imm; break;
      case OP.JGT: if (!(this.fLT || this.fZ)) this.pc = imm; break;
      case OP.JGE: if (!this.fLT) this.pc = imm; break;
      case OP.CALL: this.push(this.pc); this.pc = imm; break;
      case OP.RET: this.pc = this.pop(); break;
      case OP.JMPR: this.pc = R[a]; break;
      case OP.CALLR: this.push(this.pc); this.pc = R[a]; break;
      default: this.trip(`知らない命令 0x${op.toString(16).padStart(2, '0')}`);
    }
    return !this.halted;
  }

  /* 走る。止まるか、予算が尽きるまで。実行した命令数を返す */
  run(maxSteps = 1_000_000) {
    let n = 0;
    while (n < maxSteps && this.step()) n++;
    return n;
  }
}
