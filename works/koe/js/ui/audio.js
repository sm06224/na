/* ============================================================
   声 — audio. Web Audio によるフォルマント合成。音源ファイルなし。
   声源＝ノコギリ波（声帯）、声道＝並列バンドパス（フォルマント）。
   フィルタの中心周波数を動かすと、母音がなめらかに移り変わる。
   ============================================================ */

export class Voice {
  constructor(ctx, dest, reverb) {
    this.ctx = ctx;
    this.osc = ctx.createOscillator(); this.osc.type = 'sawtooth';
    this.sub = ctx.createOscillator(); this.sub.type = 'sawtooth';     // 厚みのための重ね
    this.sub.detune.value = -6;
    // ビブラート
    this.lfo = ctx.createOscillator(); this.lfo.frequency.value = 5;
    this.lfoGain = ctx.createGain(); this.lfoGain.gain.value = 6;       // セント
    this.lfo.connect(this.lfoGain); this.lfoGain.connect(this.osc.detune); this.lfoGain.connect(this.sub.detune);
    // 声道：3 つのフォルマント（並列バンドパス）
    this.bp = []; this.fg = [];
    for (let i = 0; i < 3; i++) {
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 8;
      const g = ctx.createGain(); g.gain.value = 0.0;
      this.osc.connect(f); this.sub.connect(f); f.connect(g);
      this.bp.push(f); this.fg.push(g);
    }
    this.out = ctx.createGain(); this.out.gain.value = 0.0001;
    for (const g of this.fg) g.connect(this.out);
    this.out.connect(dest);
    if (reverb) { this.send = ctx.createGain(); this.send.gain.value = 0.35; this.out.connect(this.send); this.send.connect(reverb); }
    this.osc.start(); this.sub.start(); this.lfo.start();
    this.active = false;
  }
  setVowel(vowel, when, glide = 0.08) {
    for (let i = 0; i < 3; i++) {
      const f = vowel.f[i], bw = vowel.bw[i], g = vowel.g[i];
      this.bp[i].frequency.setTargetAtTime(f, when, glide);
      this.bp[i].Q.setTargetAtTime(Math.max(2, f / bw), when, glide);
      this.fg[i].gain.setTargetAtTime(g, when, glide);
    }
  }
  setVib(rate) { this.lfo.frequency.setTargetAtTime(rate, this.ctx.currentTime, 0.1); }
  on(f0, vowel, when = this.ctx.currentTime, peak = 0.5) {
    this.osc.frequency.setTargetAtTime(f0, when, 0.02);
    this.sub.frequency.setTargetAtTime(f0, when, 0.02);
    this.setVowel(vowel, when, 0.05);
    this.out.gain.cancelScheduledValues(when);
    this.out.gain.setTargetAtTime(peak, when, 0.04);
    this.active = true;
  }
  glideTo(f0, when = this.ctx.currentTime) { this.osc.frequency.setTargetAtTime(f0, when, 0.06); this.sub.frequency.setTargetAtTime(f0, when, 0.06); }
  off(when = this.ctx.currentTime) { this.out.gain.setTargetAtTime(0.0001, when, 0.12); this.active = false; }
}

export class Engine {
  constructor() { this.ctx = null; }
  start() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    this.master.connect(comp); comp.connect(ctx.destination);
    const len = (ctx.sampleRate * 2.4) | 0, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const b = ir.getChannelData(c); for (let i = 0; i < len; i++) b[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.2; }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = ir;
    this.wet = ctx.createGain(); this.wet.gain.value = 0.4; this.reverb.connect(this.wet); this.wet.connect(this.master);
    this.pool = [];
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  voice() { const v = new Voice(this.ctx, this.master, this.reverb); this.pool.push(v); return v; }
}
