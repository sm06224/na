/* ============================================================
   珠のテスト — 書いた文が、本当に機械の上で動くか。

   コンパイラの吐いた語を Machine に据えて実際に走らせ、
   シリアルの文字・画面の画素・音のレジスタで確かめる。
   誤りの検出は、行番号と日本語であることまで見る。
   ============================================================ */

import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../js/lang/tama.js';
import { Machine } from '../js/core/machine.js';

/* 組めることを確かめてから返す */
function build(src) {
  const out = compile(src);
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  return out;
}

/* 組んで、走らせて、機械ごと返す（frames 指定で 1 フレームずつ） */
function run(src, { frames = 0, seed = 1, setup = null } = {}) {
  const out = build(src);
  const m = new Machine(seed);
  if (setup) setup(m);
  m.loadWords(out.words, out.origin);
  if (frames) m.frames(frames);
  else {
    m.vm.run(5_000_000);
    assert.equal(m.vm.fault, null, `故障: ${m.vm.fault}`);
    assert.equal(m.vm.halted, true, '止まらなかった');
  }
  return { m, out };
}

/* 表示(…) の列だけ確かめる近道 */
const serialOf = (src, opts) => run(src, opts).m.devices.takeSerial();

/* 誤りの作法：ok でなく、行番号が合い、日本語で語ること */
function expectError(src, line) {
  const out = compile(src);
  assert.equal(out.ok, false, '誤りのはずが組めてしまった');
  assert.ok(out.errors.length > 0, '誤りの記録がない');
  const e = out.errors[0];
  if (line !== undefined) assert.equal(e.line, line, JSON.stringify(out.errors));
  assert.match(e.msg, /[ぁ-ん]/, `日本語で語ってほしい: ${e.msg}`);
  return out.errors;
}

/* ----- 式 ----- */

test('算術の優先順位：掛け算が足し算より先', () => {
  assert.equal(serialOf('表示(2 + 3 * 4)'), '14\n');
});

test('括弧が先に弾かれる', () => {
  assert.equal(serialOf('表示((2 + 3) * 4)'), '20\n');
});

test('深く入れ子になった式も正しい', () => {
  assert.equal(serialOf('表示(((1 + 2) * (3 + 4) - 5) % 6)'), '4\n');
  assert.equal(serialOf('表示(1 + 2 * 3 - 4 / 2)'), '5\n');
});

test('単項のマイナスと 2 の補数', () => {
  assert.equal(serialOf('表示(-3 + 4)'), '1\n');
  assert.equal(serialOf('変数 a = -1\n表示(a + 2)'), '1\n');
});

test('割り算と剰余は符号なし', () => {
  assert.equal(serialOf('表示(7 / 2)'), '3\n');
  assert.equal(serialOf('表示(65535 / 2)'), '32767\n');   // -1 ではなく
  assert.equal(serialOf('表示(10 % 3)'), '1\n');
});

test('シフトとビット演算', () => {
  assert.equal(serialOf('表示(1 << 4)\n表示(255 >> 4)\n表示(12 & 10)\n表示(12 | 10)\n表示(12 ^ 10)'),
    '16\n15\n8\n14\n6\n');
});

test('比較は符号つき：-1 < 1 が真', () => {
  assert.equal(serialOf('表示(-1 < 1)'), '1\n');
  assert.equal(serialOf('表示(1 < -1)'), '0\n');
  assert.equal(serialOf('表示(-5 <= -5)\n表示(-2 >= 3)'), '1\n0\n');
});

test('== と != は 0/1 を返す', () => {
  assert.equal(serialOf('表示(3 == 3)\n表示(3 != 3)\n表示(2 == 5)\n表示(2 != 5)'),
    '1\n0\n0\n1\n');
});

