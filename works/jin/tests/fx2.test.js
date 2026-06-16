import test from 'node:test';
import assert from 'node:assert/strict';
import { FX } from '../js/ui/fx.js';

/* 描画用の極小スタブ（draw が落ちないことの確認に使う）。 */
function fakeCtx() {
  return {
    globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, lineCap: 'butt',
    save() {}, restore() {}, translate() {}, rotate() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, arc() {}, fill() {}, stroke() {}, fillRect() {},
  };
}
const cam = { tile: 32, x: 0, y: 0, _vw: 480, _vh: 320 };

test('FX：閃光は溜まり、時とともに消える', () => {
  const fx = new FX();
  fx.flash('#fff', 0.5, 0.2);
  assert.equal(fx.flashes.length, 1);
  fx.update(0.25);                 // 寿命 0.2 を超える
  assert.equal(fx.flashes.length, 0, '消える');
});

test('FX：会心の星はじけは輪と火花を生む', () => {
  const fx = new FX();
  fx.star(1, 1, '#ffd86a');
  assert.ok(fx.arcs.length >= 5, '輪＋十字の線');
  assert.ok(fx.parts.length >= 20, '多数の火花');
});

test('FX：衝撃・魔法陣・砂塵・輪が積まれる', () => {
  const fx = new FX();
  fx.impact(2, 2, '#ffd0a0'); assert.ok(fx.arcs.length >= 1 && fx.parts.length >= 1);
  const a0 = fx.arcs.length; fx.magicCircle(0, 0); assert.equal(fx.arcs.length, a0 + 1);
  const p0 = fx.parts.length; fx.dust(0, 0); assert.ok(fx.parts.length > p0);
  const a1 = fx.arcs.length; fx.ring(0, 0, '#fff', 1.2); assert.equal(fx.arcs.length, a1 + 1);
});

test('FX：閃光・新エフェクト込みでも draw が落ちない', () => {
  const fx = new FX();
  fx.star(1, 1); fx.impact(2, 2); fx.magicCircle(1, 2); fx.ring(2, 1); fx.dust(0, 0); fx.flash('#fff', 0.4);
  fx.confetti(5);
  assert.doesNotThrow(() => fx.draw(fakeCtx(), cam));
});

test('FX：clear はすべて空にする（閃光も）', () => {
  const fx = new FX();
  fx.star(1, 1); fx.flash('#fff'); fx.dust(0, 0);
  fx.clear();
  assert.equal(fx.count, 0);
  assert.equal(fx.flashes.length, 0);
});
