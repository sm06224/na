/* 雷鳴 — 雑音から手作りの、ひと鳴り。音源ファイルなし。
   落雷点が遠いほど、光（閃光）から音までの間が空く（音は秒速約 340m）。 */

let ctx = null;
function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/* nearness: 0（遠い）〜1（近い）。近いほど鋭く、間も短い。 */
export function thunder(nearness = 0.5) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime;
  const delay = 0.05 + (1 - nearness) * 1.1;        // 閃光からの間（s）
  const dur = 1.4 + (1 - nearness) * 2.2;           // 長く尾を引く轟き

  // 雑音バッファ（一度きり生成）
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;            // 低めに寄せた褐色雑音
    const env = Math.pow(1 - i / n, 2.2);           // 減衰
    // ゴロゴロと不規則にうねらせる
    const rumble = 0.6 + 0.4 * Math.sin(i * 0.0006 + Math.sin(i * 0.00007) * 6);
    d[i] = (last * 3 + white * 0.25) * env * rumble;
  }
  const src = a.createBufferSource();
  src.buffer = buf;

  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 240 + nearness * 900;        // 近いほど高い成分も
  const hp = a.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 28;

  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0 + delay);
  g.gain.exponentialRampToValueAtTime(0.5 + nearness * 0.4, t0 + delay + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + dur);

  // 近い雷は最初に「パリッ」と鋭い前打ちを足す
  if (nearness > 0.55) {
    const crack = a.createOscillator();
    crack.type = 'square';
    crack.frequency.setValueAtTime(900, t0 + delay);
    crack.frequency.exponentialRampToValueAtTime(120, t0 + delay + 0.09);
    const cg = a.createGain();
    cg.gain.setValueAtTime(0.18 * nearness, t0 + delay);
    cg.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.12);
    crack.connect(cg).connect(lp);
    crack.start(t0 + delay); crack.stop(t0 + delay + 0.13);
  }

  src.connect(hp).connect(lp).connect(g).connect(a.destination);
  src.start(t0 + delay);
  return delay;
}