test('&& と || と ! は 0/1 に合成する（短絡しない）', () => {
  assert.equal(serialOf('表示(2 && 3)\n表示(0 && 5)\n表示(0 || 7)\n表示(0 || 0)\n表示(!9)\n表示(!0)'),
    '1\n0\n1\n0\n0\n1\n');
});

/* ----- 制御 ----- */

test('もし／ちがえば：両方の道', () => {
  assert.equal(serialOf('変数 x = 9\nもし x > 5 なら { 表示(1) } ちがえば { 表示(2) }'), '1\n');
  assert.equal(serialOf('変数 x = 1\nもし x > 5 なら { 表示(1) } ちがえば { 表示(2) }'), '2\n');
});

test('ちがえば もし の鎖', () => {
  const src = (v) => `変数 x = ${v}
もし x > 5 なら {
  表示(0)
} ちがえば もし x > 0 なら {
  表示(1)
} ちがえば {
  表示(2)
}`;
  assert.equal(serialOf(src(7)), '0\n');
  assert.equal(serialOf(src(3)), '1\n');
  assert.equal(serialOf(src(0)), '2\n');
});

test('あいだ：条件が偽になるまで', () => {
  assert.equal(serialOf(`変数 n = 0
変数 s = 0
あいだ n < 10 {
  s = s + n
  n = n + 1
}
表示(s)`), '45\n');
});

test('かぞえ：両端を含む上りの繰り返し', () => {
  assert.equal(serialOf('変数 s = 0\nかぞえ i = 0 から 9 { s = s + i }\n表示(s)'), '45\n');
  assert.equal(serialOf('変数 c = 0\nかぞえ i = 3 から 3 { c = c + 1 }\n表示(c)'), '1\n');
});

test('くりかえし と ぬける', () => {
  assert.equal(serialOf(`変数 c = 0
くりかえし {
  c = c + 1
  もし c == 5 なら { ぬける }
}
表示(c)`), '5\n');
});

test('つづける：その周を飛ばす', () => {
  assert.equal(serialOf(`変数 s = 0
かぞえ i = 0 から 9 {
  もし i % 2 == 1 なら { つづける }
  s = s + i
}
表示(s)`), '20\n');
});

test('入れ子のループ：ぬける はいちばん内だけ', () => {
  assert.equal(serialOf(`変数 s = 0
かぞえ i = 1 から 3 {
  変数 j = 0
  くりかえし {
    j = j + 1
    もし j == i なら { ぬける }
  }
  s = s + j
}
表示(s)`), '6\n');                              // 1+2+3：外の周は生きている
});

/* ----- 関数 ----- */

test('関数：引数を渡して かえす', () => {
  assert.equal(serialOf('関数 足す(a, b) {\n  かえす a + b\n}\n表示(足す(3, 4))'), '7\n');
});

test('かえす を省くと 0 が返る', () => {
  assert.equal(serialOf('関数 何も() { }\n表示(何も())'), '0\n');
});

test('再帰：fib(10) == 55', () => {
  assert.equal(serialOf(`関数 fib(n) {
  もし n < 2 なら { かえす n }
  かえす fib(n - 1) + fib(n - 2)
}
表示(fib(10))`), '55\n');
});

test('相互再帰：偶と奇が呼び合う', () => {
  assert.equal(serialOf(`関数 偶(n) {
  もし n == 0 なら { かえす 1 }
  かえす 奇(n - 1)
}
関数 奇(n) {
  もし n == 0 なら { かえす 0 }
  かえす 偶(n - 1)
}
表示(偶(10))
表示(奇(10))
表示(奇(7))`), '1\n0\n1\n');
});

test('引数は値渡し：呼んだ側の変数は動かない', () => {
  assert.equal(serialOf(`関数 壊す(a) {
  a = 99
  かえす a
}
変数 v = 5
表示(壊す(v))
表示(v)`), '99\n5\n');
});

