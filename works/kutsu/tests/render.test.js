import test from 'node:test';
import assert from 'node:assert/strict';
import { Renderer, dim } from '../js/ui/render.js';
import { Screens } from '../js/ui/screens.js';

test('UI モジュールは Node でも読める（トップで DOM を触らない）', () => {
  assert.equal(typeof Renderer, 'function');
  assert.equal(typeof Screens, 'function');
});

test('dim：色を黒へ寄せる（記憶の描画）', () => {
  assert.equal(dim('#ffffff', 0.5), 'rgb(128,128,128)');
  assert.equal(dim('#806040', 0), 'rgb(0,0,0)');
  // 不正な色はそのまま返す
  assert.equal(dim('rgba(1,2,3,.5)', 0.5), 'rgba(1,2,3,.5)');
});
