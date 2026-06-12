import test from 'node:test';
import assert from 'node:assert/strict';
import { VM, OP, ENTRY, SP_INIT } from '../js/core/vm.js';
import { Bus } from '../js/core/bus.js';

const ins = (op, a = 0, b = 0, imm = 0) => [(op << 8) | (a << 4) | b, imm & 0xFFFF];
const boot = (...instructions) => {
  const vm = new VM(new Bus());
  vm.load(instructions.flat());
  return vm;
};

test('LDI と MOV：数がレジスタに入り、写る', () => {
  const vm = boot(ins(OP.LDI, 0, 0, 42), ins(OP.MOV, 1, 0), ins(OP.HLT));
  vm.run();
  assert.equal(vm.regs[0], 42);
  assert.equal(vm.regs[1], 42);
  assert.equal(vm.halted, true);
  assert.equal(vm.fault, null);
});

test('算術：足し引き掛け割り、すべて 16bit で巻く', () => {
  const vm = boot(
    ins(OP.LDI, 0, 0, 0xFFFF), ins(OP.ADDI, 0, 0, 1),      // 巻き戻って 0
    ins(OP.LDI, 1, 0, 7), ins(OP.LDI, 2, 0, 3),
    ins(OP.MUL, 1, 2),                                       // 21
    ins(OP.LDI, 3, 0, 17), ins(OP.LDI, 4, 0, 5),
    ins(OP.DIV, 3, 4),                                       // 3
    ins(OP.LDI, 5, 0, 17), ins(OP.MOD, 5, 4),                // 2
    ins(OP.HLT));
  vm.run();
  assert.equal(vm.regs[0], 0);
  assert.equal(vm.fZ, false);   // 最後の MOD が Z を更新（2 ≠ 0）
  assert.equal(vm.regs[1], 21);
  assert.equal(vm.regs[3], 3);
  assert.equal(vm.regs[5], 2);
});

test('論理とシフト', () => {
  const vm = boot(
    ins(OP.LDI, 0, 0, 0b1100), ins(OP.LDI, 1, 0, 0b1010),
    ins(OP.AND, 0, 1),                                       // 0b1000
    ins(OP.LDI, 2, 0, 0b1100), ins(OP.OR, 2, 1),             // 0b1110
    ins(OP.LDI, 3, 0, 0b1100), ins(OP.XOR, 3, 1),            // 0b0110
    ins(OP.LDI, 4, 0, 0), ins(OP.NOT, 4),                    // 0xFFFF
    ins(OP.LDI, 5, 0, 1), ins(OP.LDI, 6, 0, 4), ins(OP.SHL, 5, 6),   // 16
    ins(OP.LDI, 7, 0, 0x8000), ins(OP.SHR, 7, 6),            // 0x0800
    ins(OP.HLT));
  vm.run();
  assert.equal(vm.regs[0], 0b1000);
  assert.equal(vm.regs[2], 0b1110);
  assert.equal(vm.regs[3], 0b0110);
  assert.equal(vm.regs[4], 0xFFFF);
  assert.equal(vm.regs[5], 16);
  assert.equal(vm.regs[7], 0x0800);
});

test('CMP のフラグ：符号つきと符号なしは別の世界', () => {
  // 0xFFFF は符号なしでは最大、符号つきでは -1
  const vm = boot(
    ins(OP.LDI, 0, 0, 0xFFFF), ins(OP.LDI, 1, 0, 1),
    ins(OP.CMP, 0, 1), ins(OP.HLT));
  vm.run();
  assert.equal(vm.fZ, false);
  assert.equal(vm.fLT, true);    // -1 < 1（符号つき）
  assert.equal(vm.fB, false);    // 65535 > 1（符号なし）
});

