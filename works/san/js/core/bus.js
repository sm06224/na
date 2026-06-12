/* ============================================================
   バス — メモリと、メモリのふりをしたデバイスたち。

   0xF000–0xF0FF だけがデバイスページ。それ以外（VRAM・パレット
   含む）はただの RAM。CPU はどちらも区別せず読み書きする。
   ============================================================ */

export const MEM_SIZE = 0x10000;
export const DEV_BASE = 0xF000;
export const DEV_END = 0xF0FF;

export const VRAM = 0x8000;
export const VRAM_END = 0x8BFF;
export const PALETTE = 0x8C00;

export const SCREEN_W = 128;
export const SCREEN_H = 96;
export const ROW_WORDS = SCREEN_W / 4;   // 1 ワード = 4 画素

/* 既定のパレット（HARDWARE.md の 16 色、0xRGB） */
export const DEFAULT_PALETTE = [
  0x111, 0xEED, 0x666, 0xAAA, 0xB43, 0xC46, 0xEAB, 0xA53,
  0x247, 0x48C, 0x7A4, 0x4A7, 0xCB4, 0xC92, 0x647, 0x98C,
];

export class Bus {
  constructor(devices = null) {
    this.ram = new Uint16Array(MEM_SIZE);
    this.devices = devices;
    this.resetPalette();
  }

  resetPalette() {
    for (let i = 0; i < 16; i++) this.ram[PALETTE + i] = DEFAULT_PALETTE[i];
  }

  read(addr) {
    if (addr >= DEV_BASE && addr <= DEV_END && this.devices) {
      return this.devices.read(addr) & 0xFFFF;
    }
    return this.ram[addr];
  }

  write(addr, v) {
    v &= 0xFFFF;
    if (addr >= DEV_BASE && addr <= DEV_END && this.devices) {
      this.devices.write(addr, v);
      return;
    }
    this.ram[addr] = v;
  }

  /* 画素 (x, y) の色番号。範囲外は 0 */
  pixel(x, y) {
    if (x < 0 || x >= SCREEN_W || y < 0 || y >= SCREEN_H) return 0;
    const w = this.ram[VRAM + y * ROW_WORDS + (x >> 2)];
    return (w >> ((x & 3) * 4)) & 0xF;
  }

  /* テスト・ホスト描画用：画素を直に置く（CPU は ST で置く） */
  setPixel(x, y, color) {
    if (x < 0 || x >= SCREEN_W || y < 0 || y >= SCREEN_H) return;
    const addr = VRAM + y * ROW_WORDS + (x >> 2);
    const sh = (x & 3) * 4;
    this.ram[addr] = (this.ram[addr] & ~(0xF << sh)) | ((color & 0xF) << sh);
  }

  /* パレット番号 → CSS 色（ホスト描画用） */
  cssColor(i) {
    const rgb = this.ram[PALETTE + (i & 0xF)];
    const r = (rgb >> 8) & 0xF, g = (rgb >> 4) & 0xF, b = rgb & 0xF;
    return `rgb(${r * 17},${g * 17},${b * 17})`;
  }
}
