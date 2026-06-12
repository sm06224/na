/* ============================================================
   画面 — 128×96 の小さな窓。

   VRAM の 4bit をパレットで色に直し、ImageData に写して
   整数倍に拡大する。にじませない。画素は画素のまま。
   ============================================================ */

import { SCREEN_W, SCREEN_H, VRAM, PALETTE, ROW_WORDS } from '../core/bus.js';

export class Screen {
  /* canvas: 128×96 の <canvas>。box: 寸法を合わせる入れ物 */
  constructor(canvas, box) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.img = this.ctx.createImageData(SCREEN_W, SCREEN_H);
    const d = this.img.data;
    for (let i = 3; i < d.length; i += 4) d[i] = 255;   // 不透明
    this.pal = new Uint8Array(16 * 3);                   // パレットの写し（R,G,B）

    if (box) {
      const fit = () => this.fit(box);
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(box);
      else window.addEventListener('resize', fit);
      fit();
    }
  }

  /* 入れ物に収まる最大の整数倍へ */
  fit(box) {
    const availW = Math.max(SCREEN_W, box.clientWidth - 22);
    const availH = Math.max(SCREEN_H, box.clientHeight - 22);
    const k = Math.max(1, Math.floor(Math.min(availW / SCREEN_W, availH / SCREEN_H)));
    this.canvas.style.width = SCREEN_W * k + 'px';
    this.canvas.style.height = SCREEN_H * k + 'px';
  }

  /* いまの VRAM とパレットを窓に映す */
  draw(bus) {
    const ram = bus.ram;
    const pal = this.pal;
    for (let i = 0; i < 16; i++) {
      const rgb = ram[PALETTE + i];
      pal[i * 3] = ((rgb >> 8) & 0xF) * 17;
      pal[i * 3 + 1] = ((rgb >> 4) & 0xF) * 17;
      pal[i * 3 + 2] = (rgb & 0xF) * 17;
    }
    const d = this.img.data;
    let di = 0;
    for (let y = 0; y < SCREEN_H; y++) {
      let a = VRAM + y * ROW_WORDS;
      for (let wx = 0; wx < ROW_WORDS; wx++) {
        const w = ram[a++];
        for (let k = 0; k < 16; k += 4) {        // 1 ワードに 4 画素、下位から
          const c = ((w >> k) & 0xF) * 3;
          d[di] = pal[c]; d[di + 1] = pal[c + 1]; d[di + 2] = pal[c + 2];
          di += 4;
        }
      }
    }
    this.ctx.putImageData(this.img, 0, 0);
  }
}
