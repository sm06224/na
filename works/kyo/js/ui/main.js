/* ============================================================
   興 — 発掘したゲームを、その場で AI と打つ。
   「別のゲームを発掘」で、装置が面白いと判じた次の規則を見つけて始める。
   どの規則でも同じ手で扱える（汎用エンジン）。すべてこの端末の中だけ。
   ============================================================ */
import { newState, legalMoves, applyMove, status, other, count, P1, P2, EMPTY } from '../core/game.js';
import { chooseMove } from '../core/ai.js';
import { fromSeed, nameOf, rulebook, evaluate } from '../core/forge.js';

const $ = (id) => document.getElementById(id);
const boardEl = $('board');

let rs, game, info, gameOver, last = -1, cursor = 0;
const human = P1, ai = P2;
let depth = 4;

// 種をたどり、装置が「面白い」と判じた次の規則を見つける。
function findFun() {
  for (let tries = 0; tries < 60; tries++) {
    const seed = 'kyo-' + (cursor++);
    const r = fromSeed(seed);
    const m = evaluate(r, { games: 8, depth: 2 });
    if (!m.dead && m.fun >= 70) return { rs: r, name: nameOf(seed), book: rulebook(r), metrics: m, seed };
  }
  const seed = 'kyo-fallback';
  const r = { N: 5, place: 'gravity', win: 'align', k: 4, seed };
  return { rs: r, name: nameOf(seed), book: rulebook(r), metrics: evaluate(r, { games: 8, depth: 2 }), seed };
}

function startGame(found) {
  if (found) info = found;
  rs = info.rs; game = newState(rs); gameOver = false; last = -1;
  renderRulebook();
  boardEl.style.gridTemplateColumns = `repeat(${rs.N}, 1fr)`;
  resolve();
}

function renderRulebook() {
  const b = info.book, m = info.metrics;
  $('rulebook').innerHTML =
    `<span class="fun">面白さ ${m.fun}</span><h2><span class="name">${info.name}</span> <span style="font-size:.7rem;color:var(--faint)">${b.board}</span></h2>` +
    `<dl><dt>置き方</dt><dd>${b.place}</dd><dt>勝ち</dt><dd>${b.win}</dd></dl>`;
}

// 人が打てる番になるまで、AI の着手と自動パスを進める。
function resolve() {
  for (let guard = 0; guard < 500; guard++) {
    const st = status(game, rs);
    if (st.over) { gameOver = true; break; }
    if (st.pass) { game = { ...game, turn: other(game.turn) }; continue; }
    if (game.turn === human) break;
    game = applyMove(game, choose(), rs); last = lastIdx;
  }
  render();
  if (gameOver) celebrate();
}
let lastIdx = -1;
function choose() { const m = chooseMove(game, rs, { depth }); lastIdx = m; return m; }

function humanPlay(idx) {
  if (gameOver || game.turn !== human) return;
  if (!legalMoves(game, rs).includes(idx)) return;
  game = applyMove(game, idx, rs); last = idx;
  render();
  setTimeout(resolve, 80);
}

function render() {
  const legal = (!gameOver && game.turn === human) ? new Set(legalMoves(game, rs)) : new Set();
  let html = '';
  for (let i = 0; i < rs.N * rs.N; i++) {
    const v = game.cells[i], playable = legal.has(i);
    html += `<div class="cell${playable ? ' playable' : ''}${i === last ? ' last' : ''}" data-i="${i}">`;
    if (v !== EMPTY) html += `<span class="disc ${v === P1 ? 'b' : 'w'} show"></span>`;
    else if (playable) html += '<span class="hint"></span>';
    html += '</div>';
  }
  boardEl.innerHTML = html;
  $('n1').textContent = count(game.cells, P1); $('n2').textContent = count(game.cells, P2);
  $('status').textContent = statusText();
}

function statusText() {
  if (gameOver) { const w = status(game, rs).winner; return w === 0 ? '引き分け' : (w === human ? 'あなたの勝ち！' : 'AI の勝ち'); }
  return game.turn === human ? 'あなたの番' : 'AI が考えています…';
}
function celebrate() {
  const w = status(game, rs).winner;
  const t = $('toast'); t.textContent = w === 0 ? '引き分け' : (w === human ? 'あなたの勝ち！' : 'AI の勝ち');
  t.classList.add('on'); clearTimeout(celebrate.t); celebrate.t = setTimeout(() => t.classList.remove('on'), 2400);
}

boardEl.addEventListener('click', (e) => { const c = e.target.closest('.cell'); if (c) humanPlay(Number(c.dataset.i)); });
$('discover').addEventListener('click', () => startGame(findFun()));
$('again').addEventListener('click', () => startGame());
$('level').addEventListener('change', () => { depth = Number($('level').value); });

// テスト用の小さな窓
window.__kyo = { legal: () => legalMoves(game, rs), play: humanPlay, moves: () => game.moves, name: () => info.name };

startGame(findFun());
