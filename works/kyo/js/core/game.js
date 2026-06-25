/* ============================================================
   興 — どんな規則でも遊べる、汎用の盤エンジン。

   ひとつの ruleset（規則）で、いくつものゲームを表す：
     N      盤の一辺（4〜7）
     place  置き方： 'anywhere' どこでも空き / 'gravity' 重力で落ちる /
                     'must' 既存の石に隣接必須 / 'never' 既存の石に隣接禁止
     win    勝利： 'align' k 個を一直線に並べた者 /
                   'majority' 挟んで反す（リバーシ系）、埋まったら多い色 /
                   'block' 打てなくなった者の負け
     k      align のときの長さ（3〜5）

   どの規則でも、合法手・着手・終局・勝者を同じ手で扱える。
   盤も規則も、ここでは DOM を知らない。
   ============================================================ */

export const EMPTY = 0, P1 = 1, P2 = 2;
export const other = (p) => 3 - p;

export function newState(rs) {
  const cells = new Int8Array(rs.N * rs.N);
  let moves = 0;
  if (rs.win === 'majority') {           // 挟みを起動するため、中央 2×2 に交互の石（リバーシ流）
    const N = rs.N, a = Math.floor((N - 1) / 2), b = a + 1;
    cells[a * N + a] = P2; cells[b * N + b] = P2; cells[a * N + b] = P1; cells[b * N + a] = P1;
    moves = 4;
  }
  return { cells, turn: P1, winner: 0, moves };
}

function count(cells, p) { let n = 0; for (let i = 0; i < cells.length; i++) if (cells[i] === p) n++; return n; }

// idx に置いた p が、k 個の一直線を作ったか。
function madeLine(cells, idx, p, k, N) {
  const r = (idx / N) | 0, c = idx % N;
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    let cnt = 1;
    for (const s of [1, -1]) {
      let rr = r + dr * s, cc = c + dc * s;
      while (rr >= 0 && rr < N && cc >= 0 && cc < N && cells[rr * N + cc] === p) { cnt++; rr += dr * s; cc += dc * s; }
    }
    if (cnt >= k) return true;
  }
  return false;
}

// 挟んで反る石（リバーシ系）。idx に p を置いたとき。
function flankFlips(cells, idx, p, N) {
  const foe = other(p), out = [];
  const r0 = (idx / N) | 0, c0 = idx % N;
  for (const dr of [-1, 0, 1]) for (const dc of [-1, 0, 1]) {
    if (!dr && !dc) continue;
    const line = [];
    let r = r0 + dr, c = c0 + dc;
    while (r >= 0 && r < N && c >= 0 && c < N) {
      const v = cells[r * N + c];
      if (v === foe) line.push(r * N + c);
      else { if (v === p && line.length) out.push(...line); break; }
      r += dr; c += dc;
    }
  }
  return out;
}

function hasNeighborStone(cells, idx, N) {
  const r = (idx / N) | 0, c = idx % N;
  for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < N && cc >= 0 && cc < N && cells[rr * N + cc] !== EMPTY) return true;
  }
  return false;
}

export function legalMoves(state, rs) {
  const { cells } = state, { N } = rs, p = state.turn, out = [];
  if (rs.win === 'majority') {
    for (let i = 0; i < cells.length; i++) if (cells[i] === EMPTY && flankFlips(cells, i, p, N).length) out.push(i);
    return out;
  }
  if (rs.place === 'gravity') {
    for (let c = 0; c < N; c++) for (let r = N - 1; r >= 0; r--) { const i = r * N + c; if (cells[i] === EMPTY) { out.push(i); break; } }
    return out;
  }
  const anyStone = state.moves > 0;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== EMPTY) continue;
    if (rs.place === 'must' && anyStone && !hasNeighborStone(cells, i, N)) continue;
    if (rs.place === 'never' && hasNeighborStone(cells, i, N)) continue;
    out.push(i);
  }
  return out;
}

export function applyMove(state, idx, rs) {
  const cells = state.cells.slice();
  const p = state.turn;
  cells[idx] = p;
  let winner = 0;
  if (rs.win === 'majority') for (const j of flankFlips(state.cells, idx, p, rs.N)) cells[j] = p;
  if (rs.win === 'align' && madeLine(cells, idx, p, rs.k, rs.N)) winner = p;
  return { cells, turn: other(p), winner, moves: state.moves + 1 };
}

/* 終局か、勝者は誰か（0=未了/引分）。majority のパスは over=false で示す。 */
export function status(state, rs) {
  if (state.winner) return { over: true, winner: state.winner };
  const my = legalMoves(state, rs);
  if (rs.win === 'align') {
    if (state.moves >= rs.N * rs.N || my.length === 0) return { over: true, winner: 0 };  // 引き分け
    return { over: false, winner: 0 };
  }
  if (rs.win === 'block') {
    if (my.length === 0) return { over: true, winner: other(state.turn) };                 // 打てない＝負け
    return { over: false, winner: 0 };
  }
  // majority
  if (my.length) return { over: false, winner: 0 };
  const opp = legalMoves({ ...state, turn: other(state.turn) }, rs);
  if (opp.length === 0) {
    const a = count(state.cells, P1), b = count(state.cells, P2);
    return { over: true, winner: a === b ? 0 : (a > b ? P1 : P2) };
  }
  return { over: false, winner: 0, pass: true };   // 自分はパス、相手は打てる
}

export const boardFull = (state, rs) => state.moves >= rs.N * rs.N;
export { count };
