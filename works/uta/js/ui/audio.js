import { noteFreq, noteDur } from '../core/scale.js';

/* ============================================================
   演奏 — 世界の歌を、実際の音にする。
   五音音階なので、どの群のどの歌が重なっても協和する。
   Web Audio、依存ゼロ。
   ============================================================ */

export class Player {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
  }

  /* AudioContext はユーザー操作の中で作る（自動再生制限への礼儀） */
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) this.ensure();
  }

  /* 旋律をひとつ歌う。pan: -1..1（群の居場所）、vel: 0..1（声の大きさ）。
     返り値は演奏の長さ（秒）。 */
  play(melody, { pan = 0, vel = 0.5, unit = 0.21, base = 261.63 } = {}) {
    if (!this.enabled || !this.ctx) return 0;
    const t0 = this.ctx.currentTime + 0.03;
    let t = t0;

    const out = this.ctx.createGain();
    out.gain.value = 1;
    let tail = out;
    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      out.connect(panner);
      tail = panner;
    }
    // 遠くの歌のように、すこし丸めて
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    tail.connect(lp);
    lp.connect(this.master);

    for (const n of melody) {
      const dur = noteDur(n) * unit;
      const f = noteFreq(n, base);
      // 声めいた音：基音（三角波）＋かすかなオクターブ上（正弦波）
      for (const [type, ratio, g0] of [['triangle', 1, 0.3], ['sine', 2, 0.06]]) {
        const osc = this.ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(f * ratio, t);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(vel * g0, t + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.96);
        osc.connect(g);
        g.connect(out);
        osc.start(t);
        osc.stop(t + dur);
      }
      t += dur;
    }
    const total = t - t0;
    setTimeout(() => { lp.disconnect(); }, (total + 1.5) * 1000);
    return total;
  }
}
