import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newState, legalMoves, applyMove, status, other, P1, P2, count } from '../js/core/game.js';
import { chooseMove, randomMove } from '../js/core/ai.js';
import { fromSeed, nameOf, rulebook, evaluate, discover, playGame } from '../js/core/forge.js';

const mul = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
function play(rs, f1, f2) {
  let s = newState(rs);
  for (let g = 0; g < 400; g++) {
    const st = status(s, rs);
    if (st.over) return st.winner;
    if (st.pass) { s = { ...s, turn: other(s.turn) }; continue; }
    s = applyMove(s, (s.turn === P1 ? f1 : f2)(s), rs);
  }
  return 0;
}

test('エンジンの正しさ：三目並べは最善で必ず引き分け、最善手はランダムに負けない', () => {
  const ttt = { N: 3, place: 'anywhere', win: 'align', k: 3 };
  const ai = (s) => chooseMove(s, ttt, { depth: 9 });
  assert.equal(play(ttt, ai, ai), 0);                 // 完全プレイは引き分け
  const rng = mul(123); const rand = (s) => randomMove(s, ttt, rng);
  let loss = 0;
  for (let g = 0; g < 24; g++) {
    const w = g % 2 ? play(ttt, rand, ai) : play(ttt, ai, rand);
    if (w === (g % 2 ? P1 : P2)) loss++;              // AI 以外の色が勝ったら負け
  }
  assert.equal(loss, 0, '完全プレイヤーは負けない');
});

test('重力 connect：AI はランダムにほぼ勝つ（技量が要る）', () => {
  const rs = { N: 5, place: 'gravity', win: 'align', k: 4 };
  const ai = (s) => chooseMove(s, rs, { depth: 4 });
  const rng = mul(9); const rand = (s) => randomMove(s, rs, rng);
  let win = 0;
  for (let g = 0; g < 16; g++) { const w = g % 2 ? play(rs, rand, ai) : play(rs, ai, rand); if (w === (g % 2 ? P2 : P1)) win++; }
  assert.ok(win >= 14, `AI 勝ち ${win}/16`);
});

test('majority（リバーシ系）は中央 4 石で起動し、最後まで遊べる', () => {
  const rs = { N: 6, place: 'flank', win: 'majority', k: 0 };
  const s0 = newState(rs);
  assert.equal(count(s0.cells, P1) + count(s0.cells, P2), 4);     // 中央起動
  assert.ok(legalMoves(s0, rs).length > 0);
  const ai = (s) => chooseMove(s, rs, { depth: 2 });
  const r = playGame(rs, ai, ai);
  assert.ok(r.len > 4, '一局が進む');
});

test('block：打てなくなった者が負け（合法手ゼロで勝者が割れる）', () => {
  const rs = { N: 4, place: 'never', win: 'block', k: 0 };
  const s = newState(rs);
  assert.equal(status(s, rs).over, false);
  const r = playGame(rs, (st) => chooseMove(st, rs, { depth: 2 }), (st) => chooseMove(st, rs, { depth: 1 }));
  assert.notEqual(r.winner, undefined);
});

test('決定的：同じ種から、同じ規則・同じ名・同じ面白さ', () => {
  assert.deepEqual(fromSeed('abc'), fromSeed('abc'));
  assert.equal(nameOf('abc'), nameOf('abc'));
  const rs = fromSeed('xyz');
  assert.deepEqual(evaluate(rs, { games: 8, depth: 2 }), evaluate(rs, { games: 8, depth: 2 }));
});

test('面白さの判定：詰まらない規則は捨て、見込みあるものは残す', () => {
  // block × 隣接必須 ＝ 先手必勝の詰まらない規則（圏内）
  const trivial = { N: 5, place: 'must', win: 'block', k: 0, seed: 't' };
  const mt = evaluate(trivial, { games: 12, depth: 2 });
  assert.equal(mt.dead, true, '先手必勝は捨てられる');
  assert.equal(mt.fun, 0);
  // 5×5 重力 connect-4 ＝ 技量が要り、決着し、公平な良作
  const good = { N: 5, place: 'gravity', win: 'align', k: 4, seed: 'g' };
  const mg = evaluate(good, { games: 12, depth: 3 });
  assert.equal(mg.dead, false);
  assert.ok(mg.skill >= 0.75 && mg.fun > 50);
});

test('発掘：重複を除き、面白い順に並ぶ', () => {
  const ranked = discover(Array.from({ length: 30 }, (_, i) => 'd' + i), { games: 8, depth: 2 });
  for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].metrics.fun >= ranked[i].metrics.fun);
  assert.ok(ranked.some((g) => !g.metrics.dead), '少なくとも一つは面白い');
  const keys = ranked.map((g) => `${g.rs.N}|${g.rs.win}|${g.rs.place}|${g.rs.k}`);
  assert.equal(new Set(keys).size, keys.length, '重複なし');
});

test('ルールブックは三要素（盤・置き方・勝ち）を必ず説明する', () => {
  for (const seed of ['a', 'bb', 'ccc', 'dddd']) {
    const b = rulebook(fromSeed(seed));
    assert.ok(b.board && b.place && b.win);
  }
});
