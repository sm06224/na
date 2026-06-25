#!/usr/bin/env node
/* ============================================================
   興 — ゲームを発掘する。種をいくつも試し、面白い順に並べて見せ、
   いちばんの一作を実際に最後まで打って見せる。

     node kyo.js                 60 種から面白いゲームを発掘して上位を表示＋実演
     node kyo.js <種>            その種のゲームの規則・面白さ・一局を見る
     node kyo.js --batch 200     もっと多くの種から探す

   設計者はいない。規則も、その面白さの判定も、ここで生まれる。依存ゼロ。
   ============================================================ */
import { fromSeed, nameOf, rulebook, evaluate, discover, playGame } from './js/core/forge.js';
import { newState, applyMove, status, other, P1, P2, EMPTY } from './js/core/game.js';
import { chooseMove, randomMove } from './js/core/ai.js';

const D = (s) => `\x1b[2m${s}\x1b[0m`;
function printBoard(state, rs) {
  let s = '';
  for (let r = 0; r < rs.N; r++) {
    s += '  ';
    for (let c = 0; c < rs.N; c++) { const v = state.cells[r * rs.N + c]; s += (v === P1 ? '\x1b[1m●\x1b[0m' : v === P2 ? '○' : D('·')) + ' '; }
    s += '\n';
  }
  return s;
}
function showBook(g) {
  const b = g.book, m = g.metrics, rs = g.rs;
  return `「${g.name}」  ${b.board}\n` +
    `  置き方： ${b.place}\n  勝ち　： ${b.win}\n` +
    `  面白さ ${m.fun}（技量 ${m.skill}・引分 ${m.drawRate}・先手偏り ${m.p1bias}・平均手数 ${m.avgLen}）\n` +
    `  種： ${rs.seed}`;
}

// その規則で一局（AI 対 AI、決定的）を打ち、最終盤と結果を返す。
function showcase(rs, depth = 4) {
  let s = newState(rs);
  const ai = (st) => chooseMove(st, rs, { depth });
  for (let g = 0; g < rs.N * rs.N * 4 + 10; g++) {
    const st = status(s, rs);
    if (st.over) return { board: printBoard(s, rs), winner: st.winner };
    if (st.pass) { s = { ...s, turn: other(s.turn) }; continue; }
    s = applyMove(s, ai(s), rs);
  }
  return { board: printBoard(s, rs), winner: 0 };
}

function main() {
  const args = process.argv.slice(2);
  let batch = 60, seed = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--batch') batch = Number(args[++i]);
    else seed = args[i];
  }

  if (seed !== null) {
    const g = { name: nameOf(seed), rs: fromSeed(seed), book: rulebook(fromSeed(seed)), metrics: evaluate(fromSeed(seed)) };
    process.stdout.write(showBook(g) + '\n\n');
    const sc = showcase(g.rs);
    process.stdout.write(sc.board + '\n結果: ' + (sc.winner === 0 ? '引き分け' : (sc.winner === P1 ? '● 先手の勝ち' : '○ 後手の勝ち')) + '\n');
    return;
  }

  const seeds = Array.from({ length: batch }, (_, i) => 'kyo-' + i);
  const ranked = discover(seeds, { games: 12, depth: 3 });
  const live = ranked.filter((g) => !g.metrics.dead);
  process.stdout.write(`${batch} 種から ${ranked.length} 規則 — 面白いと判じたのは ${live.length}、捨てたのは ${ranked.length - live.length}。\n\n`);
  process.stdout.write('=== 面白い順 ===\n');
  for (const g of live.slice(0, 6)) {
    process.stdout.write(`  ${g.name.padEnd(8)} fun ${String(g.metrics.fun).padStart(6)}  ${g.book.board} ${D(g.rs.win + (g.rs.k ? '/' + g.rs.k : '') + '/' + g.rs.place)}\n`);
  }
  const top = live[0];
  process.stdout.write('\n=== いちばんの一作 ===\n' + showBook(top) + '\n\n');
  const sc = showcase(top.rs);
  process.stdout.write(sc.board + '\n決定的な一局の結果: ' + (sc.winner === 0 ? '引き分け' : (sc.winner === P1 ? '● 先手の勝ち' : '○ 後手の勝ち')) + '\n');
}
main();
