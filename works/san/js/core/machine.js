/* ============================================================
   機械 — CPU・バス・デバイスを箱に納めて、電源スイッチをつける。

   ブラウザもテストも、この箱ごしに同じ機械に触る。
   frame() は「FLIP が書かれるまで走らせて、画面を渡し、時を進める」
   という、この機械の 1 フレームの作法そのもの。
   ============================================================ */

import { VM } from './vm.js';
import { Bus, SCREEN_W, SCREEN_H } from './bus.js';
import { Devices } from './devices.js';
import { assemble } from './asm.js';

export const STEPS_PER_FRAME = 200_000;   // 1 フレームの CPU 予算

export class Machine {
  constructor(seed = 1) {
    this.devices = new Devices(seed);
    this.bus = new Bus(this.devices);
    this.vm = new VM(this.bus);
  }

  reset(seed = 1) {
    this.devices.reset(seed);
    this.bus.ram.fill(0);
    this.bus.resetPalette();
    this.vm.reset();
  }

  /* アセンブリを読ませて電源を入れる。結果（ok/errors）を返す */
  loadAsm(src) {
    const out = assemble(src);
    if (out.ok) this.vm.load(out.words, out.origin);
    return out;
  }

  loadWords(words, at) {
    this.vm.load(words, at);
  }

  /* 1 フレーム：FLIP か HLT か予算切れまで走り、時を進める。
     返り値 { flipped, halted, steps } */
  frame(maxSteps = STEPS_PER_FRAME) {
    let steps = 0;
    while (steps < maxSteps && !this.vm.halted && !this.devices.flip) {
      this.vm.step();
      steps++;
    }
    const flipped = this.devices.flip === 1;
    this.devices.tick();
    return { flipped, halted: this.vm.halted, steps };
  }

  /* n フレームぶん回す（テスト・早送り用） */
  frames(n, maxSteps = STEPS_PER_FRAME) {
    for (let i = 0; i < n && !this.vm.halted; i++) this.frame(maxSteps);
  }

  /* 画面を 16 進数の文字の絵にする（テストが目視する用） */
  screenText() {
    const rows = [];
    for (let y = 0; y < SCREEN_H; y++) {
      let row = '';
      for (let x = 0; x < SCREEN_W; x++) row += this.bus.pixel(x, y).toString(16);
      rows.push(row);
    }
    return rows.join('\n');
  }
}
