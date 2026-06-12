/* ============================================================
   音 — 4 チャンネルの小さな喉。

   毎フレーム devices.sound を読み、Web Audio に橋を架ける。
   矩形・三角・鋸は OscillatorNode、雑音は輪にした白色雑音の
   バッファ。AudioContext は人の手（電源ボタン）でしか生まれない。
   ※ DUTY（矩形のデューティ比）は今は聴き分けられない。50% のみ。
   ============================================================ */

const WAVES = ['square', 'triangle', 'sawtooth'];
const SMOOTH = 0.012;   // 音量の角を丸める秒数（プチッと言わせない）

export class AudioOut {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ch = [];
    this.muted = false;
  }

  /* ユーザー操作の中で呼ぶこと。二度目からは目を覚まさせるだけ */
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);

    /* 1 秒の白色雑音を輪にして全チャンネルで分け合う */
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 440;
      const og = ctx.createGain(); og.gain.value = 0;
      osc.connect(og).connect(this.master);
      osc.start();

      const noi = ctx.createBufferSource();
      noi.buffer = noiseBuf; noi.loop = true;
      const ng = ctx.createGain(); ng.gain.value = 0;
      noi.connect(ng).connect(this.master);
      noi.start();

      this.ch.push({ osc, og, noi, ng, type: 'square' });
    }
  }

  /* devices.sound（{freq,vol,wave,duty} × 4）を喉に伝える */
  update(sound) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < this.ch.length; i++) {
      const s = sound[i], c = this.ch[i];
      const on = s.freq > 0 && s.vol > 0;
      const g = on ? (s.vol / 15) * 0.12 : 0;
      if (s.wave === 3) {
        c.og.gain.setTargetAtTime(0, t, SMOOTH);
        c.ng.gain.setTargetAtTime(g, t, SMOOTH);
        if (on) {
          /* 周波数を再生速度に写す。厳密ではないが、高い音は高く聞こえる */
          const rate = Math.min(8, Math.max(0.05, s.freq / 440));
          c.noi.playbackRate.setTargetAtTime(rate, t, SMOOTH);
        }
      } else {
        const type = WAVES[s.wave] ?? 'square';
        if (type !== c.type) { c.osc.type = type; c.type = type; }
        if (on) {
          const f = Math.min(this.ctx.sampleRate / 2 - 1, s.freq);
          c.osc.frequency.setTargetAtTime(f, t, 0.004);
        }
        c.ng.gain.setTargetAtTime(0, t, SMOOTH);
        c.og.gain.setTargetAtTime(g, t, SMOOTH);
      }
    }
  }

  /* 全部の口を閉じる（停止・一時停止のとき） */
  silence() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const c of this.ch) {
      c.og.gain.setTargetAtTime(0, t, SMOOTH);
      c.ng.gain.setTargetAtTime(0, t, SMOOTH);
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, SMOOTH);
  }
}
