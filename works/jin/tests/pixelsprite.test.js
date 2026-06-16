import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';
import { RNG } from '../js/core/rng.js';
import { createUnit } from '../js/core/unit.js';
import { drawTokenPixel } from '../js/ui/pixelsprite.js';

/* キャンバス 2D 文脈の極小スタブ：fillRect の列を記録する。 */
function fakeCtx() {
  const rects = [];
  let fill = '#000';
  return {
    get fillStyle() { return fill; }, set fillStyle(v) { fill = v; },
    strokeStyle: '#000', lineWidth: 1, globalAlpha: 1,
    save() {}, restore() {}, beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {}, arc() {}, arcTo() {}, ellipse() {}, quadraticCurveTo() {},
    fill() {}, stroke() {},
    fillRect(x, y, w, h) { rects.push([Math.round(x), Math.round(y), w, h, fill]); },
    strokeRect() {},
    _rects: rects,
  };
}

const KINDS = ['lord', 'knight', 'mage', 'cleric', 'archer', 'pegasus', 'cavalier', 'mercenary', 'revenant', 'wyvernlord'];

test('ドット絵：全アーキタイプが描けて、粒を刻む', () => {
  for (const classId of KINDS) {
    const u = createUnit({ classId, level: 6, items: [], side: 'player' }, new RNG(1));
    const ctx = fakeCtx();
    assert.doesNotThrow(() => drawTokenPixel(ctx, u, 40, 40, 48, {}));
    // 影＋HPバーを除いても、人の粒（fillRect）が多数あること
    assert.ok(ctx._rects.length > 20, `${classId} は粒で描かれる（${ctx._rects.length}）`);
  }
});

test('ドット絵：同じユニットなら同じ粒（決定的）', () => {
  const mk = () => createUnit({ classId: 'mage', level: 8, items: ['fire'], side: 'enemy' }, new RNG(3));
  const a = fakeCtx(), b = fakeCtx();
  drawTokenPixel(a, mk(), 30, 30, 48, {});
  drawTokenPixel(b, mk(), 30, 30, 48, {});
  assert.deepEqual(a._rects, b._rects, '同条件は一致');
});

test('ドット絵：陣営で体の色が変わる', () => {
  const colorsOf = side => {
    const ctx = fakeCtx();
    drawTokenPixel(ctx, createUnit({ classId: 'mercenary', level: 6, items: ['iron_sword'], side }, new RNG(2)), 30, 30, 48, {});
    return new Set(ctx._rects.map(r => r[4]));
  };
  const player = colorsOf('player'), enemy = colorsOf('enemy');
  assert.ok(player.has('#5b74d6'), '自軍は青系');
  assert.ok(enemy.has('#c0463e'), '敵は赤系');
});

test('ドット絵：HP を消すと粒は減る（HPバーぶん）', () => {
  const u = createUnit({ classId: 'knight', level: 6, items: ['iron_lance'], side: 'player' }, new RNG(5));
  const withHp = fakeCtx(), noHp = fakeCtx();
  drawTokenPixel(withHp, u, 30, 30, 48, {});
  drawTokenPixel(noHp, u, 30, 30, 48, { hp: false });
  assert.ok(withHp._rects.length >= noHp._rects.length, 'HPバーは追加の矩形');
});
