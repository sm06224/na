import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialBoard, legalMoves, flips, applyMove, hasMove, isGameOver, score, winner,
  idxToAlg, algToIdx, BLACK, WHITE, EMPTY, opponent,
} from '../js/core/reversi.js';
import { chooseMove } from '../js/core/ai.js';

const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function playGame(blackFn, whiteFn) {
  let b = initialBoard(), p = BLACK;
  while (!isGameOver(b)) {
    if (!hasMove(b, p)) { p = opponent(p); continue; }
    const m = (p === BLACK ? blackFn : whiteFn)(b, p);
    assert.ok(flips(b, p, m).length > 0, '打つ手は必ず合法');
    b = applyMove(b, p, m); p = opponent(p);
  }
  return b;
}

test('初手：黒の合法手は c4 d3 e6 f5', () => {
  assert.deepEqual(legalMoves(initialBoard(), BLACK).map(idxToAlg).sort(), ['c4', 'd3', 'e6', 'f5']);
});

test('反転：黒が d3 に打つと d4 が返り、石数は 黒4・白1 に', () => {
  const b0 = initialBoard();
  assert.deepEqual(flips(b0, BLACK, algToIdx('d3')).map(idxToAlg), ['d4']);
  const b1 = applyMove(b0, BLACK, algToIdx('d3'));
  const s = score(b1);
  assert.equal(s.black, 4); assert.equal(s.white, 1);
});

test('非合法な手は拒む', () => {
  assert.throws(() => applyMove(initialBoard(), BLACK, algToIdx('a1')));
});

test('パス：相手だけ打てる局面では hasMove が割れる', () => {
  // 盤を黒で埋め、白の隅ひとつだけ空ける → 黒は打てない、白も打てない（終局）
  const b = new Int8Array(64).fill(BLACK); b[0] = EMPTY;
  assert.equal(hasMove(b, BLACK), false);
  assert.equal(hasMove(b, WHITE), false);
  assert.equal(isGameOver(b), true);
});

test('勝者：空きは多い色に足して数える（少数空きでも勝敗が決まる）', () => {
  const b = new Int8Array(64); for (let i = 0; i < 64; i++) b[i] = i < 33 ? BLACK : (i < 64 ? WHITE : EMPTY);
  // 黒33・白31 → 黒の勝ち
  assert.equal(winner(b), BLACK);
  const tie = new Int8Array(64); for (let i = 0; i < 64; i++) tie[i] = i < 32 ? BLACK : WHITE;
  assert.equal(winner(tie), EMPTY);
});

test('一局は必ず終局し、盤は 64 マス埋まる（AI 対 AI）', () => {
  const ai = (b, p) => chooseMove(b, p, { depth: 3 });
  const b = playGame(ai, ai);
  const s = score(b);
  assert.equal(s.black + s.white + s.empty, 64);
  assert.equal(s.empty <= 0 || !hasMove(b, BLACK) && !hasMove(b, WHITE), true);
});

test('AI は決定的：同じ局面からは同じ最善手', () => {
  const b = applyMove(initialBoard(), BLACK, algToIdx('d3'));
  assert.equal(chooseMove(b, WHITE, { depth: 5 }), chooseMove(b, WHITE, { depth: 5 }));
});

test('強さ：AI（深さ3）はランダムに、ほぼ負けない（20局）', () => {
  const rng = mulberry32(424242);
  const rand = (b, p) => { const ms = legalMoves(b, p); return ms[Math.floor(rng() * ms.length)]; };
  const ai = (b, p) => chooseMove(b, p, { depth: 3 });
  let win = 0;
  for (let g = 0; g < 20; g++) {
    const res = g % 2 ? playGame(rand, ai) : playGame(ai, rand);
    if (winner(res) === (g % 2 ? WHITE : BLACK)) win++;
  }
  assert.ok(win >= 18, `AI の勝ち ${win}/20`);
});

test('強さ：深く読むほど強い（深さ4 が 深さ1 に勝ち越す）', () => {
  const deep = (b, p) => chooseMove(b, p, { depth: 4 });
  const shallow = (b, p) => chooseMove(b, p, { depth: 1 });
  let deepWins = 0;
  for (let g = 0; g < 4; g++) {
    const res = g % 2 ? playGame(shallow, deep) : playGame(deep, shallow);
    if (winner(res) === (g % 2 ? WHITE : BLACK)) deepWins++;
  }
  assert.ok(deepWins >= 3, `深い方の勝ち ${deepWins}/4`);
});

test('終盤は読み切る：空き1の局面で最善（取れる手）を選ぶ', () => {
  const b = new Int8Array(64).fill(WHITE);
  b[0] = EMPTY; b[7] = BLACK;        // a1 が空き・h1 が黒 → 黒 a1 で b1..g1 を一気に反転
  assert.deepEqual(flips(b, BLACK, 0).map(idxToAlg), ['b1', 'c1', 'd1', 'e1', 'f1', 'g1']);
  assert.equal(chooseMove(b, BLACK, { endgame: 12 }), 0);   // 唯一かつ最善の a1
});
