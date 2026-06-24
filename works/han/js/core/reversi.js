/* ============================================================
   反 — リバーシ（オセロ）の規則。8×8 の盤に、黒と白の石。

   手を打つと、相手の石を直線で挟んだぶんだけ、ひっくり返る（反転）。
   打てる手が無ければパス。両者とも打てなくなったら終局——多い色の勝ち。
   盤面と規則だけ。AI も DOM も、ここでは知らない。
   ============================================================ */

export const EMPTY = 0, BLACK = 1, WHITE = 2;
export const opponent = (p) => 3 - p;
export const SIZE = 8;
const DIRS = [-9, -8, -7, -1, 1, 7, 8, 9];   // 八方向（1次元 index 上）

// 端をまたぐ動きを禁じるため、各 index から各方向に進める最大歩数を前計算。
const STEPS = (() => {
  const t = Array.from({ length: 64 }, () => DIRS.map(() => 0));
  for (let i = 0; i < 64; i++) {
    const r = (i / 8) | 0, c = i % 8;
    const room = [
      Math.min(r, c),         // -9 上左
      r,                      // -8 上
      Math.min(r, 7 - c),     // -7 上右
      c,                      // -1 左
      7 - c,                  // +1 右
      Math.min(7 - r, c),     // +7 下左
      7 - r,                  // +8 下
      Math.min(7 - r, 7 - c), // +9 下右
    ];
    t[i] = room;
  }
  return t;
})();

export function initialBoard() {
  const b = new Int8Array(64);
  b[27] = WHITE; b[28] = BLACK; b[35] = BLACK; b[36] = WHITE;   // d4 e4 d5 e5
  return b;
}

// idx に player が打ったとき、ひっくり返る石の index 配列（空なら非合法）。
export function flips(board, player, idx) {
  if (board[idx] !== EMPTY) return [];
  const foe = opponent(player);
  const out = [];
  for (let d = 0; d < 8; d++) {
    const step = DIRS[d], room = STEPS[idx][d];
    const line = [];
    let p = idx;
    for (let s = 0; s < room; s++) {
      p += step;
      if (board[p] === foe) line.push(p);
      else { if (board[p] === player && line.length) out.push(...line); break; }
    }
  }
  return out;
}

export function legalMoves(board, player) {
  const moves = [];
  for (let i = 0; i < 64; i++) if (board[i] === EMPTY && flips(board, player, i).length) moves.push(i);
  return moves;
}

export function hasMove(board, player) {
  for (let i = 0; i < 64; i++) if (board[i] === EMPTY && flips(board, player, i).length) return true;
  return false;
}

// 合法手を打った新しい盤を返す（元の盤は変えない）。
export function applyMove(board, player, idx) {
  const f = flips(board, player, idx);
  if (!f.length) throw new Error('非合法な手');
  const b = board.slice();
  b[idx] = player;
  for (const j of f) b[j] = player;
  return b;
}

export const isGameOver = (board) => !hasMove(board, BLACK) && !hasMove(board, WHITE);

export function score(board) {
  let black = 0, white = 0, empty = 0;
  for (let i = 0; i < 64; i++) { const v = board[i]; if (v === BLACK) black++; else if (v === WHITE) white++; else empty++; }
  return { black, white, empty };
}

// 終局時の勝者（空マスは多い側に足す慣例）。引き分けは EMPTY。
export function winner(board) {
  const { black, white, empty } = score(board);
  const b = black + (black > white ? empty : 0);
  const w = white + (white > black ? empty : 0);
  return b === w ? EMPTY : (b > w ? BLACK : WHITE);
}

export const idxToAlg = (i) => 'abcdefgh'[i % 8] + (((i / 8) | 0) + 1);
export const algToIdx = (s) => ('abcdefgh'.indexOf(s[0])) + (Number(s[1]) - 1) * 8;
