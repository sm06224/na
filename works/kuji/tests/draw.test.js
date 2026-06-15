import test from 'node:test';
import assert from 'node:assert/strict';
import {
  draw, commitment, verifyCommitment, verify,
  encodeEvidence, decodeEvidence, normalizeEntrants,
} from '../js/core/draw.js';

const PEOPLE = ['あおい', 'はると', 'ゆい', 'そうた', 'めい', 'りく', 'つむぎ', 'いつき'];
const base = (over = {}) => ({ entrants: PEOPLE, mode: 'order', count: 0, salt: 'seed-1', words: [], ...over });

test('結果は参加者の並べ替え（一人も増えず、減らず、重複せず）', () => {
  const r = draw(base());
  assert.equal(r.order.length, PEOPLE.length);
  assert.deepEqual([...r.order].sort(), [...PEOPLE].sort());
});

test('決定性：同じ入力からは、一席もちがわない同じくじ', () => {
  const a = draw(base()), b = draw(base());
  assert.deepEqual(a.order, b.order);
  assert.equal(a.id, b.id);
  assert.match(a.id, /^[0-9a-f]{8}$/);
});

test('細工できない：塩・参加者・モード・合言葉のどれをいじっても結果が変わる', () => {
  const r0 = draw(base());
  assert.notEqual(r0.id, draw(base({ salt: 'seed-2' })).id);             // 塩
  assert.notEqual(r0.id, draw(base({ entrants: [...PEOPLE, 'かなで'] })).id); // 参加者
  assert.notEqual(r0.id, draw(base({ mode: 'pick', count: 3 })).id);     // モード
  assert.notEqual(r0.id, draw(base({ words: ['ねこ'] })).id);            // 合言葉
  // 名前を一文字変えるだけでも雪崩のように変わる
  const swapped = [...PEOPLE]; swapped[0] = 'あお';
  assert.notEqual(r0.id, draw(base({ entrants: swapped })).id);
});

test('合言葉は、出した順番に依らない（みんな対等）', () => {
  const a = draw(base({ words: ['ねこ', 'いぬ', 'とり'] }));
  const b = draw(base({ words: ['とり', 'ねこ', 'いぬ'] }));
  assert.deepEqual(a.order, b.order);
});

test('抽選：当選はちょうど k 人、順位の先頭から、全員参加者のうち', () => {
  const r = draw(base({ mode: 'pick', count: 3 }));
  assert.equal(r.winners.length, 3);
  assert.deepEqual(r.winners, r.order.slice(0, 3));
  for (const w of r.winners) assert.ok(PEOPLE.includes(w));
  // k が人数を超えても全員までで頭打ち
  assert.equal(draw(base({ mode: 'pick', count: 99 })).winners.length, PEOPLE.length);
});

test('組分け：全員ちょうど一度ずつ・班の大きさの差は最大1', () => {
  const r = draw(base({ mode: 'groups', count: 3 }));
  assert.equal(r.groups.length, 3);
  const flat = r.groups.flat();
  assert.equal(flat.length, PEOPLE.length);
  assert.deepEqual([...flat].sort(), [...PEOPLE].sort());
  const sizes = r.groups.map(g => g.length);
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
});

test('封：塩からの封蝋。正しい塩だけが封と合う', () => {
  const salt = 'abc-123';
  const commit = commitment(salt);
  assert.match(commit, /^[0-9a-f]{64}$/);
  assert.ok(verifyCommitment(commit, salt));
  assert.ok(!verifyCommitment(commit, 'abc-124'));
  assert.ok(verifyCommitment(commit.toUpperCase(), salt));   // 大文字でも照合できる
});

test('検証：正しい結果は ok、一席でもすり替えれば見破る', () => {
  const r = draw(base());
  assert.ok(verify(base(), r).ok);
  const tampered = { ...r, order: [...r.order] };
  [tampered.order[0], tampered.order[1]] = [tampered.order[1], tampered.order[0]];
  assert.ok(!verify(base(), tampered).ok);
  // 当選のすり替えも見破る
  const r2 = draw(base({ mode: 'pick', count: 2 }));
  const fake = { ...r2, winners: [r2.order[r2.order.length - 1], r2.order[0]] };
  assert.ok(!verify(base({ mode: 'pick', count: 2 }), fake).ok);
});

test('証拠：畳んで開くと元に戻り、同じくじを再現できる', () => {
  const inputs = base({ mode: 'groups', count: 2, words: ['ねこ'] });
  const ev = encodeEvidence(inputs);
  assert.match(ev, /^[A-Za-z0-9_-]+$/);   // URL に安全
  const back = decodeEvidence(ev);
  assert.deepEqual(back.entrants, normalizeEntrants(inputs.entrants));
  assert.equal(back.salt, inputs.salt);
  assert.equal(back.mode, inputs.mode);
  assert.deepEqual(draw(back).order, draw(inputs).order);
});

test('偏りがない：席は全員にほぼ均等に回る（5人×6000回）', () => {
  const n = 5, trials = 6000;
  const names = ['1', '2', '3', '4', '5'];
  const count = Array.from({ length: n }, () => new Array(n).fill(0));   // [人][席]
  for (let t = 0; t < trials; t++) {
    const r = draw({ entrants: names, mode: 'order', salt: 'u' + t });
    r.order.forEach((name, seat) => { count[+name - 1][seat]++; });
  }
  const expected = trials / n;                 // 1200
  for (let p = 0; p < n; p++) {
    for (let s = 0; s < n; s++) {
      const dev = Math.abs(count[p][s] - expected) / expected;
      assert.ok(dev < 0.12, `人${p + 1} 席${s + 1}: ${count[p][s]}（偏り ${(dev * 100).toFixed(1)}%）`);
    }
  }
});

test('抽選1名も均等：当選確率はおよそ 1/n（4人×6000回）', () => {
  const names = ['a', 'b', 'c', 'd'], trials = 6000;
  const win = { a: 0, b: 0, c: 0, d: 0 };
  for (let t = 0; t < trials; t++) {
    win[draw({ entrants: names, mode: 'pick', count: 1, salt: 'p' + t }).winners[0]]++;
  }
  for (const k of names) {
    const dev = Math.abs(win[k] - trials / 4) / (trials / 4);
    assert.ok(dev < 0.12, `${k}: ${win[k]}（偏り ${(dev * 100).toFixed(1)}%）`);
  }
});

test('手紙 — 最初のくじ「席替え」は、この並びに決まっている', () => {
  // この作品が生まれた日に引かれた、最初のくじ。あとから来る人が、まず確かめる席。
  // 入力と銘は tests がいつまでも照合する——封を破らずに渡せる言づて。
  const inputs = {
    entrants: ['あおい', 'はると', 'ゆい', 'そうた', 'めい'],
    mode: 'order', salt: '20260615', words: [],
  };
  const r = draw(inputs);
  assert.equal(r.id, '16692a05');
  assert.deepEqual(r.order, ['ゆい', 'はると', 'めい', 'そうた', 'あおい']);
});
