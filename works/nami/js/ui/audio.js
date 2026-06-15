/* 水音 — 雑音と発振から手づくりの、ひと雫。音源ファイルなし。

   本物の水滴は、落ちた瞬間に空気を巻きこんだ泡が鳴る——だから音は
   ほんの少し「上がって」澄む（ぽとん→ぴとん）。大きく落とすほど低く深く、
   ちいさな雨ほど高く軽い。さらに、自前のリバーブ（複数の遅延の帰還）に
   通して、池に音が「響く」ようにする。 */

let actx = null;
let reverbIn = null;     // リバーブへの入り口
let masterWet = null;

function ac() {
  if (!actx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    actx = new C();
    buildReverb(actx);
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}

/* 池の残響 — 帰還する遅延（コムフィルタ）を重ねた、ごく小さなリバーブ */
function buildReverb(a) {
  reverbIn = a.createGain();
  masterWet = a.createGain();
  masterWet.gain.value = 0.7;
  // 互いに素に近い遅延長で、金属的にならない自然な尾を作る
  const combs = [[0.0117, 0.78], [0.0237, 0.72], [0.0411, 0.70], [0.0671, 0.66]];
  for (const [dt, fb] of combs) {
    const d = a.createDelay(0.5); d.delayTime.value = dt;
    const g = a.createGain(); g.gain.value = fb;
    const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    reverbIn.connect(d); d.connect(lp); lp.connect(g); g.connect(d);   // 帰還ループ
    lp.connect(masterWet);
  }
  // 仕上げに軽い高域落とし（水中の丸い響き）
  const tame = a.createBiquadFilter(); tame.type = 'lowpass'; tame.frequency.value = 3200;
  masterWet.connect(tame).connect(a.destination);
}

/* ひと雫を鳴らす。strength: 0（ちいさな雨）〜1（長押しの大波）。 */
export function plip(strength = 0.4) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime;
  const s = Math.max(0, Math.min(1, strength));
  const f = 1000 - s * 720;                 // 大きいほど低い（1000→280Hz）
  const dur = 0.18 + s * 0.5;
  const vol = 0.10 + s * 0.42;

  // 泡の鳴り：すこし上がって澄む正弦
  const osc = a.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f * 0.82, t0);
  osc.frequency.exponentialRampToValueAtTime(f * 1.32, t0 + 0.045 + s * 0.05);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  // 水面を打つ「ぴと」：ごく短い帯域雑音
  const n = Math.floor(a.sampleRate * 0.045);
  const buf = a.createBuffer(1, n, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.5);
  const src = a.createBufferSource(); src.buffer = buf;
  const bp = a.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.value = f * 2.1; bp.Q.value = 0.9;
  const ng = a.createGain(); ng.gain.value = 0.05 + s * 0.05;

  // 残響へ送る量は、大きい雫ほど多い（大波ほどよく響く）
  const send = a.createGain(); send.gain.value = 0.22 + s * 0.55;

  osc.connect(g); src.connect(bp).connect(ng);
  g.connect(a.destination); ng.connect(a.destination);   // 直（dry）
  g.connect(send); ng.connect(send); send.connect(reverbIn);   // 響き（wet）

  osc.start(t0); osc.stop(t0 + dur + 0.05);
  src.start(t0);
}

/* 長押し中の「ためる」気配 — 押すほど低く深くなる、ごく小さな含み音。 */
let charge = null;
export function startCharge() {
  const a = ac();
  if (!a || charge) return;
  const osc = a.createOscillator(); osc.type = 'sine'; osc.frequency.value = 240;
  const g = a.createGain(); g.gain.value = 0.0001;
  osc.connect(g); g.connect(reverbIn); g.connect(a.destination);
  osc.start();
  charge = { osc, g };
}
export function updateCharge(strength) {
  if (!charge || !actx) return;
  const t = actx.currentTime;
  const s = Math.max(0, Math.min(1, strength));
  charge.osc.frequency.setTargetAtTime(240 - s * 150, t, 0.08);   // 押すほど深く
  charge.g.gain.setTargetAtTime(0.012 + s * 0.05, t, 0.08);
}
export function stopCharge() {
  if (!charge || !actx) return;
  const t = actx.currentTime;
  const c = charge; charge = null;
  c.g.gain.setTargetAtTime(0.0001, t, 0.05);
  c.osc.stop(t + 0.3);
}
