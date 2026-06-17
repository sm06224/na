/* ============================================================
   音 — 響の声。Web Audio、依存ゼロ、音源ファイルなし。
   物体の波形はコア（モーダル合成）が作る。ここはそれを鳴らし、
   左右に置き、手作りの残響（ノイズのインパルス応答）に沈める係。
   ============================================================ */

import { strike } from '../core/hibiki.js';

export class Engine {
  constructor() { this.ctx = null; this.buffers = []; this.muted = false; }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();

    this.master = ctx.createGain(); this.master.gain.value = 0.85;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3;
    this.master.connect(comp); comp.connect(ctx.destination);

    // 手作りの残響：減衰するノイズをインパルス応答に。
    const len = Math.floor(ctx.sampleRate * 3.2);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let chn = 0; chn < 2; chn++) {
      const buf = ir.getChannelData(chn);
      for (let i = 0; i < len; i++) buf[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
    }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = ir;
    this.wet = ctx.createGain(); this.wet.gain.value = 0.5;
    this.reverb.connect(this.wet); this.wet.connect(this.master);
  }

  /* 組が変わるたび、各物体の波形を一度だけ焼いておく（叩けば即・鳴る）。 */
  setEnsemble(ensemble, seed) {
    this.ensure();
    this.buffers = [];
    if (!this.ctx) return;
    const sr = this.ctx.sampleRate;
    for (const obj of ensemble.objects) {
      const pcm = strike(obj, { sampleRate: sr, velocity: 1, seed: seed + obj.name });
      const ab = this.ctx.createBuffer(1, pcm.length, sr);
      ab.getChannelData(0).set(pcm);
      this.buffers.push(ab);
    }
  }

  /* i 番の物体を鳴らす。velocity 0..1、pan -1..1。 */
  hit(i, velocity = 1, pan = 0) {
    if (this.muted || !this.ctx || !this.buffers[i]) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.buffers[i];
    const g = ctx.createGain(); g.gain.value = 0.25 + 0.75 * velocity;
    const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) p.pan.value = Math.max(-1, Math.min(1, pan));
    const node = p ? (src.connect(g), g.connect(p), p) : (src.connect(g), g);
    node.connect(this.master);
    const send = ctx.createGain(); send.gain.value = 0.6;
    node.connect(send); send.connect(this.reverb);
    src.start(now);
  }
}
