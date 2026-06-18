/* ============================================================
   宙 — director. メガデモの演出表（タイムライン）。
   どの場面を、いつ、どれだけ。場面のあいだは溶暗でつなぐ。
   時刻 t（秒）の純関数。全体は total 秒でループする。
   ============================================================ */

export const FADE = 1.6;   // 場面の変わり目の溶暗（秒）

export const SCENES = [
  { id: 'title',   name: '起動',           dur: 11 },   // タイトル＋星の点火
  { id: 'warp',    name: 'ワープ',         dur: 18 },   // 3D 星空、加速して超光速へ
  { id: 'nebula',  name: '星雲',           dur: 20 },   // プラズマの星雲
  { id: 'planet',  name: '惑星',           dur: 20 },   // 回るベクターボールの惑星
  { id: 'tunnel',  name: 'ワームホール',   dur: 18 },   // トンネル
  { id: 'greets',  name: '挨拶',           dur: 24 },   // グリーティング・スクローラー
];

export const TOTAL = SCENES.reduce((a, s) => a + s.dur, 0);

const STARTS = (() => {
  const a = []; let acc = 0;
  for (const s of SCENES) { a.push(acc); acc += s.dur; }
  return a;
})();

/* sceneAt(t) → 現在の場面と、変わり目の溶暗。
   { i, id, name, local, dur, u, blend:{to,k}|null } */
export function sceneAt(t) {
  const tt = ((t % TOTAL) + TOTAL) % TOTAL;
  let i = SCENES.length - 1;
  for (let k = 0; k < SCENES.length; k++) {
    if (tt < STARTS[k] + SCENES[k].dur) { i = k; break; }
  }
  const local = tt - STARTS[i];
  const dur = SCENES[i].dur;
  const u = local / dur;
  let blend = null;
  const left = dur - local;
  if (left < FADE) {
    const to = (i + 1) % SCENES.length;
    blend = { to, k: 1 - left / FADE };       // 0→1 で次の場面へ
  }
  return { i, id: SCENES[i].id, name: SCENES[i].name, local, dur, u, blend, t: tt };
}

/* 各場面の「盛り上がり」0..1（音楽の厚みを決めるのに使う）。 */
export function intensityAt(t) {
  const s = sceneAt(t);
  const base = { title: 0.25, warp: 0.7, nebula: 0.5, planet: 0.85, tunnel: 1.0, greets: 0.6 }[s.id] ?? 0.5;
  // 場面の入りで少し持ち上がる
  const rise = Math.min(1, s.local / 2);
  return Math.max(0, Math.min(1, base * (0.6 + 0.4 * rise)));
}
