/* 陣 — 戦の音。雑音と発振から手づくり。音源ファイルなし。 */

let actx = null;
let muted = false;
export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }
function ac() {
  if (muted) return null;
  if (!actx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; actx = new C(); }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

function tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur, vol = 0.3, lp = 1200, delay = 0) {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime + delay;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
  const g = a.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination); src.start(t0);
}

export function sfx(name) {
  switch (name) {
    case 'select': tone(620, 0.07, 'square', 0.12); break;
    case 'cancel': tone(300, 0.08, 'square', 0.1); break;
    case 'move': tone(440, 0.06, 'sine', 0.08, 540); break;
    case 'cursor': tone(720, 0.03, 'square', 0.05); break;
    case 'hit': noise(0.16, 0.34, 1600); tone(180, 0.12, 'triangle', 0.18, 90); break;
    case 'crit': noise(0.26, 0.42, 2600); tone(140, 0.22, 'sawtooth', 0.22, 70); tone(900, 0.12, 'square', 0.12, 1400); break;
    case 'miss': noise(0.22, 0.18, 900); break;
    case 'heal': tone(523, 0.18, 'sine', 0.14); tone(659, 0.22, 'sine', 0.12, null, 0.06); tone(784, 0.26, 'sine', 0.12, null, 0.12); break;
    case 'levelup': [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.14, null, i * 0.08)); break;
    case 'die': tone(300, 0.4, 'sawtooth', 0.18, 80); noise(0.4, 0.2, 600); break;
    case 'victory': [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', 0.16, null, i * 0.12)); break;
    case 'defeat': [392, 311, 262, 196].forEach((f, i) => tone(f, 0.5, 'sine', 0.16, null, i * 0.18)); break;
    case 'select2': tone(880, 0.05, 'square', 0.08); break;
  }
}
