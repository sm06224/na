import test from 'node:test';
import assert from 'node:assert/strict';
import { splitExpense, computeBalances, minimizeTransfers, settle, mergeWeights } from '../js/core/split.js';

const sum = m => [...m.values()].reduce((a, b) => a + b, 0);

test('等分：端数なくぴったり割れる', () => {
  const o = splitExpense(3000, ['a', 'b', 'c']);
  assert.equal(o.get('a'), 1000); assert.equal(o.get('b'), 1000); assert.equal(o.get('c'), 1000);
  assert.equal(sum(o), 3000);
});

test('等分：端数は決定的に配られ、合計はぴったり', () => {
  const o = splitExpense(1000, ['a', 'b', 'c']);     // 333.33…
  assert.equal(sum(o), 1000);
  const vals = [...o.values()].sort();
  assert.deepEqual(vals, [333, 333, 334]);           // 余り 1 円は誰かひとりへ
});

test('重みつき：割合どおり、端数も合う', () => {
  const o = splitExpense(1000, ['a', 'b'], { a: 3, b: 1 });   // 750 / 250
  assert.equal(o.get('a'), 750); assert.equal(o.get('b'), 250);
  assert.equal(sum(o), 1000);
});

test('全員 0 重みなら等分に倒す', () => {
  const o = splitExpense(900, ['a', 'b', 'c'], { a: 0, b: 0, c: 0 });
  assert.equal(sum(o), 900);
  for (const v of o.values()) assert.equal(v, 300);
});

test('残高は必ず合計ゼロ', () => {
  const members = ['a', 'b', 'c', 'd'];
  const expenses = [
    { payer: 'a', amount: 4000, participants: ['a', 'b', 'c', 'd'] },
    { payer: 'b', amount: 1500, participants: ['b', 'c'] },
    { payer: 'c', amount: 999, participants: ['a', 'd'] },
  ];
  assert.equal(sum(computeBalances(members, expenses)), 0);
});

test('不参加者は負担しない', () => {
  const members = ['a', 'b', 'c'];
  // a が 3000 立て替え、c は不参加（a と b だけで割る）
  const bal = computeBalances(members, [{ payer: 'a', amount: 3000, participants: ['a', 'b'] }]);
  assert.equal(bal.get('c'), 0);
  assert.equal(bal.get('b'), -1500);
  assert.equal(bal.get('a'), 1500);
});

test('精算：全員の貸し借りがゼロになり、送金は正の額・自分宛なし', () => {
  const members = ['a', 'b', 'c', 'd'];
  const expenses = [
    { payer: 'a', amount: 8000, participants: members },
    { payer: 'b', amount: 1200, participants: ['c', 'd'] },
    { payer: 'c', amount: 3333, participants: members },
  ];
  const { balances, transfers } = settle(members, expenses);
  const net = new Map(members.map(id => [id, balances.get(id)]));
  for (const t of transfers) {
    assert.ok(t.amount > 0);
    assert.notEqual(t.from, t.to);
    net.set(t.from, net.get(t.from) + t.amount);
    net.set(t.to, net.get(t.to) - t.amount);
  }
  for (const id of members) assert.equal(net.get(id), 0, `${id} が精算しきれていない`);
});

test('送金回数は人数 − 1 以下', () => {
  const members = ['a', 'b', 'c', 'd', 'e'];
  const expenses = [
    { payer: 'a', amount: 5000, participants: members },
    { payer: 'b', amount: 2500, participants: members },
    { payer: 'e', amount: 1000, participants: ['a', 'e'] },
  ];
  const { transfers } = settle(members, expenses);
  assert.ok(transfers.length <= members.length - 1, `送金 ${transfers.length} 回`);
});

test('輪になった貸し借りは、送金ゼロで消える', () => {
  // a→b、b→c、c→a がそれぞれ同額 → 全員の残高 0 → 送金不要
  const members = ['a', 'b', 'c'];
  const expenses = [
    { payer: 'a', amount: 1000, participants: ['b'] },
    { payer: 'b', amount: 1000, participants: ['c'] },
    { payer: 'c', amount: 1000, participants: ['a'] },
  ];
  const { transfers } = settle(members, expenses);
  assert.equal(transfers.length, 0);
});

test('単純な立て替えは、人数−1 回で済む', () => {
  // a が全員ぶん 3000 立て替え → b と c が a に 1000 ずつ
  const { transfers } = settle(['a', 'b', 'c'], [{ payer: 'a', amount: 3000, participants: ['a', 'b', 'c'] }]);
  assert.equal(transfers.length, 2);
  for (const t of transfers) { assert.equal(t.to, 'a'); assert.equal(t.amount, 1000); }
});

test('傾斜：人ごとの既定の割合が効き、出費ごとの上書きが優先される', () => {
  const base = { a: 1, b: 0.5, c: 2 };          // b は子ども、c は幹事
  // 既定の傾斜
  assert.deepEqual(mergeWeights(['a', 'b', 'c'], base), { a: 1, b: 0.5, c: 2 });
  // この出費だけ b を 1 に上書き、d は未設定で 1
  assert.deepEqual(mergeWeights(['a', 'b', 'd'], base, { b: 1 }), { a: 1, b: 1, d: 1 });
  // 上書きの 0 も尊重される（この回は抜ける）
  assert.deepEqual(mergeWeights(['a', 'b'], base, { b: 0 }), { a: 1, b: 0 });
  // 実際に割ってみる：3000 を a:1, b:0.5, c:2（合計 3.5）で
  const o = splitExpense(3500, ['a', 'b', 'c'], mergeWeights(['a', 'b', 'c'], base));
  assert.equal(o.get('a'), 1000); assert.equal(o.get('b'), 500); assert.equal(o.get('c'), 2000);
});

test('払い手のない行（計画・予定）は精算に入らない', () => {
  const members = ['a', 'b', 'c'];
  const expenses = [
    { payer: 'a', amount: 3000, participants: members },     // 実費
    { payer: null, amount: 9000, participants: members },     // 計画（払い手未定）→ 無視
    { payer: undefined, amount: 500, participants: members }, // 同上
  ];
  const bal = computeBalances(members, expenses);
  // 3000 だけが効く：a が +2000、b・c が −1000
  assert.equal(bal.get('a'), 2000);
  assert.equal(bal.get('b'), -1000);
  assert.equal(bal.get('c'), -1000);
  assert.equal([...bal.values()].reduce((x, y) => x + y, 0), 0);
});

test('決定性：同じ入力からは、同じ精算', () => {
  const members = ['a', 'b', 'c'];
  const expenses = [{ payer: 'a', amount: 1000, participants: members }];
  assert.deepEqual(settle(members, expenses).transfers, settle(members, expenses).transfers);
});
