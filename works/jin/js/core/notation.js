/* ============================================================
   陣 — 楽譜の言葉。音名の文字列を、鳴らせる音符の列にほどく。
   音源ファイルは無い——音は ui/music.js が波形から作る。ここは DOM 非依存。

   トラックは空白区切りの字句：
     音符  = 音名＋オクターブ（＋":長さ"）  例 c4  f#5  eb3:8
     休符  = r（＋":長さ"）                  例 r:4
     打 = x(バスドラ) o(スネア) h(ハイハット)（＋":長さ"）
   長さは十六分音符の数。既定は 4（四分音符）。"_" は直前の音を伸ばす（タイ）。
   ============================================================ */

const NOTE_RE = /^([a-gA-G])(#|b)?(-?\d)$/;
const SEMI = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const DRUMS = { x: 'kick', o: 'snare', h: 'hat', c: 'crash' };

export function noteToMidi(name) {
  const m = NOTE_RE.exec(name);
  if (!m) return null;
  const base = SEMI[m[1].toLowerCase()];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const oct = parseInt(m[3], 10);
  return (oct + 1) * 12 + base + acc;     // C-1 = 0（MIDI 準拠）
}
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
export function noteToFreq(name) {
  const midi = noteToMidi(name);
  return midi == null ? null : midiToFreq(midi);
}

/* 字句ひとつの中身 */
export function tokenInfo(tok) {
  if (!tok) return { type: 'rest' };
  if (tok === 'r') return { type: 'rest' };
  if (tok in DRUMS) return { type: 'drum', drum: DRUMS[tok] };
  const midi = noteToMidi(tok);
  if (midi != null) return { type: 'note', midi, freq: midiToFreq(midi) };
  return { type: 'invalid' };
}

/* トラック文字列 → { events:[{t,dur,tok,...}], length }（時間は十六分音符） */
export function parseTrack(str, transpose = 0) {
  const out = [];
  let t = 0;
  const toks = String(str).trim().split(/\s+/).filter(Boolean);
  for (const raw of toks) {
    const [head, lenStr] = raw.split(':');
    const dur = lenStr ? Math.max(1, parseInt(lenStr, 10) || 1) : 4;
    if (head === '_') {                              // タイ：直前を伸ばす
      if (out.length) out[out.length - 1].dur += dur;
      t += dur; continue;
    }
    const info = tokenInfo(head);
    if (info.type === 'note') {
      const midi = info.midi + transpose;
      out.push({ t, dur, type: 'note', midi, freq: midiToFreq(midi) });
    } else if (info.type === 'drum') {
      out.push({ t, dur, type: 'drum', drum: info.drum });
    } // rest / invalid は時間だけ進める
    t += dur;
  }
  return { events: out, length: t };
}

/* 曲ぜんたいの妥当性（テスト用）。問題があれば配列で返す。 */
export function validateSong(song) {
  const errs = [];
  if (!song.name) errs.push('name なし');
  if (!(song.bpm > 0)) errs.push('bpm が不正');
  if (!Array.isArray(song.tracks) || !song.tracks.length) errs.push('tracks なし');
  for (const tr of song.tracks || []) {
    if (!tr.inst) errs.push('inst なし');
    const toks = String(tr.data).trim().split(/\s+/).filter(Boolean);
    for (const raw of toks) {
      const head = raw.split(':')[0];
      if (head === '_') continue;
      const info = tokenInfo(head);
      if (info.type === 'invalid') errs.push(`不明な字句: ${raw}`);
    }
  }
  return errs;
}

/* 十六分音符 → 秒 */
export function stepSeconds(bpm) { return 60 / bpm / 4; }
