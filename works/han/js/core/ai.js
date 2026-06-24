/* ============================================================
   反 — 無から立ち上がる「考える相手」。

   ネガマックス＋α-β枝刈り。盤の位置に重み（隅は宝、隅の隣は罠）、
   打てる手の多さ（機動力）を読み、終盤は最後まで読み切って石差を最大化する。
   乱数は使わない——同じ局面からは、いつも同じ最善手（決定的）。
   ============================================================ */

import { EMPTY, BLACK, WHITE, opponent, legalMoves, applyMove, isGameOver, flips } from './reversi.js';

// オセロの定番の位置評価（隅 100、隅の隣＝危険はマイナス）。
const W = [
  120, -20, 20, 5, 5, 20, -20, 120,
  -20, -40, -5, -5, -5, -5, -40, -20,
  20, -5, 15, 3, 3, 15, -5, 20,
  5, -5, 3, 3, 3, 3, -5, 5,
  5, -5, 3, 3, 3, 3, -5, 5,
  20, -5, 15, 3, 3, 15, -5, 20,
  -20, -40, -5, -5, -5, -5, -40, -20,
  120, -20, 20, 5, 5, 20, -20, 120,
];
const WIN = 1e6;

function discDiff(board, player) {
  let me = 0, foe = 0;
  for (let i = 0; i < 64; i++) { const v = board[i]; if (v === player) me++; else if (v !== EMPTY) foe++; }
  return me - foe;
}
function emptyCount(board) { let e = 0; for (let i = 0; i < 64; i++) if (board[i] === EMPTY) e++; return e; }

// 局面の良さ（player から見て）。位置の重み＋機動力。終局は石差が圧倒的に効く。
export function evaluate(board, player) {
  const foe = opponent(player);
  let pos = 0;
  for (let i = 0; i < 64; i++) { const v = board[i]; if (v === player) pos += W[i]; else if (v === foe) pos -= W[i]; }
  const mob = legalMoves(board, player).length - legalMoves(board, foe).length;
  const empties = emptyCount(board);
  return pos + (empties > 12 ? 12 * mob : 4 * mob + discDiff(board, player));
}

// 角に近い手から見る（枝刈りが効く・決定的な順）。
function ordered(board, player) {
  return legalMoves(board, player).sort((a, b) => W[b] - W[a] || a - b);
}

function negamax(board, player, depth, alpha, beta) {
  if (isGameOver(board)) {
    const d = discDiff(board, player);
    return d > 0 ? WIN + d : d < 0 ? -WIN + d : 0;
  }
  if (depth === 0) return evaluate(board, player);
  const moves = ordered(board, player);
  if (!moves.length) return -negamax(board, opponent(player), depth, -beta, -alpha);   // パス
  let best = -Infinity;
  for (const m of moves) {
    const v = -negamax(applyMove(board, player, m), opponent(player), depth - 1, -beta, -alpha);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export const LEVELS = { やさしい: 1, ふつう: 3, つよい: 5, 鬼: 7 };

/* 最善手を選ぶ。終盤（空きが endgame 以下）は最後まで読み切る。
   同点の手は盤の順で安定に選ぶ＝決定的。 */
export function chooseMove(board, player, opts = {}) {
  const moves = ordered(board, player);
  if (!moves.length) return null;
  if (moves.length === 1) return moves[0];
  const empties = emptyCount(board);
  const endgame = opts.endgame ?? 10;
  const depth = empties <= endgame ? empties : (opts.depth ?? 5);

  let best = moves[0], bestVal = -Infinity, alpha = -Infinity;
  for (const m of moves) {
    const v = -negamax(applyMove(board, player, m), opponent(player), depth - 1, -Infinity, -alpha);
    if (v > bestVal) { bestVal = v; best = m; if (v > alpha) alpha = v; }
  }
  return best;
}
