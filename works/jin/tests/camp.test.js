import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { RNG } from '../js/core/rng.js';
import { createUnit } from '../js/core/unit.js';
import { campLine, drawCamp } from '../js/ui/camp.js';

function fakeCanvas() {
  const ctx = {
    fillStyle: '#000', strokeStyle: '#000', globalAlpha: 1, lineWidth: 1, imageSmoothingEnabled: true,
    setTransform() {}, save() {}, restore() {}, translate() {}, rotate() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {}, fill() {}, stroke() {}, fillRect() {}, strokeRect() {},
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
  };
  return { width: 0, height: 0, clientWidth: 520, style: {}, getContext() { return ctx; } };
}

test('野営のつぶやき：種と章から決定的に選ばれる', () => {
  const a = campLine(20260615, 3), b = campLine(20260615, 3);
  assert.equal(a, b);
  assert.ok(typeof a === 'string' && a.length > 0);
});

test('野営のつぶやき：章で移ろいうる', () => {
  const set = new Set();
  for (let ch = 0; ch < 16; ch++) set.add(campLine(7, ch));
  assert.ok(set.size >= 2, '章ごとに変わりうる');
});

test('野営シーン：仲間入りでも空でも描画が落ちない', () => {
  const r = new RNG(1);
  const party = ['lord', 'knight', 'cleric', 'archer', 'mage', 'mercenary', 'pegasus'].map((c, i) =>
    createUnit({ classId: c, level: 5, items: [], side: 'player' }, r.derive('u' + i)));
  assert.doesNotThrow(() => drawCamp(fakeCanvas(), party, 1000));
  assert.doesNotThrow(() => drawCamp(fakeCanvas(), [], 0));
});
