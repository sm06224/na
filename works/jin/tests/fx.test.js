import test from 'node:test';
import assert from 'node:assert/strict';
import { FX } from '../js/ui/fx.js';

test('火花は生まれ、やがて消える', () => {
  const fx = new FX();
  fx.spark(2, 2, '#fff', 12);
  assert.equal(fx.parts.length, 12);
  for (let i = 0; i < 30; i++) fx.update(1 / 30);   // 1 秒進める
  assert.equal(fx.parts.length, 0, '寿命を過ぎた粒は消える');
});

test('画面の揺れは速やかに収まる', () => {
  const fx = new FX();
  fx.addShake(10);
  assert.ok(fx.shake > 0);
  for (let i = 0; i < 30; i++) fx.update(1 / 30);
  assert.equal(fx.shake, 0);
});

test('飛び道具：到達で onArrive が一度だけ呼ばれ、やがて消える', () => {
  const fx = new FX();
  let hit = 0;
  fx.shoot({ x: 0, y: 0 }, { x: 3, y: 0 }, { dur: 0.2, onArrive: () => hit++ });
  assert.equal(fx.shots.length, 1);
  for (let i = 0; i < 60; i++) fx.update(1 / 60);
  assert.equal(hit, 1, 'ちょうど一度');
  assert.equal(fx.shots.length, 0, '到達後に消える');
});

test('斬撃と魔法の輪は一定時間で消える', () => {
  const fx = new FX();
  fx.slash({ x: 0, y: 0 }, { x: 1, y: 1 });
  fx.burst(2, 2, '#b79bff');
  assert.ok(fx.arcs.length >= 2);
  for (let i = 0; i < 40; i++) fx.update(1 / 30);
  assert.equal(fx.arcs.length, 0);
});

test('紙吹雪は画面空間の粒として湧く', () => {
  const fx = new FX();
  fx.confetti(40);
  assert.equal(fx.parts.length, 40);
  assert.ok(fx.parts.every(p => p.screen === true));
});

test('count は全演出の総数', () => {
  const fx = new FX();
  fx.spark(0, 0, '#fff', 5); fx.slash({ x: 0, y: 0 }, { x: 1, y: 0 }); fx.shoot({ x: 0, y: 0 }, { x: 1, y: 0 }, {});
  assert.equal(fx.count, 7);
  fx.clear();
  assert.equal(fx.count, 0);
});
