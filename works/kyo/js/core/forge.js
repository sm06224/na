/* ============================================================
   興 — 規則を鍛え、遊んで、面白さを測る。

   種 → ruleset（規則）。汎用エンジンと AI で何度も戦わせ、こう問う：
     技量は要るか？  巧い手はランダムに勝てるか（運ゲーでないか）
     決着するか？    引き分けばかりでないか
     公平か？        先手が勝ちすぎないか
     ほどよい長さか？
   詰まらない規則は捨て、見込みあるものに名と遊び方を与える。
   設計者のいないゲームデザイナー。すべて決定的。
   ============================================================ */

import { newState, applyMove, status, other, P1, P2 } from './game.js';
import { chooseMove, randomMove } from './ai.js';

/* ---- 種 → 乱数 → 規則 ---- */
function hashSeed(seed) {
  let h = 2166136261 >>> 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rngFrom(seed) { let a = hashSeed(seed); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const range = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

export function fromSeed(seed) {
  const rng = rngFrom(seed);
  const N = range(rng, 4, 6);
  const win = pick(rng, ['align', 'align', 'majority', 'block']);   // align をやや多めに
  const rs = { N, win, seed: String(seed) };
  if (win === 'align') {
    rs.place = pick(rng, ['anywhere', 'gravity', 'must', 'never']);
    rs.k = range(rng, 3, Math.min(N, rs.place === 'gravity' ? 4 : 5));
  } else if (win === 'block') {
    rs.place = pick(rng, ['anywhere', 'must', 'never']);
    rs.k = 0;
  } else {
    rs.place = 'flank'; rs.k = 0;   // majority は挟みが置ける条件
  }
  return rs;
}

/* ---- 名づけ（種から決まる、響きのよい綴り）---- */
export function nameOf(seed) {
  const rng = rngFrom('name:' + seed);
  const C = 'kstnhmrgzdbp', V = 'aiueo';
  const n = range(rng, 2, 3);
  let s = '';
  for (let i = 0; i < n; i++) s += C[Math.floor(rng() * C.length)] + V[Math.floor(rng() * V.length)];
  return s[0].toUpperCase() + s.slice(1);
}

/* ---- 遊び方（ルールブック）---- */
export function rulebook(rs) {
  const place = {
    anywhere: '空いている好きなマスに置く', gravity: '列の一番下（重力で落ちる位置）に置く',
    must: '既にある石に隣接して置く', never: '既にある石に隣接しないように置く', flank: '相手の石を直線で挟める場所にだけ置く',
  }[rs.place];
  const win = {
    align: `縦・横・斜めに自分の石を ${rs.k} 個つなげたら勝ち`,
    majority: '相手の石を直線で挟むと自分の色に反る。両者とも置けなくなったら、石の多い色の勝ち',
    block: '自分が置けなくなったら負け（相手の勝ち）',
  }[rs.win];
  return { board: `${rs.N}×${rs.N}`, place, win };
}

/* ---- 一局を最後まで（決定的 or 乱数）---- */
export function playGame(rs, f1, f2) {
  let s = newState(rs), len = 0;
  for (let guard = 0; guard < rs.N * rs.N * 4 + 10; guard++) {
    const st = status(s, rs);
    if (st.over) return { winner: st.winner, len };
    if (st.pass) { s = { ...s, turn: other(s.turn) }; continue; }
    const m = (s.turn === P1 ? f1 : f2)(s);
    if (m == null) return { winner: other(s.turn), len };
    s = applyMove(s, m, rs); len++;
  }
  return { winner: 0, len };
}

/* ---- 面白さを測る ---- */
export function evaluate(rs, opts = {}) {
  const G = opts.games ?? 14, depth = opts.depth ?? 3;
  const rng = rngFrom('eval:' + rs.seed);
  const rand = (s) => randomMove(s, rs, rng);
  const ai = (s) => chooseMove(s, rs, { depth });

  let smartWins = 0, smartDraws = 0, lenSum = 0, n = 0;
  for (let g = 0; g < G; g++) {
    const sFirst = g % 2 === 0;
    const r = playGame(rs, sFirst ? ai : rand, sFirst ? rand : ai);
    const smart = sFirst ? P1 : P2;
    if (r.winner === smart) smartWins++; else if (r.winner === 0) smartDraws++;
    lenSum += r.len; n++;
  }
  let p1 = 0, rrDraw = 0;
  for (let g = 0; g < G; g++) { const r = playGame(rs, rand, rand); if (r.winner === P1) p1++; else if (r.winner === 0) rrDraw++; }

  const skill = smartWins / G;                       // 技量で勝てるか（運ゲーでない）
  const drawRate = smartDraws / G;                   // 巧者どうしの引き分け率
  const p1bias = Math.abs((p1 + (G - p1 - rrDraw) * 0) / Math.max(1, G - rrDraw) - 0.5) * 2; // 先手偏り
  const avgLen = lenSum / n;
  const minLen = 3;

  // 詰まらない規則を弾く（運ゲー・即終わり・引き分けだらけ・先手必勝）
  const dead = skill < 0.6 || avgLen < minLen || drawRate > 0.75 || p1bias > 0.85;
  let fun = 0;
  if (!dead) {
    fun = 100 * skill - 45 * p1bias - 35 * Math.max(0, drawRate - 0.25)
      + 14 * Math.min(1, avgLen / (rs.N * rs.N * 0.6)) + 8;
  }
  return { skill: r2(skill), drawRate: r2(drawRate), p1bias: r2(p1bias), avgLen: r2(avgLen), fun: Math.round(fun * 10) / 10, dead };
}
const r2 = (x) => Math.round(x * 100) / 100;

/* ---- 種をいくつも試し、面白い順に並べる ---- */
export function discover(seeds, opts = {}) {
  const seen = new Set();
  const out = [];
  for (const seed of seeds) {
    const rs = fromSeed(seed);
    const key = `${rs.N}|${rs.win}|${rs.place}|${rs.k}`;
    if (seen.has(key)) continue; seen.add(key);
    const m = evaluate(rs, opts);
    out.push({ seed: String(seed), name: nameOf(seed), rs, metrics: m, book: rulebook(rs) });
  }
  out.sort((a, b) => b.metrics.fun - a.metrics.fun);
  return out;
}
