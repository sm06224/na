import test from 'node:test';
import assert from 'node:assert/strict';
import { assemble, disasm } from '../js/core/asm.js';
import { VM, ENTRY } from '../js/core/vm.js';
import { Bus } from '../js/core/bus.js';

const run = (src) => {
  const out = assemble(src);
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  const vm = new VM(new Bus());
  vm.load(out.words, out.origin);
  vm.run();
  return vm;
};

test('いちばん小さいプログラムが組めて、走る', () => {
  const vm = run(`
    LDI r0, 42
    HLT
  `);
  assert.equal(vm.regs[0], 42);
});

test('ラベル：前方参照も後方参照も解ける', () => {
  const vm = run(`
      LDI r0, 0
      JMP 先
    後:
      ADDI r0, 100
      HLT
    先:
      ADDI r0, 1
      JMP 後
  `);
  assert.equal(vm.regs[0], 101);
});

test('日本語のラベルと定数が使える', () => {
  const vm = run(`
    .const 始まりの数, 7
    数えよ:
      LDI r0, 始まりの数
      ADDI r0, 3
      HLT
  `);
  assert.equal(vm.regs[0], 10);
});

test('数の書き方：16進・2進・負数・文字', () => {
  const vm = run(`
    LDI r0, 0x1F
    LDI r1, 0b1010
    LDI r2, -3
    LDI r3, 'あ'
    HLT
  `);
  assert.equal(vm.regs[0], 31);
  assert.equal(vm.regs[1], 10);
  assert.equal(vm.regs[2], 0xFFFD);
  assert.equal(vm.regs[3], 'あ'.charCodeAt(0));
});

test('.word と .ascii と .space：データが置ける', () => {
  const out = assemble(`
    .org 0x0200
    JMP 主
    表: .word 10, 0x20, 表
    文: .ascii "蛍\\n"
    間: .space 3
    主: HLT
  `);
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  const base = out.labels.get('表');
  assert.equal(base, 0x0202);
  assert.deepEqual([...out.words.slice(2, 5)], [10, 0x20, 0x0202]);
  assert.equal(out.words[5], '蛍'.charCodeAt(0));
  assert.equal(out.words[6], '\n'.charCodeAt(0));
  assert.equal(out.labels.get('間'), 0x0207);
  assert.equal(out.labels.get('主'), 0x020A);
});

test('ラベル+定数の即値と、[レジスタ+変位] の番地指定', () => {
  const vm = run(`
      LDI r1, 表
      LD r0, [r1+1]          ; 22
      LDI r2, 表+2
      LD r3, [r2]            ; 33
      LDI r4, 0
      ST [r1+3], r0          ; 表[3] = 22
      LD r5, [r1+3]
      HLT
    表: .word 11, 22, 33, 0
  `);
  assert.equal(vm.regs[0], 22);
  assert.equal(vm.regs[3], 33);
  assert.equal(vm.regs[5], 22);
});

test('CALL/RET がアセンブリで書けて、入れ子になる', () => {
  const vm = run(`
      LDI r0, 1
      CALL 二倍して三を足す
      HLT
    二倍して三を足す:
      CALL 二倍
      ADDI r0, 3
      RET
    二倍:
      ADD r0, r0
      RET
  `);
  assert.equal(vm.regs[0], 5);
});

test('コメントと引用符：文字列の中の ; に騙されない', () => {
  const out = assemble(`
    文: .ascii "a;b"   ; これは本物のコメント
    HLT                ; ';' も平気
  `);
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  assert.deepEqual([...out.words.slice(0, 3)], [97, 59, 98]);
});

test('誤りは行番号つきの日本語で返る', () => {
  const out = assemble([
    'LDI r0, 1',          // 1 行目 ok
    'FOO r0',             // 2 行目: 知らない命令
    'LDI r9, 1',          // 3 行目: r9 はない → 即値エラーではなくレジスタ
    'JMP どこか',          // 4 行目: 知らない名前
    'LDI r0',             // 5 行目: 引数が足りない
  ].join('\n'));
  assert.equal(out.ok, false);
  const lines = out.errors.map(e => e.line);
  assert.ok(lines.includes(2));
  assert.ok(lines.includes(3));
  assert.ok(lines.includes(4));
  assert.ok(lines.includes(5));
  for (const e of out.errors) assert.match(e.msg, /[ぁ-ん]/u);
});

test('名前の衝突と .org の作法も誤りになる', () => {
  assert.equal(assemble('a: NOP\na: NOP').ok, false);
  assert.equal(assemble('NOP\n.org 0x300\nNOP').ok, false);
  assert.equal(assemble('.org 0x200\n.org 0x300\nNOP').ok, false);
});

test('既定の置き場所は 0x0100、.org で変えられる', () => {
  assert.equal(assemble('NOP').origin, ENTRY);
  assert.equal(assemble('.org 0x0400\nNOP').origin, 0x0400);
});

test('lineOf：番地からソースの行が引ける（デバッガの灯り）', () => {
  const out = assemble('NOP\nNOP\nHLT');
  assert.equal(out.lineOf(ENTRY), 1);
  assert.equal(out.lineOf(ENTRY + 2), 2);
  assert.equal(out.lineOf(ENTRY + 4), 3);
});

test('逆アセンブル：組んだものが読み戻せる', () => {
  const out = assemble(`
    LDI r1, 0x1234
    LD r2, [r3+5]
    ST [r4], r5
    CMP r6, r7
    JMP 0x0100
    RET
  `);
  const d = [];
  for (let i = 0; i < out.words.length; i += 2) d.push(disasm(out.words[i], out.words[i + 1]));
  assert.deepEqual(d, [
    'LDI r1, 0x1234',
    'LD r2, [r3+0x0005]',
    'ST [r4], r5',
    'CMP r6, r7',
    'JMP 0x0100',
    'RET',
  ]);
  assert.match(disasm(0xEE00, 0), /\?\?\?/);
});
