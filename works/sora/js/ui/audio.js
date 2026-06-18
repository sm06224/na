/* ============================================================
   宙 — audio. メガデモの声。Web Audio、依存ゼロ、音源ファイルなし。
   コアの楽譜(music.js)を先読みスケジューラで鳴らす。場面ごとに
   どのトラックを鳴らすか（編成）を変える。残響はノイズから手作り。
   ============================================================ */

import { notesAtStep, STEP } from '../core/music.js';

export class Engine {
  constructor() { this.ctx = null; this.running = false; this.scene = 'title'; }

  start() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain(); this.master.gain.value = 0.7;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    this.master.connect(comp); comp.connect(ctx.destination);

    // 残響
    const len = (ctx.sampleRate * 2.0) | 0;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const b = ir.getChannelData(c); for (let i = 0; i < len; i++) b[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.5; }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = ir;
    this.wet = ctx.createGain(); this.wet.gain.value = 0.35; this.reverb.connect(this.wet); this.wet.connect(this.master);

    // 共有ノイズ
    const nlen = (ctx.sampleRate * 0.4) | 0;
    this.noise = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = this.noise.getChannelData(0); for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;

    // リードのディレイ
    this.delay = ctx.createDelay(); this.delay.delayTime.value = STEP * 3;
    this.fb = ctx.createGain(); this.fb.gain.value = 0.33;
    this.delay.connect(this.fb); this.fb.connect(this.delay); this.delay.connect(this.master);

    this.t0 = ctx.currentTime + 0.12;
    this.nextStep = 0;
    this.running = true;
    this.timer = setInterval(() => this._schedule(), 25);
    this._schedule();
  }

  now() { return this.ctx ? this.ctx.currentTime - this.t0 : 0; }
  setScene(id) { this.scene = id; }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  /* 場面ごとの編成（どのトラックを鳴らすか）。 */
  _arr() {
    const s = this.scene;
    return {
      drums: s !== 'title',
      bass: s !== 'title',
      lead: s === 'planet' || s === 'tunnel' || s === 'greets' || s === 'warp',
      pad: s === 'title' || s === 'nebula' || s === 'greets',
      hat: s === 'warp' || s === 'planet' || s === 'tunnel',
    };
  }

  _schedule() {
    if (!this.running) return;
    const ctx = this.ctx, ahead = ctx.currentTime + 0.1;
    while (this.t0 + this.nextStep * STEP < ahead) {
      const at = this.t0 + this.nextStep * STEP;
      this._play(notesAtStep(this.nextStep), at);
      this.nextStep++;
    }
  }

  _play(n, at) {
    const a = this._arr();
    if (a.drums && n.kick) this._kick(at);
    if (a.drums && n.snare) this._snare(at);
    if (a.hat && n.hat) this._hat(at);
    if (a.bass && n.bass) this._bass(n.bass, at);
    if (a.lead && n.lead) this._lead(n.lead, at);
    if (a.pad && n.pad) this._pad(n.pad, at);
  }

  _env(node, at, peak, dur, atk = 0.005) {
    const g = node.gain; g.setValueAtTime(0.0001, at);
    g.exponentialRampToValueAtTime(peak, at + atk);
    g.exponentialRampToValueAtTime(0.0001, at + dur);
  }
  _kick(at) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.setValueAtTime(140, at); o.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    this._env(g, at, 0.9, 0.3); o.connect(g); g.connect(this.master); o.start(at); o.stop(at + 0.32);
  }
  _noiseSrc() { const s = this.ctx.createBufferSource(); s.buffer = this.noise; return s; }
  _snare(at) {
    const s = this._noiseSrc(), bp = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 1800; this._env(g, at, 0.5, 0.2);
    s.connect(bp); bp.connect(g); g.connect(this.master); s.start(at); s.stop(at + 0.2);
  }
  _hat(at) {
    const s = this._noiseSrc(), hp = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 7000; this._env(g, at, 0.25, 0.05);
    s.connect(hp); hp.connect(g); g.connect(this.master); s.start(at); s.stop(at + 0.06);
  }
  _bass(f, at) {
    const o = this.ctx.createOscillator(), lp = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 600;
    this._env(g, at, 0.5, 0.22, 0.01); o.connect(lp); lp.connect(g); g.connect(this.master);
    o.start(at); o.stop(at + 0.24);
  }
  _lead(f, at) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'square'; o.frequency.value = f; this._env(g, at, 0.28, 0.25, 0.008);
    o.connect(g); g.connect(this.master); g.connect(this.delay); o.start(at); o.stop(at + 0.27);
  }
  _pad(freqs, at) {
    for (const f of freqs) {
      const o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = f; o2.frequency.value = f * 1.006;
      const dur = STEP * 16 * 1.0;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.1, at + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g); o2.connect(g); g.connect(this.wet ? this.reverb : this.master); g.connect(this.master);
      o.start(at); o2.start(at); o.stop(at + dur); o2.stop(at + dur);
    }
  }
}
