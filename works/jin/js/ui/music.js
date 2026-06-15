/* 陣 — 音楽。波形から作るチップチューン。音源ファイルなし。
   songs.js の譜面を、先読みスケジューラで途切れなく鳴らし、ループする。 */

import { SONGS } from '../core/songs.js';
import { parseTrack, stepSeconds } from '../core/notation.js';

let ctx = null, master = null, muted = false;
let current = null;          // { id, voices, loopSec, base, nextLoop, timer }

function ac() {
  if (muted) return null;
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function setMusicMuted(m) {
  muted = m;
  if (m) stopMusic();
}

/* 一音を鳴らす（楽器ごとに音色を変える） */
function voice(inst, freq, t0, dur, vol) {
  const a = ctx;
  const g = a.createGain();
  g.connect(master);
  const peak = vol;
  if (inst === 'drum') return; // drum は別経路

  let type = 'square';
  if (inst === 'triangle' || inst === 'bass') type = 'triangle';
  else if (inst === 'saw') type = 'sawtooth';
  else if (inst === 'square2' || inst === 'pulse') type = 'square';

  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  // ビブラート（リード系に軽く）
  if (inst === 'square' || inst === 'square2' || inst === 'saw') {
    const lfo = a.createOscillator(), lg = a.createGain();
    lfo.frequency.value = 5.5; lg.gain.value = freq * 0.006;
    lfo.connect(lg).connect(o.frequency); lfo.start(t0); lfo.stop(t0 + dur);
  }
  const atk = 0.008, rel = Math.min(0.12, dur * 0.4);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
  g.gain.setValueAtTime(peak, Math.max(t0 + atk, t0 + dur - rel));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function drum(kind, t0, vol) {
  const a = ctx;
  if (kind === 'hat' || kind === 'snare' || kind === 'crash') {
    const dur = kind === 'crash' ? 0.3 : kind === 'snare' ? 0.14 : 0.05;
    const n = Math.floor(a.sampleRate * dur);
    const buf = a.createBuffer(1, n, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, kind === 'hat' ? 4 : 2);
    const src = a.createBufferSource(); src.buffer = buf;
    const hp = a.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = kind === 'snare' ? 1200 : 6000;
    const g = a.createGain(); g.gain.value = vol * (kind === 'hat' ? 0.5 : 0.8);
    src.connect(hp).connect(g).connect(master); src.start(t0);
  }
  if (kind === 'kick' || kind === 'snare') {
    const o = a.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(kind === 'kick' ? 150 : 240, t0);
    o.frequency.exponentialRampToValueAtTime(kind === 'kick' ? 45 : 120, t0 + 0.12);
    const g = a.createGain();
    g.gain.setValueAtTime(vol * (kind === 'kick' ? 0.9 : 0.4), t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + 0.2);
  }
}

function scheduleLoop(base) {
  const stepSec = current.stepSec;
  for (const v of current.voices) {
    for (const e of v.events) {
      const t0 = base + e.t * stepSec;
      const dur = e.dur * stepSec;
      if (e.type === 'note') voice(v.inst, e.freq, t0, dur * 0.95, v.vol);
      else if (e.type === 'drum') drum(e.drum, t0, v.vol);
    }
  }
}

function tick() {
  if (!current || !ctx) return;
  const lookahead = 0.4;
  while (current.base + current.nextLoop * current.loopSec < ctx.currentTime + lookahead) {
    scheduleLoop(current.base + current.nextLoop * current.loopSec);
    current.nextLoop++;
    if (!current.loopSec) break;         // ワンショット（ループ長0）
  }
}

export function playMusic(id) {
  const a = ac();
  if (!a) return;
  if (current && current.id === id) return;     // 同じ曲なら続ける
  stopMusic();
  const s = SONGS[id];
  if (!s) return;
  const stepSec = stepSeconds(s.bpm);
  let maxLen = 0;
  const voices = s.tracks.map(tr => {
    const { events, length } = parseTrack(tr.data, tr.transpose || 0);
    maxLen = Math.max(maxLen, length);
    return { inst: tr.inst, vol: tr.vol ?? 0.3, events };
  });
  const loopSteps = s.loop === false ? 0 : (s.loopSteps || maxLen);
  current = {
    id, voices, stepSec,
    loopSec: loopSteps * stepSec,
    base: a.currentTime + 0.08,
    nextLoop: 0,
    timer: setInterval(tick, 60),
  };
  tick();
}

export function stopMusic() {
  if (current) { clearInterval(current.timer); current = null; }
  // 既に鳴っている音は短く減衰
  if (master && ctx) {
    try {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
      master.gain.setValueAtTime(0.5, ctx.currentTime + 0.16);
    } catch { /* noop */ }
  }
}

export function nowPlaying() { return current && current.id; }