test('分岐：JLT は符号つきの小さいほうへ', () => {
  const at = ENTRY;
  const vm = boot(
    ins(OP.LDI, 0, 0, 0xFFFE),                  // -2
    ins(OP.CMPI, 0, 0, 5),
    ins(OP.JLT, 0, 0, at + 8),                  // 跳ぶはず
    ins(OP.LDI, 1, 0, 111),                     // 踏まれない
    /* at+8: */ ins(OP.LDI, 2, 0, 222),
    ins(OP.HLT));
  vm.run();
  assert.equal(vm.regs[1], 0);
  assert.equal(vm.regs[2], 222);
});

test('ループが回る：1 から 10 までの和 = 55', () => {
  const at = ENTRY;
  const vm = boot(
    ins(OP.LDI, 0, 0, 0),          // 和
    ins(OP.LDI, 1, 0, 1),          // i
    /* at+4 */ ins(OP.ADD, 0, 1),
    ins(OP.ADDI, 1, 0, 1),
    ins(OP.CMPI, 1, 0, 10),
    ins(OP.JLE, 0, 0, at + 4),
    ins(OP.HLT));
  vm.run();
  assert.equal(vm.regs[0], 55);
});

test('スタックと CALL/RET：行って、戻ってくる', () => {
  const at = ENTRY;
  const sub = at + 10;
  const vm = boot(
    ins(OP.LDI, 0, 0, 5),
    ins(OP.CALL, 0, 0, sub),
    ins(OP.LDI, 1, 0, 99),
    ins(OP.HLT),
    ins(OP.NOP),                       // 詰め物
    /* sub: */ ins(OP.ADDI, 0, 0, 10),
    ins(OP.RET));
  vm.run();
  assert.equal(vm.regs[0], 15);
  assert.equal(vm.regs[1], 99);
  assert.equal(vm.sp, SP_INIT);        // スタックは借りた分だけ返す
});

test('PUSH/POP は後入れ先出し', () => {
  const vm = boot(
    ins(OP.LDI, 0, 0, 1), ins(OP.LDI, 1, 0, 2),
    ins(OP.PUSH, 0), ins(OP.PUSH, 1),
    ins(OP.POP, 2), ins(OP.POP, 3),
    ins(OP.HLT));
  vm.run();
  assert.equal(vm.regs[2], 2);
  assert.equal(vm.regs[3], 1);
});

test('LD/ST：メモリに置いて、拾う（変位つき）', () => {
  const vm = boot(
    ins(OP.LDI, 0, 0, 0x2000),
    ins(OP.LDI, 1, 0, 0xBEEF),
    ins(OP.ST, 0, 1, 3),               // mem[0x2003] = r1
    ins(OP.LD, 2, 0, 3),               // r2 = mem[0x2003]
    ins(OP.HLT));
  vm.run();
  assert.equal(vm.regs[2], 0xBEEF);
});

test('JMPR/CALLR：レジスタの先へ', () => {
  const at = ENTRY;
  const vm = boot(
    ins(OP.LDI, 0, 0, at + 8),
    ins(OP.CALLR, 0),
    ins(OP.HLT),
    ins(OP.NOP),
    /* at+8 */ ins(OP.LDI, 1, 0, 7),
    ins(OP.RET));
  vm.run();
  assert.equal(vm.regs[1], 7);
  assert.equal(vm.halted, true);
});

test('故障：零で割ると、理由を残して止まる', () => {
  const vm = boot(ins(OP.LDI, 0, 0, 5), ins(OP.LDI, 1, 0, 0), ins(OP.DIV, 0, 1));
  vm.run();
  assert.equal(vm.halted, true);
  assert.match(vm.fault, /零/);
});

test('故障：知らない命令も、理由を残して止まる', () => {
  const vm = boot([0xEE00, 0]);
  vm.run();
  assert.equal(vm.halted, true);
  assert.match(vm.fault, /知らない命令/);
});

test('run は予算を守る', () => {
  const vm = boot(ins(OP.JMP, 0, 0, ENTRY));    // 無限ループ
  const n = vm.run(1000);
  assert.equal(n, 1000);
  assert.equal(vm.halted, false);
});
