import test from 'node:test';
import assert from 'node:assert/strict';
import '../js/core/game.js';                 // 登録簿へ items_extra8 を取り込む
import { ITEMS, WTYPE, triangle } from '../js/core/items.js';

const EXOTIC = Object.keys(ITEMS).filter(id => id.startsWith('exotic_'));

test('異邦の珍品：26品が登録され、得物は妥当な型・正の値', () => {
  assert.equal(EXOTIC.length, 26, `珍品が登録（${EXOTIC.length}）`);
  for (const id of EXOTIC) {
    const it = ITEMS[id];
    assert.ok(it.name && it.kind && it.desc, `${id} に名・種・説明`);
    assert.ok(it.price > 0, `${id} の値`);
    if (it.kind === 'weapon') {
      assert.ok(WTYPE[it.wtype], `${id} の型 ${it.wtype}`);
      assert.ok(it.mt >= 0 && it.hit >= 0 && it.min >= 1 && it.max >= it.min, `${id} の数値`);
      if (['anima', 'light', 'dark'].includes(it.wtype)) assert.ok(it.magic, `${id} は魔法`);
    }
  }
});

test('異邦の珍品：武器・杖・能力品・装飾が揃う', () => {
  const weapons = EXOTIC.filter(id => ITEMS[id].kind === 'weapon');
  const staves = EXOTIC.filter(id => ITEMS[id].wtype === 'staff');
  const boosters = EXOTIC.filter(id => ITEMS[id].kind === 'booster');
  const accessories = EXOTIC.filter(id => ITEMS[id].kind === 'accessory');
  assert.ok(weapons.length >= 15 && staves.length >= 4);
  assert.equal(boosters.length, 3, '能力品3');
  assert.equal(accessories.length, 3, '装飾3');
  for (const id of staves) assert.ok(['heal', 'mend', 'physic', 'recover'].includes(ITEMS[id].staff), `${id} の杖種`);
});

test('異邦の珍品：状態付与や特効も妥当な値だけを使う', () => {
  const infl = new Set(['sleep', 'slow', 'blind', 'poison']);
  const eff = new Set(['dragon', 'fly', 'armor', 'horse']);
  for (const id of EXOTIC) {
    const it = ITEMS[id];
    if (it.inflict) assert.ok(infl.has(it.inflict.id), `${id} の状態`);
    if (it.eff) for (const e of it.eff) assert.ok(eff.has(e), `${id} の特効 ${e}`);
    if (it.kind === 'weapon' && it.wtype !== 'staff') { const t = triangle(it.wtype, 'sword'); assert.ok(typeof t.atk === 'number'); }
  }
});
