import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';                 // 全得物・全職を登録簿へ
import { RNG } from '../js/core/rng.js';
import { createUnit, isAlive, unitRank } from '../js/core/unit.js';
import { arenaOpponents, makeArenaFoe, arenaFight } from '../js/core/arena.js';

function hero(level = 12, weapon = 'silver_sword') {
  return createUnit({ classId: 'hero', level, items: [weapon], side: 'player', name: 'リン' }, new RNG(1));
}

test('闘技場：三番付の相手が種と章から決定的に組まれる', () => {
  const a = arenaOpponents(20260615, 0, 6);
  const b = arenaOpponents(20260615, 0, 6);
  assert.equal(a.length, 3);
  assert.deepEqual(a.map(o => [o.tier, o.classId, o.level, o.name]), b.map(o => [o.tier, o.classId, o.level, o.name]));
  assert.ok(a[0].reward < a[2].reward, '番付が上がるほど褒賞が増す');
  assert.ok(a[0].wager < a[2].wager, '番付が上がるほど賭け金も増す');
});

test('闘技場：章が変われば顔ぶれも変わりうる', () => {
  const names = new Set();
  for (let ch = 0; ch < 16; ch++) names.add(arenaOpponents(7, ch, 8).map(o => o.name).join('/'));
  assert.ok(names.size >= 2, '章ごとに相手が移ろう');
});

test('闘技場：相手ユニットが実体化する', () => {
  const opp = arenaOpponents(42, 3, 10)[1];
  const foe = makeArenaFoe(opp, 42, 3);
  assert.equal(foe.classId, opp.classId);
  assert.equal(foe.level, opp.level);
  assert.ok(isAlive(foe) && foe.hp === foe.maxHp);
});

test('闘技場：強者は序の口に勝つ', () => {
  const u = hero(14, 'silver_sword');
  const opp = arenaOpponents(99, 2, 6)[0];   // 序の口
  const res = arenaFight(u, opp, 99, 2);
  assert.equal(res.win, true);
  assert.equal(res.reward, opp.reward);
});

test('闘技場：本体の HP と状態は汚れない（命は獲られぬ）', () => {
  const u = hero(3, 'iron_sword');   // 弱め
  const hp0 = u.hp, st0 = u.status.length;
  const opp = arenaOpponents(5, 9, 18)[2];   // 猛者（格上）
  const res = arenaFight(u, opp, 5, 9);
  assert.equal(u.hp, hp0, '本体のHPは不変');
  assert.equal(u.status.length, st0, '状態異常も移らない');
  assert.ok(typeof res.win === 'boolean');
  if (!res.win) assert.equal(res.reward, 0, '負ければ褒賞なし');
});

test('闘技場：勝つと熟練度が上がる', () => {
  const u = hero(16, 'silver_sword');
  u.wexp.sword = 0;                     // 上限に余地を作る
  const opp = arenaOpponents(3, 1, 5)[0];   // 序の口（格下）
  const res = arenaFight(u, opp, 3, 1);
  assert.equal(res.win, true, '強者は序の口に勝つ');
  assert.ok(u.wexp.sword > 0, '勝者は腕を上げる');
});

test('闘技場：同じ種・章・相手なら同じ勝敗（決定的）', () => {
  const run = () => arenaFight(hero(10, 'steel_sword'), arenaOpponents(2026, 4, 9)[1], 2026, 4);
  const x = run(), y = run();
  assert.equal(x.win, y.win);
  assert.deepEqual(x.log.map(l => [l.me, l.foe]), y.log.map(l => [l.me, l.foe]));
});
