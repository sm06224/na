/* 水音 — 雑音から手づくりの、ひと雫の「ぽちゃん」。音源ファイルなし。
   大きい波紋ほど低く、ちいさな雨ほど高く澄む。 */

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

/* strength: 0（ちいさな雨）〜1（大きく落とす）。 */
export function plip(strength = 0.5) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime;
  const base = 320 + (1 - strength) * 900;     // 小さいほど高い

  // 「ぽ」：すっと下がる正弦（水滴が水面を打つ）
  const osc = a.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(base * 2.2, t0);
  osc.frequency.exponentialRampToValueAtTime(base, t0 + 0.06);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.12 + strength * 0.18, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22 + strength * 0.2);

  // 「ちゃん」：ごく短い水しぶき（帯域を絞った雑音）
  const n = Math.floor(a.sampleRate * 0.05);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const src = a.createBufferSource(); src.buffer = buf;
  const bp = a.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.value = base * 2.4; bp.Q.value = 1.2;
  const ng = a.createGain(); ng.gain.value = 0.06 + strength * 0.05;

  osc.connect(g).connect(a.destination);
  src.connect(bp).connect(ng).connect(a.destination);
  osc.start(t0); osc.stop(t0 + 0.5);
  src.start(t0);
}
