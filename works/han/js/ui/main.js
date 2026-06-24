/* ============================================================
   反 — 盤を打つ手。あなたが石を置くと、相手（AI）が考えて返す。
   打てる手には小さな印。隅を取れば近づく。すべてこの端末の中だけ。
   ============================================================ */
import { initialBoard, legalMoves, applyMove, hasMove, isGameOver, score, winner, flips, BLACK, WHITE, opponent, EMPTY } from '../core/reversi.js';
import { chooseMove } from '../core/ai.js';

const $ = (id) => document.getElementById(id);
const boardEl = $('board');

let board, turn, human, depth, gameOver, last = -1, showHints = true, thinking = false;

function newGame() {
  board = initialBoard();
  turn = BLACK;
  human = Number($('side').value);
  depth = Number($('level').value);
  gameOver = false; last = -1;
  resolve();
}

// 人が打てる番（合法手あり）になるまで、AI の着手と自動パスを進める。
function resolve() {
  while (!isGameOver(board)) {
    if (turn === human) {
      if (hasMove(board, human)) { render(); return; }
      turn = opponent(turn);            // 人は打てない → パス
    } else {
      if (hasMove(board, turn)) {
        const m = chooseMove(board, turn, { depth });
        board = applyMove(board, turn, m); last = m;
      }
      turn = opponent(turn);
    }
  }
  gameOver = true; render(); celebrate();
}

function humanPlay(idx) {
  if (gameOver || thinking || turn !== human) return;
  if (!flips(board, human, idx).length) return;
  board = applyMove(board, human, idx); last = idx;
  turn = opponent(turn);
  thinking = true; render();                 // 「考え中」を見せてから
  setTimeout(() => { thinking = false; resolve(); }, 90);
}

function render() {
  const legal = (!gameOver && turn === human && !thinking) ? new Set(legalMoves(board, human)) : new Set();
  let html = '';
  for (let i = 0; i < 64; i++) {
    const v = board[i];
    const cls = v === BLACK ? 'b' : v === WHITE ? 'w' : '';
    const playable = legal.has(i);
    html += `<div class="cell${playable ? ' playable' : ''}${i === last ? ' last' : ''}" data-i="${i}">`;
    if (v !== EMPTY) html += `<span class="disc ${cls} show"></span>`;
    else if (playable && showHints) html += '<span class="hint"></span>';
    html += '</div>';
  }
  boardEl.innerHTML = html;
  const s = score(board);
  $('n-black').textContent = s.black; $('n-white').textContent = s.white;
  $('s-black').classList.toggle('turn', !gameOver && turn === BLACK);
  $('s-white').classList.toggle('turn', !gameOver && turn === WHITE);
  $('status').textContent = statusText(s);
}

function statusText(s) {
  if (gameOver) {
    const w = winner(board);
    return w === EMPTY ? '引き分け' : (w === human ? 'あなたの勝ち！' : 'AI の勝ち');
  }
  if (thinking || turn !== human) return 'AI が考えています…';
  return 'あなたの番';
}

function celebrate() {
  const w = winner(board);
  const t = $('toast');
  t.textContent = w === EMPTY ? '引き分け' : (w === human ? 'あなたの勝ち！' : 'AI の勝ち');
  t.classList.add('on'); clearTimeout(celebrate.t); celebrate.t = setTimeout(() => t.classList.remove('on'), 2600);
}

boardEl.addEventListener('click', (e) => {
  const c = e.target.closest('.cell');
  if (c) humanPlay(Number(c.dataset.i));
});
$('newgame').addEventListener('click', newGame);
$('level').addEventListener('change', () => { depth = Number($('level').value); });
$('side').addEventListener('change', newGame);
$('hint').addEventListener('click', () => { showHints = !showHints; $('hint').classList.toggle('on', showHints); render(); });

newGame();