test('スコープ：同名の局所が大域を隠し、大域は関数から書ける', () => {
  assert.equal(serialOf(`変数 x = 1
関数 隠す() {
  変数 x = 2
  かえす x
}
関数 書く() {
  x = 9
}
表示(隠す())
表示(x)
書く()
表示(x)`), '2\n1\n9\n');
});

/* ----- 配列 ----- */

test('配列：読み書きできて、はじめは 0', () => {
  assert.equal(serialOf(`配列 譜[16]
譜[0] = 60
譜[3] = 譜[0] + 3
表示(譜[3])
表示(譜[5])`), '63\n0\n');
});

test('配列名を裸で使うと先頭番地になる', () => {
  assert.equal(serialOf(`配列 譜[8]
譜[0] = 7
おく(譜 + 1, 9)
表示(譜[1])
表示(みる(譜))`), '9\n7\n');
});

/* ----- 組み込み ----- */

test('点：画素が VRAM に置かれる', () => {
  const { m } = run('点(3, 5, 7)\n点(127, 95, 12)\n見せる()\nくりかえし { 見せる() }',
    { frames: 2 });
  assert.equal(m.vm.fault, null);
  assert.equal(m.bus.pixel(3, 5), 7);
  assert.equal(m.bus.pixel(127, 95), 12);
  assert.equal(m.bus.pixel(4, 5), 0);          // 隣は汚れない
});

test('塗る：隅々まで染まり、パレットは無事', () => {
  const { m } = run('塗る(4)\n見せる()\nくりかえし { 見せる() }', { frames: 2 });
  assert.equal(m.bus.pixel(0, 0), 4);
  assert.equal(m.bus.pixel(127, 0), 4);
  assert.equal(m.bus.pixel(0, 95), 4);
  assert.equal(m.bus.pixel(127, 95), 4);
  assert.equal(m.bus.ram[0x8C00], 0x111);      // 隣のパレットに溢れていない
});

test('表示：十進と改行。0 も 65535 も正しく', () => {
  assert.equal(serialOf('表示(55)'), '55\n');
  assert.equal(serialOf('表示(0)'), '0\n');
  assert.equal(serialOf('表示(65535)'), '65535\n');
});

test('鍵と文字：打鍵を受け、シリアルに書く', () => {
  const { m } = run('変数 c = 鍵()\n文字(c)\n文字(33)\n文字(鍵())',
    { setup: (mm) => mm.devices.pressKey('あ') });
  assert.equal(m.devices.takeSerial(), 'あ!\0'); // 空の鍵は 0
});

test('乱数：種を蒔き直すと同じ列。乱数(0) は 0', () => {
  assert.equal(serialOf(`種(7)
変数 a = 乱数(100)
変数 b = 乱数(100)
種(7)
表示(a == 乱数(100))
表示(b == 乱数(100))
表示(乱数(0))`), '1\n1\n0\n');
});

test('乱数：機械の種が同じなら結果も同じ', () => {
  const src = '表示(乱数(1000))\n表示(乱数(1000))';
  assert.equal(serialOf(src, { seed: 42 }), serialOf(src, { seed: 42 }));
});

test('音：音源レジスタにまとめて書かれる', () => {
  const { m } = run('音(1, 440, 12, 2)\n音(0, 220, 8, 1)');
  assert.deepEqual(
    { freq: m.devices.sound[1].freq, vol: m.devices.sound[1].vol, wave: m.devices.sound[1].wave },
    { freq: 440, vol: 12, wave: 2 });
  assert.equal(m.devices.sound[0].freq, 220);
});

test('ボタンと押した', () => {
  const { m } = run('表示(ボタン())\n表示(押した())',
    { setup: (mm) => mm.devices.setButtons(16 + 4) });
  assert.equal(m.devices.takeSerial(), '20\n20\n');
});

test('見せる とフレーム：FLIP を待つたびに時が進む', () => {
  const { m, out } = run('見せる()\n見せる()\n表示(フレーム())\n止まる()', { frames: 5 });
  assert.equal(m.vm.fault, null);
  assert.equal(m.vm.halted, true);
  assert.equal(m.devices.takeSerial(), '2\n');
  assert.equal(out.ok, true);
});

