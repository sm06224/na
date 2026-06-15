/* 陣 — 音楽。波形から作るチップチューン。打ち込みらしく、堅く・締めて鳴らす。
   要点：音符は「直前」に逐次予約し、鳴っている音は止められるよう控える。
   だから曲を切り替えても、前の曲が裏で鳴りつづけて濁ることがない。 */

import { SONGS } from '../core/songs.js';
import { parseTrack, stepSeconds } from '../core/notation.js';

let ctx = null, master = null, muted = false;
let cur = null;     // { id, seq, loopSteps, stepSec, loopSec, loopStart, i, timer, nodes }

function ac() {
  if (muted) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.42;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
export function setMusicMuted(m) { muted = m; if (m) stopMusic(); }

function track(node) { if (cur) cur.nodes.push(node); }

/* 旋律・伴奏の一音（堅い矩形/三角、短めの減衰で打ち込み感） */
function voice(inst, freq, t0, dur, vol) {
  const a = ctx;
  let type = 'square';
  if (inst === 'triangle' || inst === 'bass') type = 'triangle';
  else if (inst === 'saw') type = 'sawtooth';
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  const g = a.createGain();
  const peak = vol;
  const atk = 0.004, hold = Math.min(dur * 0.55, 0.16), rel = Math.min(0.09, dur * 0.4);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
  g.gain.setValueAtTime(peak, t0 + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(hold + 0.02, dur - rel));
  // パルス幅をずらした薄い重ねで芯を太く（detune）
  if (inst === 'square2' || inst === 'pulse' || inst === 'saw') {
    const o2 = a.createOscillator(); o2.type = type; o2.frequency.setValueAtTime(freq, t0); o2.detune.value = 8;
    const g2 = a.createGain(); g2.gain.value = peak * 0.5;
    g2.gain.setValueAtTime(0.0001, t0); g2.gain.exponentialRampToValueAtTime(peak * 0.5, t0 + atk);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o2.connect(g2).connect(master); o2.start(t0); o2.stop(t0 + dur + 0.02); track(o2);
  }
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
  track(o);
}

function drum(kind, t0, vol) {
  const a = ctx;
  if (kind === 'hat' || kind === 'snare' || kind === 'crash') {
    const dur = kind === 'crash' ? 0.25 : kind === 'snare' ? 0.13 : 0.04;
    const n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, kind === 'hat' ? 5 : 2);
    const src = a.createBufferSource(); src.buffer = buf;
    const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = kind === 'snare' ? 1400 : 7000;
    const g = a.createGain(); g.gain.value = vol * (kind === 'hat' ? 0.45 : 0.7);
    src.connect(hp).connect(g).connect(master); src.start(t0); track(src);
  }
  if (kind === 'kick' || kind === 'snare') {
    const o = a.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(kind === 'kick' ? 160 : 250, t0);
    o.frequency.exponentialRampToValueAtTime(kind === 'kick' ? 42 : 110, t0 + 0.1);
    const g = a.createGain();
    g.gain.setValueAtTime(vol * (kind === 'kick' ? 1.0 : 0.45), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.18); track(o);
  }
}

function scheduleEvent(ev, when) {
  if (ev.type === 'note') voice(ev.inst, ev.freq, when, ev.dur, ev.vol);
  else drum(ev.drum, when, ev.vol);
}

function tick() {
  if (!cur || !ctx) return;
  const lookahead = 0.16;
  for (let guard = 0; guard < 256; guard++) {
    if (cur.i >= cur.seq.length) {
      if (!cur.loopSteps) return;            // ワンショットは打ち止め
      cur.loopStart += cur.loopSec; cur.i = 0;
    }
    const ev = cur.seq[cur.i];
    const when = cur.loopStart + ev.t * cur.stepSec;
    if (when >= ctx.currentTime + lookahead) break;
    if (when >= ctx.currentTime - 0.02) scheduleEvent(ev, Math.max(when, ctx.currentTime));
    cur.i++;
  }
  // 終わった音の参照を間引く
  if (cur.nodes.length > 400) cur.nodes.splice(0, cur.nodes.length - 200);
}

export function playMusic(id) {
  const a = ac();
  if (!a) return;
  if (cur && cur.id === id) return;
  stopMusic();
  const s = SONGS[id];
  if (!s) return;
  const stepSec = stepSeconds(s.bpm);
  let maxLen = 0;
  const seq = [];
  for (const tr of s.tracks) {
    const { events, length } = parseTrack(tr.data, tr.transpose || 0);
    maxLen = Math.max(maxLen, length);
    for (const e of events) {
      if (e.type === 'note') seq.push({ t: e.t, dur: e.dur * stepSec * 0.92, type: 'note', inst: tr.inst, freq: e.freq, vol: tr.vol ?? 0.3 });
      else if (e.type === 'drum') seq.push({ t: e.t, type: 'drum', drum: e.drum, vol: tr.vol ?? 0.3 });
    }
  }
  seq.sort((p, q) => p.t - q.t);
  const loopSteps = s.loop === false ? 0 : (s.loopSteps || maxLen);
  cur = { id, seq, loopSteps, stepSec, loopSec: loopSteps * stepSec, loopStart: a.currentTime + 0.06, i: 0, timer: setInterval(tick, 40), nodes: [] };
  tick();
}

export function stopMusic() {
  if (!cur) return;
  clearInterval(cur.timer);
  const now = ctx ? ctx.currentTime : 0;
  for (const n of cur.nodes) { try { n.stop(now); } catch { /* 既に停止 */ } }
  cur = null;
}

export function nowPlaying() { return cur && cur.id; }
