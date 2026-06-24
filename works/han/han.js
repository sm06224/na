#!/usr/bin/env node
/* ============================================================
   反 — 盤を、ターミナルで。考える相手どうしを戦わせて見せる。

     node han.js                 AI 対 AI（決定的な一局）と、対ランダムのベンチ
     node han.js --depth 6       読みの深さを変える
     node han.js --bench 100     ランダム相手に何局か戦わせ、勝率を出す

   乱数を使わない AI なので、同じ深さどうしの一局はいつも同じ。依存ゼロ。
   ============================================================ */
import { initialBoard, legalMoves, applyMove, hasMove, isGameOver, score, winner, idxToAlg, BLACK, WHITE, opponent, EMPTY } from './js/core/reversi.js';
import { chooseMove } from './js/core/ai.js';

const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

function printBoard(board, last = -1) {
  const C = (s) => `\x1b[2m${s}\x1b[0m`;
  let s = '  ' + C('a b c d e f g h') + '\n';
  for (let r = 0; r < 8; r++) {
    s += C(r + 1 + ' ');
    for (let c = 0; c < 8; c++) {
      const i = r * 8 + c, v = board[i];
      const g = v === BLACK ? '\x1b[1m●\x1b[0m' : v === WHITE ? '○' : C('·');
      s += (i === last ? `\x1b[33m${g === C('·') ? '·' : g}\x1b[0m` : g) + ' ';
    }
    s += '\n';
  }
  return s;
}

function play(blackFn, whiteFn, onMove) {
  let b = initialBoard(), p = BLACK, last = -1;
  while (!isGameOver(b)) {
    if (!hasMove(b, p)) { p = opponent(p); continue; }
    const m = (p === BLACK ? blackFn : whiteFn)(b, p);
    b = applyMove(b, p, m); last = m;
    if (onMove) onMove(p, m, b);
    p = opponent(p);
  }
  return { board: b, last };
}

function main() {
  const args = process.argv.slice(2);
  let depth = 5, benchN = 0;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--depth') depth = Number(args[++i]);
    else if (args[i] === '--bench') benchN = Number(args[++i] || 30);
  }
  const ai = (d) => (b, p) => chooseMove(b, p, { depth: d, endgame: 12 });

  if (benchN) {
    const rng = mulberry32(20260624);
    const rand = (b, p) => { const ms = legalMoves(b, p); return ms[Math.floor(rng() * ms.length)]; };
    let win = 0, draw = 0;
    for (let g = 0; g < benchN; g++) {
      const r = play(g % 2 ? rand : ai(depth), g % 2 ? ai(depth) : rand).board;
      const w = winner(r), me = g % 2 ? WHITE : BLACK;
      if (w === me) win++; else if (w === EMPTY) draw++;
    }
    process.stdout.write(`AI(深さ${depth}) 対 ランダム ${benchN}局 → 勝ち ${win} / 引分 ${draw} / 負け ${benchN - win - draw}\n`);
    return;
  }

  // 決定的な一局を清書する
  const moves = [];
  const { board, last } = play(ai(depth), ai(depth), (p, m) => moves.push((p === BLACK ? '●' : '○') + idxToAlg(m)));
  const s = score(board);
  const w = winner(board);
  process.stdout.write(`AI(深さ${depth}) 対 AI(深さ${depth})  — 決定的な一局\n\n`);
  process.stdout.write('棋譜: ' + moves.join(' ') + '\n\n');
  process.stdout.write(printBoard(board, last) + '\n');
  process.stdout.write(`結果: ● ${s.black} 対 ○ ${s.white} — ${w === EMPTY ? '引き分け' : (w === BLACK ? '● 黒の勝ち' : '○ 白の勝ち')}\n`);
}
main();
