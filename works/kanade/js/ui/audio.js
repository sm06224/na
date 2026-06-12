/* ============================================================
   音 — 奏の声。Web Audio、依存ゼロ、音源ファイルなし。
   残響はホワイトノイズから手作りしたインパルス応答。
   ============================================================ */

export class Engine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.reverb = null;
    this.wet = null;
    this.drone = null;
    this.droneOn = true;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    // 手作りの残響：減衰するノイズをインパルス応答にする
    const len = Math.floor(ctx.sampleRate * 2.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let chn = 0; chn < 2; chn++) {
      const buf = ir.getChannelData(chn);
      for (let i = 0; i < len; i++) {
        buf[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.4;
      }
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.42;
    this.reverb.connect(this.wet);
    this.wet.connect(this.master);
  }

  /* つまびく。freq/pan/gain/bright(0..1) */
  pluck(freq, pan, gain = 1, bright = 0.5) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.005;
    const dur = Math.max(0.9, 2.4 - freq / 900);   // 低い音ほど長く響く

    const out = ctx.createGain();
    let tail = out;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      out.connect(p);
      tail = p;
    }
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700 + bright * 2400;
    tail.connect(lp);
    lp.connect(this.master);
    lp.connect(this.reverb);

    // 弦のような声：基音（三角波）＋ほのかな倍音（正弦）
    for (const [type, ratio, amp] of [['triangle', 1, 0.26], ['sine', 2, 0.07]]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq * ratio, t);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(amp * gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
    setTimeout(() => { lp.disconnect(); }, (dur + 0.4) * 1000);
  }

  /* 調べ — 主音と五度の、ごく薄い持続音。場をひとつの調に保つ */
  startDrone(rootFreq) {
    if (!this.ctx) return;
    this.stopDrone();
    if (!this.droneOn) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 2.5);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    g.connect(lp);
    lp.connect(this.master);
    lp.connect(this.reverb);
    const parts = [];
    for (const [ratio, detune] of [[0.5, 0], [0.75, 2], [0.5, -3]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = rootFreq * ratio;
      osc.detune.value = detune;
      osc.connect(g);
      osc.start();
      parts.push(osc);
    }
    this.drone = { parts, g };
  }

  stopDrone() {
    if (!this.drone || !this.ctx) return;
    const { parts, g } = this.drone;
    g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.8);
    for (const o of parts) o.stop(this.ctx.currentTime + 1);
    this.drone = null;
  }
}
