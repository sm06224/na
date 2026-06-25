/* ============================================================
   興 — どんな規則でも指す、汎用の AI。

   ネガマックス＋α-β。規則の種類ごとに評価を切り替える：
     align    … k 並びへの「窓」の脅威＋中央寄り
     majority … 石差＋機動力（リバーシ系）
     block    … 機動力（相手の手を枯らす）
   乱数なし——同じ局面・同じ深さなら、同じ手（決定的）。
   ============================================================ */

import { EMPTY, P1, P2, other, legalMoves, applyMove, status, count } from './game.js';

const WIN = 1e6;

// align 用：すべての直線の長さ k の窓を見て、片色だけの窓を数える。
function alignEval(cells, N, k, p) {
  const foe = other(p);
  let s = 0;
  const windows = [];
  const lines = [];
  for (let r = 0; r < N; r++) lines.push([...Array(N)].map((_, c) => r * N + c));            // 横
  for (let c = 0; c < N; c++) lines.push([...Array(N)].map((_, r) => r * N + c));            // 縦
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {                                  // 斜め（始点のみ）
    if (r === 0 || c === 0) { const d = []; let rr = r, cc = c; while (rr < N && cc < N) { d.push(rr * N + cc); rr++; cc++; } if (d.length >= k) lines.push(d); }
    if (r === 0 || c === N - 1) { const d = []; let rr = r, cc = c; while (rr < N && cc >= 0) { d.push(rr * N + cc); rr++; cc--; } if (d.length >= k) lines.push(d); }
  }
  for (const line of lines) for (let i = 0; i + k <= line.length; i++) windows.push(line.slice(i, i + k));
  for (const w of windows) {
    let me = 0, op = 0;
    for (const i of w) { const v = cells[i]; if (v === p) me++; else if (v === foe) op++; }
    if (me && op) continue;
    if (me) s += me === k ? WIN : me * me;
    else if (op) s -= op === k ? WIN : op * op;
  }
  // 中央寄り（角より中心が強い直線を作りやすい）
  for (let i = 0; i < cells.length; i++) if (cells[i] !== EMPTY) {
    const r = (i / N) | 0, c = i % N;
    const d = (Math.abs(r - (N - 1) / 2) + Math.abs(c - (N - 1) / 2));
    s += (cells[i] === p ? -d : d) * 0.3;
  }
  return s;
}

function evalState(state, rs, p) {
  const { cells } = state, { N } = rs, foe = other(p);
  if (rs.win === 'align') return alignEval(cells, N, rs.k, p);
  if (rs.win === 'majority') {
    const diff = count(cells, p) - count(cells, foe);
    const mob = legalMoves(state, rs).length * (state.turn === p ? 1 : -1);
    return diff + 3 * mob;
  }
  // block：自分の手数を増やし相手を枯らす
  const mine = legalMoves({ ...state, turn: p }, rs).length;
  const op = legalMoves({ ...state, turn: foe }, rs).length;
  return mine - op;
}

function ordered(moves, rs) {
  const c = (rs.N - 1) / 2;
  return moves.slice().sort((a, b) => dist(a, rs.N, c) - dist(b, rs.N, c) || a - b);
}
const dist = (i, N, c) => Math.abs(((i / N) | 0) - c) + Math.abs((i % N) - c);

function negamax(state, rs, depth, alpha, beta) {
  const st = status(state, rs);
  if (st.over) return st.winner === 0 ? 0 : (st.winner === state.turn ? WIN + depth : -WIN - depth);
  if (st.pass) return -negamax({ ...state, turn: other(state.turn) }, rs, depth, -beta, -alpha);
  if (depth === 0) return evalState(state, rs, state.turn);
  let best = -Infinity;
  for (const m of ordered(legalMoves(state, rs), rs)) {
    const v = -negamax(applyMove(state, m, rs), rs, depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export function chooseMove(state, rs, opts = {}) {
  const moves = ordered(legalMoves(state, rs), rs);
  if (!moves.length) return null;
  const empties = rs.N * rs.N - state.moves;
  const depth = Math.min(opts.depth ?? 4, empties);
  let best = moves[0], bestVal = -Infinity, alpha = -Infinity;
  for (const m of moves) {
    const v = -negamax(applyMove(state, m, rs), rs, depth - 1, -Infinity, -alpha);
    if (v > bestVal) { bestVal = v; best = m; if (v > alpha) alpha = v; }
  }
  return best;
}

export function randomMove(state, rs, rng) {
  const ms = legalMoves(state, rs);
  return ms.length ? ms[Math.floor(rng() * ms.length)] : null;
}