test('止まる() で機械が止まる', () => {
  const { m } = run('表示(1)\n止まる()\n表示(2)');
  assert.equal(m.devices.takeSerial(), '1\n');
});

/* ----- LANGUAGE.md §7 の例 ----- */

test('蛍が一匹：仕様の例が組めて、数フレーム飛んで故障しない', () => {
  const { m } = run(`変数 x = 64
変数 y = 48
くりかえし {
  塗る(0)
  もし ボタン() & 4 なら { x = x - 1 }
  もし ボタン() & 8 なら { x = x + 1 }
  点(x, y, 12 + (フレーム() >> 4) % 2)
  見せる()
}`, { frames: 5 });
  assert.equal(m.vm.fault, null);
  assert.equal(m.vm.halted, false);            // 無限ループは生きている
  const c = m.bus.pixel(64, 48);
  assert.ok(c === 12 || c === 13, `蛍の色: ${c}`);
});

/* ----- 誤りの検出 ----- */

test('誤り：未宣言の変数', () => {
  expectError('x = 1', 1);
  expectError('変数 y = 1\n変数 z = w + 1', 2);
});

test('誤り：名前の重複', () => {
  expectError('変数 x = 1\n変数 x = 2', 2);
  expectError('関数 f() { }\n関数 f() { }', 2);
  expectError('関数 f(a, a) { }', 1);
});

test('誤り：引数の個数違い（関数も組み込みも）', () => {
  expectError('関数 f(a) { かえす a }\n変数 y = f(1, 2)', 2);
  expectError('点(1, 2)', 1);
  expectError('見せる(1)', 1);
});

test('誤り：ループの外の ぬける・つづける', () => {
  expectError('ぬける', 1);
  expectError('つづける', 1);
  expectError('関数 f() { ぬける }', 1);       // 関数の中でもループの外
});

test('誤り：関数の外の かえす', () => {
  expectError('変数 x = 1\nかえす x', 2);
});

test('誤り：構文の崩れ', () => {
  expectError('もし x なら', 1);
  expectError('変数 = 3', 1);
  expectError('変数 x = 1 +', 1);
  expectError('変数 x = 1\nもし x > 0 なら {\n  表示(x)', 3);   // 閉じ忘れは末尾で気づく
});

test('誤り：予約語と組み込みの名前の誤用', () => {
  expectError('変数 もし = 3', 1);
  expectError('変数 表示 = 1', 1);
  expectError('関数 点(a) { }', 1);
  expectError('配列 乱数[4]', 1);
});

test('誤り：関数の中の関数・関数の中の配列', () => {
  expectError('関数 f() {\n  関数 g() { }\n}', 2);
  expectError('関数 f() {\n  配列 a[4]\n}', 2);
});

test('誤りの返りかた：ok が偽で、語は空', () => {
  const out = compile('x = 1');
  assert.equal(out.ok, false);
  assert.equal(out.words.length, 0);
  assert.equal(out.lineOf(0x0100), undefined);
});

/* ----- lineOf ----- */

test('lineOf：番地から珠の行へ戻れる', () => {
  const out = build('変数 x = 1\nx = x + 2\n表示(x)');
  assert.equal(out.lineOf(out.origin), 1);     // 入口は最初の文
  const seen = new Set();
  let last = 0;
  for (let a = out.origin; a < out.origin + out.words.length; a += 2) {
    const l = out.lineOf(a);
    if (l === undefined) continue;
    assert.ok(l >= last || seen.has(l), '行は前へ戻らない');
    last = Math.max(last, l);
    seen.add(l);
  }
  assert.ok(seen.has(1) && seen.has(2) && seen.has(3), [...seen].join(','));
  assert.equal(out.lineOf(out.origin - 2), undefined);
});
