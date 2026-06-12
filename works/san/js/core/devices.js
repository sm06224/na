/* ============================================================
   デバイス — 0xF000 ページに住む機械の感覚器。

   画面の同期（FLIP/FRAME）、ボタン、決定的な乱数、打鍵キュー、
   シリアル出力、4 チャンネルの音源レジスタ。
   どれも DOM を知らない。ブラウザではホストが毎フレーム tick() を
   呼び、テストでは Node が同じことをする。
   ============================================================ */

export const REG = {
  FLIP: 0xF000,
  FRAME: 0xF001,
  BTN: 0xF002,
  BTNP: 0xF003,
  RAND: 0xF004,
  KEY: 0xF005,
  OUT: 0xF006,
  SOUND: 0xF010,   // ch*4: FREQ, VOL, WAVE, DUTY
};

export const BTN = {
  UP: 1, DOWN: 2, LEFT: 4, RIGHT: 8,
  A: 16, B: 32, START: 64, SELECT: 128,
};

export const CHANNELS = 4;

export class Devices {
  constructor(seed = 1) {
    this.reset(seed);
  }

  reset(seed = 1) {
    this.flip = 0;
    this.frame = 0;
    this.btn = 0;
    this.btnp = 0;
    this.rand = (seed >>> 0) || 1;
    this.keys = [];                     // 打鍵キュー（UTF-16 符号単位）
    this.serial = '';                   // 書き出された文字の蓄積
    this.sound = Array.from({ length: CHANNELS }, () => ({
      freq: 0, vol: 0, wave: 0, duty: 2,
    }));
  }

  /* ----- ホスト側の作法 ----- */

  /* 1 フレームぶん CPU を回したら呼ぶ：画面を渡し、時を進める */
  tick() {
    this.flip = 0;
    this.frame = (this.frame + 1) & 0xFFFF;
    this.btnp = 0;
  }

  /* いま押されているボタンを伝える（押された瞬間は自動で計算） */
  setButtons(mask) {
    this.btnp |= (mask & ~this.btn) & 0xFF;
    this.btn = mask & 0xFF;
  }

  pressKey(ch) {
    for (const c of String(ch)) {
      for (let i = 0; i < c.length; i++) this.keys.push(c.charCodeAt(i));
    }
  }

  takeSerial() {
    const s = this.serial;
    this.serial = '';
    return s;
  }

  /* ----- バスから見える顔 ----- */

  read(addr) {
    if (addr === REG.FLIP) return this.flip;
    if (addr === REG.FRAME) return this.frame;
    if (addr === REG.BTN) return this.btn;
    if (addr === REG.BTNP) return this.btnp;
    if (addr === REG.RAND) {
      // 決定的 LCG（Numerical Recipes）。読むたびに進む
      this.rand = (Math.imul(this.rand, 1664525) + 1013904223) >>> 0;
      return this.rand >>> 16;
    }
    if (addr === REG.KEY) return this.keys.length ? this.keys.shift() : 0;
    const ch = this.chanOf(addr);
    if (ch) {
      const c = this.sound[ch.i];
      return [c.freq, c.vol, c.wave, c.duty][ch.k];
    }
    return 0;
  }

  write(addr, v) {
    if (addr === REG.FLIP) { this.flip = 1; return; }
    if (addr === REG.RAND) { this.rand = (v >>> 0) || 1; return; }
    if (addr === REG.OUT) { this.serial += String.fromCharCode(v); return; }
    const ch = this.chanOf(addr);
    if (ch) {
      const c = this.sound[ch.i];
      if (ch.k === 0) c.freq = v;
      else if (ch.k === 1) c.vol = v & 15;
      else if (ch.k === 2) c.wave = v & 3;
      else c.duty = v & 3;
    }
  }

  chanOf(addr) {
    const off = addr - REG.SOUND;
    if (off < 0 || off >= CHANNELS * 4) return null;
    return { i: off >> 2, k: off & 3 };
  }
}
