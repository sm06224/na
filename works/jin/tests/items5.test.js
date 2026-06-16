import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';                 // 登録簿へ items_extra5 を取り込む
import { ITEMS, WTYPE, triangle } from '../js/core/items.js';

const STAR = Object.keys(ITEMS).filter(id => id.startsWith('star_'));

test('星の得物：28品が登録され、得物は妥当な型・正の値', () => {
  assert.ok(STAR.length >= 28, `星の品が登録（${STAR.length}）`);
  for (const id of STAR) {
    const it = ITEMS[id];
    assert.ok(it.name && it.kind, `${id} に名と種`);
    if (it.kind === 'weapon') {
      assert.ok(WTYPE[it.wtype], `${id} の型 ${it.wtype}`);
      assert.ok(it.price > 0 && it.mt >= 0 && it.hit >= 0, `${id} の数値`);
      assert.ok(it.min >= 1 && it.max >= it.min, `${id} の射程`);
    } else {
      assert.ok(it.price > 0, `${id} の値`);
    }
  }
});

test('星の得物：少なくとも竜特効・連射・吸収・状態付与が一つずつある', () => {
  const w = STAR.map(id => ITEMS[id]).filter(it => it.kind === 'weapon');
  assert.ok(w.some(it => it.eff && it.eff.includes('dragon')), '竜特効');
  assert.ok(w.some(it => it.brave), '連射');
  assert.ok(w.some(it => it.drain), '吸収');
  assert.ok(w.some(it => it.inflict), '状態付与');
});

test('星の得物：三すくみの計算に巻き込める（壊れない）', () => {
  for (const id of STAR) {
    const it = ITEMS[id];
    if (it.kind === 'weapon') { const t = triangle(it.wtype, 'sword'); assert.ok(typeof t.atk === 'number'); }
  }
});
