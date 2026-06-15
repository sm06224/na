/* ============================================================
   窟 — 音。雑音と発振器から手作りする、地の底のひびき。
   音源ファイルなし。鳴らせない環境では静かに何もしない。
   ============================================================ */

let ctx = null;
let on = true;

function ac() {
  if (!on) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function toggleSound() { on = !on; return on; }
export function soundOn() { return on; }

function tone(freq, t0, dur, type = 'sine', gain = 0.12, slideTo = null) {
  const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise(t0, dur, cutoff = 1200, gain = 0.18) {
  const a = ac(); if (!a) return;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const src = a.createBufferSource(); src.buffer = buf;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff;
  const g = a.createGain(); g.gain.value = gain;
  src.connect(lp).connect(g).connect(a.destination);
  src.start(t0);
}

const PLAY = {
  hit: a => { noise(a, 0.08, 2400, 0.16); tone(220, a, 0.06, 'square', 0.05); },
  hurt: a => { tone(160, a, 0.18, 'sawtooth', 0.12, 80); noise(a, 0.1, 600, 0.12); },
  kill: a => { tone(420, a, 0.12, 'square', 0.08, 140); },
  pickup: a => { tone(880, a, 0.06, 'triangle', 0.1); tone(1320, a + 0.05, 0.08, 'triangle', 0.09); },
  quaff: a => { tone(300, a, 0.18, 'sine', 0.1, 600); },
  zap: a => { tone(1200, a, 0.16, 'sawtooth', 0.08, 300); noise(a, 0.12, 3000, 0.06); },
  descend: a => { tone(200, a, 0.5, 'sine', 0.12, 70); noise(a, 0.4, 400, 0.06); },
  stairs: a => { tone(330, a, 0.12, 'sine', 0.08, 220); },
  level: a => { [523, 659, 784, 1046].forEach((f, i) => tone(f, a + i * 0.07, 0.18, 'triangle', 0.1)); },
  death: a => { [220, 174, 130, 98].forEach((f, i) => tone(f, a + i * 0.16, 0.4, 'sawtooth', 0.12)); },
  win: a => { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, a + i * 0.1, 0.5, 'triangle', 0.11)); },
};

export function sfx(name) {
  const a = ac(); if (!a) return;
  const fn = PLAY[name]; if (fn) fn(a.currentTime + 0.001);
}
